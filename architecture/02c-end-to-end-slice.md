# 02c — One request, end to end

*Companion to [02 — Layered architecture](02-layered-architecture.md) and the [nuance catalog](02-layered-nuances.md). The catalog takes one rule at a time; this note follows a single request through every layer so the pieces are visible together. The runnable version is [`00-end-to-end.ts`](02-layered-example/nuances/00-end-to-end.ts).*

## 1. The scenario

Place an order for customer `c1`, whose credit limit is 100. The order must:

- have at least one line;
- have positive integer quantities;
- leave the customer's total open orders within the limit.

One request, one transaction. If any rule fails, nothing is saved.

The interesting part is not the business rule. It is **who decides what**, and **which decisions are allowed to depend on which other decisions**.

## 2. The chain

```text
HTTP body
  │
  ▼
OrdersController .............. protocol in, protocol out
  │  calls execute(command)
  ▼
PlaceOrderUseCase ............. the contract (interface)
  ▲
  │  implemented by
PlaceOrderService ............. application service: sequence + transaction
  │
  ├─ CustomerRepository.find ─────▶ InMemoryCustomerRepository ─▶ Customer
  ├─ Order.draft / addLine ───────▶ Order (aggregate, invariants)
  ├─ OrderRepository.openTotalFor ─▶ InMemoryOrderRepository ──▶ rows
  ├─ CreditPolicy.check ──────────▶ domain service (pure)
  ├─ Order.place ─────────────────▶ aggregate (invariant)
  └─ OrderRepository.save ────────▶ InMemoryOrderRepository ──▶ OrderRow
```

Read it as a sequence of questions:

| # | Role | Question it answers | In this slice |
| --- | --- | --- | --- |
| 1 | Controller | How does the outside talk to us? | Parses shape, maps result and errors |
| 2 | Use case | What is the scenario? | `PlaceOrderUseCase` |
| 3 | Application service | In what order, and in which transaction? | `PlaceOrderService` |
| 4 | Domain service | Which rule spans more than one object? | `CreditPolicy` |
| 5 | Repository port | What does the inside need from storage? | `OrderRepository` |
| 6 | Adapter | How does a specific technology do it? | `InMemoryOrderRepository` |
| 7 | Aggregate | What must stay consistent together? | `Order` |

The composition root is not in the sequence because it runs once, at startup: it is the only code that knows the concrete classes in steps 3–6.

## 3. The code

The full file is [`00-end-to-end.ts`](02-layered-example/nuances/00-end-to-end.ts). The excerpts below are the same code, split by role.

### 3.1 The aggregate — `Order`

The aggregate root is the only way in. It enforces the invariants that must hold for the object graph.

```ts
type OrderLine = { sku: string; qty: number; unitPrice: number };
type OrderStatus = "draft" | "placed";

class Order {
  readonly id: string;
  readonly customerId: string;

  private readonly lines: OrderLine[] = [];
  private state: OrderStatus = "draft";

  private constructor(id: string, customerId: string) {
    this.id = id;
    this.customerId = customerId;
  }

  static draft(id: string, customerId: string): Order {
    return new Order(id, customerId);
  }

  addLine(line: OrderLine): void {
    if (this.state !== "draft") throw new DomainError("order is not editable");
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      throw new DomainError("quantity must be a positive integer");
    }
    if (line.unitPrice < 0) throw new DomainError("unit price cannot be negative");
    this.lines.push(line);
  }

  place(): void {
    if (this.lines.length === 0) throw new DomainError("cannot place an empty order");
    this.state = "placed";
  }

  get total(): number {
    return this.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
  }

  get status(): OrderStatus {
    return this.state;
  }

  get items(): OrderLine[] {
    return [...this.lines];
  }
}
```

The `lines` array is private. A caller cannot append a line behind the aggregate's back; every change goes through `addLine`, which is where the quantity and price rules live.

### 3.2 The domain service — `CreditPolicy`

This rule needs `Customer` (the limit) and `Order` (the total). It belongs to neither object, and it must not be in the application service, because it is a business policy rather than a step.

```ts
type Customer = { id: string; creditLimit: number };

class CreditPolicy {
  check(customer: Customer, openTotal: number, newTotal: number): void {
    const available = customer.creditLimit - openTotal;
    if (newTotal > available) throw new CreditLimitExceeded(available, newTotal);
  }
}
```

It is pure: no database, no clock, no save. The application service loads the data and passes it in. If the policy needed a repository, it could read through a port, but it still would not save or commit.

### 3.3 The ports

The inside declares what it needs, in its own language. No SQL, no row types, no vendor names.

```ts
interface CustomerRepository {
  find(id: string): Promise<Customer | null>;
}

interface OrderRepository {
  save(order: Order): Promise<void>;
  openTotalFor(customerId: string): Promise<number>;
}
```

`openTotalFor` is a query, not an aggregate load. A report or a limit check does not need every order as a domain object; it needs a number. Loading the aggregate to sum it is the N+1 mistake in another costume.

### 3.4 The use case and its implementation

The use case is a contract. The application service is one implementation of it.

```ts
type PlaceOrderCommand = { customerId: string; lines: OrderLine[] };
type PlaceOrderResult = { orderId: string; total: number; status: OrderStatus };

interface PlaceOrderUseCase {
  execute(command: PlaceOrderCommand): Promise<PlaceOrderResult>;
}

class PlaceOrderService implements PlaceOrderUseCase {
  private readonly customers: CustomerRepository;
  private readonly orders: OrderRepository;
  private readonly policy: CreditPolicy;
  private readonly newId: () => string;

  constructor(
    customers: CustomerRepository,
    orders: OrderRepository,
    policy: CreditPolicy,
    newId: () => string,
  ) {
    this.customers = customers;
    this.orders = orders;
    this.policy = policy;
    this.newId = newId;
  }

  async execute(command: PlaceOrderCommand): Promise<PlaceOrderResult> {
    // A real transaction opens here; every write below uses the same handle.
    const customer = await this.customers.find(command.customerId);
    if (!customer) throw new NotFound(`customer ${command.customerId}`);

    const order = Order.draft(this.newId(), customer.id);
    for (const line of command.lines) order.addLine(line);

    const openTotal = await this.orders.openTotalFor(customer.id);
    this.policy.check(customer, openTotal, order.total);

    order.place();
    await this.orders.save(order);
    // ...and commits here. The repository never commits on its own.

    return { orderId: order.id, total: order.total, status: order.status };
  }
}
```

The sequence matters:

1. load what the decision needs;
2. build the aggregate, letting it validate its own lines;
3. ask the domain service whether the *combination* is allowed;
4. change state;
5. save;
6. commit.

The application service does not contain the limit rule, and `Order` does not know that customers have limits. Each piece holds the decision it can make alone.

### 3.5 The controller

The controller speaks protocol. It validates the *shape* of the request, calls the use case, and maps outcomes to status codes. It contains no business rule.

```ts
class OrdersController {
  private readonly placeOrder: PlaceOrderUseCase;

  constructor(placeOrder: PlaceOrderUseCase) {
    this.placeOrder = placeOrder;
  }

  async handle(request: unknown): Promise<{ status: number; body: unknown }> {
    if (!isPlaceOrderCommand(request)) {
      return { status: 400, body: { error: "invalid request shape" } };
    }

    try {
      return { status: 201, body: await this.placeOrder.execute(request) };
    } catch (error) {
      if (error instanceof DomainError) {
        return { status: 422, body: { error: error.message } };
      }
      if (error instanceof NotFound) {
        return { status: 404, body: { error: error.message } };
      }
      throw error; // unknown: log once at the edge, do not swallow
    }
  }
}
```

The shape check is deliberately shallow. `qty: 0` passes it, because "positive integer" is a domain rule, not a shape rule. The domain rejects it later, and the controller maps that rejection. See [§09](02-layered-nuances.md#09-where-validation-lives).

### 3.6 The adapter

The adapter implements the port and owns the row shape. This is the only place that says `customer_id`.

```ts
type OrderRow = {
  id: string;
  customer_id: string;
  status: OrderStatus;
  lines: OrderLine[];
};

class InMemoryOrderRepository implements OrderRepository {
  private readonly rows = new Map<string, OrderRow>();

  async save(order: Order): Promise<void> {
    this.rows.set(order.id, {
      id: order.id,
      customer_id: order.customerId, // snake_case lives only here
      status: order.status,
      lines: order.items,
    });
  }

  async openTotalFor(customerId: string): Promise<number> {
    let total = 0;
    for (const row of this.rows.values()) {
      if (row.customer_id !== customerId || row.status !== "placed") continue;
      for (const line of row.lines) total += line.qty * line.unitPrice;
    }
    return total;
  }
}
```

A real adapter would run SQL here and map rows back with a `restore` factory on the aggregate. The boundary rule is the same: domain types in, rows out, mapping inside the adapter.

### 3.7 The composition root

One function chooses the concretes and hands them down.

```ts
function buildApp(): { controller: OrdersController; placeOrder: PlaceOrderUseCase } {
  const customers = new InMemoryCustomerRepository([{ id: "c1", creditLimit: 100 }]);
  const orders = new InMemoryOrderRepository();
  const policy = new CreditPolicy();
  const placeOrder = new PlaceOrderService(customers, orders, policy, () => randomUUID());

  return { controller: new OrdersController(placeOrder), placeOrder };
}
```

Nothing below this function calls `new` on a collaborator. That is what makes the same service usable with a Postgres adapter in production and an in-memory adapter in a test. See [§32](02-layered-nuances.md#32-dependency-injection-and-wiring).

## 4. The contract question

This is the part most codebases get wrong in both directions: an interface for everything, or an interface for nothing.

Two decisions are being conflated:

- **Injection:** the object receives its collaborators instead of constructing them.
- **Abstraction:** the field's type is an interface instead of a class.

You can have injection without abstraction. That is the normal case:

```ts
class OrdersController {
  private readonly placeOrder: PlaceOrderService; // the class, not the interface

  constructor(placeOrder: PlaceOrderService) {
    this.placeOrder = placeOrder;
  }
}
```

The seam is still there. The composition root still chooses the concrete. What you gave up is the *name* of the contract.

### 4.1 What the use-case interface buys

`PlaceOrderUseCase` is not mainly a swap mechanism. The swap story is the weakest one. It buys three things:

1. **A second driver.** HTTP and a CLI can both depend on `execute(command)` without importing `PlaceOrderService`. Each driver lives in its own module; the contract is the only thing they share.
2. **A decorator.** Logging, metrics, authorization, retries, or transaction management can wrap the service by implementing the same interface, without editing the service.
3. **A boundary the compiler can enforce.** If the controller is in another module or package, it can import the contract without importing the implementation. The import graph then matches the architecture.

### 4.2 What it costs

- One more type and one more name for the same thing.
- "Go to definition" lands on the interface, then you jump again.
- It invites interfaces for every class, including the ones that will never have a second implementation.
- It can hide the fact that the service is doing too much: a contract with twelve methods is a god service with a nice cover.

### 4.3 When it earns its keep

Add the interface when at least one is true:

- a second driver is real today (HTTP + queue, HTTP + CLI, API + cron);
- a decorator is real today (audit, metrics, feature flag, retry);
- the caller lives in a module that must not import the implementation;
- you are publishing the use case as the module's public API.

Skip it when all of these are true:

- one driver;
- one implementation;
- same module;
- no decorator.

Then type the field as `PlaceOrderService`. You still inject it. You still test it with fake repositories. You just stop pretending there is a second implementation. If a second driver appears later, extract the interface then — that is a mechanical refactor, not a rewrite.

### 4.4 The minimal version

The whole difference is two lines:

```ts
// with a contract
constructor(placeOrder: PlaceOrderUseCase) { ... }

// without one
constructor(placeOrder: PlaceOrderService) { ... }
```

Everything else — the composition root, the transaction, the tests with fake repositories — is unchanged. What you lose is the ability to hand the controller a decorator or a fake *object literal*. What you keep is the seam that matters: the controller does not construct the service.

### 4.5 The repository port is a different decision

The use-case interface is about **callers**. The repository port is about **direction**.

Even with one adapter, `PlaceOrderService` must not import `PostgresOrderRepository`. If it does, the application layer depends on infrastructure, and the arrow points outward. The port is where the arrow turns around:

```text
PlaceOrderService ──▶ OrderRepository (port, owned by the inside)
                            ▲
                            │ implements
                  PostgresOrderRepository (adapter, outside)
```

The swap story is weak here too: most teams never change the database. The port earns its keep because:

- the test uses an in-memory adapter on every run;
- the application module never imports the database driver;
- the SQL and the row mapping stay in one place;
- the domain can be reasoned about without a schema.

If you deliberately accept Active Record — the entity with `save()` — you do not need this port. That is a real trade, not a sin. See [§14a](02-layered-nuances.md#14a-active-record-vs-repository).

### 4.6 How often do you actually swap?

| Change | How often | What it justifies |
| --- | --- | --- |
| Database vendor | Almost never | The port's *swap* story — weak |
| In-memory adapter in tests | Every test run | The port — strong |
| A second driver (CLI, queue, cron) | Sometimes | The use-case interface |
| A decorator (metrics, audit, retry) | Sometimes | The use-case interface |
| A vendor behind a port (mail, payments) | Occasionally | That specific port |

So the honest rule is:

> Justify the repository port by the dependency rule and the test seam, not by a hypothetical database swap. Justify the use-case interface by a second driver or a decorator, not by a hypothetical reimplementation. If neither exists, inject the class.

That is not a rejection of abstraction. It is abstraction with a named buyer.

## 5. What changes when…

| Change | Files touched | Why |
| --- | --- | --- |
| Add a CLI | A new controller | The use case already exists; this is the day the interface pays |
| Swap Postgres for SQLite | A new adapter + the root | The port and service are unchanged |
| Add "no more than 10 lines" | `Order.addLine` | One aggregate owns the invariant |
| Add "three orders per customer per day" | `CreditPolicy` | The rule spans orders and customers |
| Add "reserve inventory" | `PlaceOrderService` + a port | New orchestration step, new collaborator |
| Add an order summary screen | A projection | Do not load the aggregate to render a read |

The pattern: **the change names the owner**. If you cannot say which file a change belongs in, the boundaries are not doing their job.

## 6. Proof

```bash
node --test architecture/02-layered-example/nuances/00-end-to-end.ts
```

The file proves five things:

1. A valid order returns `201`, total 80, status `placed`.
2. A second order over the remaining limit returns `422` from `CreditPolicy`.
3. A zero quantity returns `422` from the aggregate, not the controller.
4. A malformed body returns `400` before any domain code runs.
5. A second driver can call the same use case without the controller.

Run the whole lab with:

```bash
node --test architecture/02-layered-example/run-all.test.ts
# 124 tests, 124 pass
```

## 7. Questions to ask

- Which object decides the outcome: the controller, the application service, or the aggregate?
- Where does the transaction open, and does every write use the same handle?
- Does the domain import anything from infrastructure?
- Is there a second driver or a decorator today? If not, does the use-case interface have a buyer?
- Is this an injection decision or an abstraction decision? They are not the same.
- Is the rule about one entity, several entities, or the sequence of steps?
- Am I loading an aggregate to answer a question that only needs a number?

## 8. What this is not

- **Not a framework app.** No Express, no NestJS, no ORM, no container. The controller is a function with an HTTP-shaped input.
- **Not a transaction implementation.** The comment marks where the transaction opens and commits; [§18](02-layered-nuances.md#18-transaction-boundary-at-the-service) and [§21](02-layered-nuances.md#21-passing-the-tx-handle) show the handle passing.
- **Not an argument for an interface everywhere.** The use-case interface is optional; the repository port is structural; the domain service is a concrete class.
- **Not a complete domain.** One aggregate, one policy, no authorization, no events, no idempotency. Those have their own sections.
- **Not a claim that every system needs this shape.** A CRUD form over a table does not. This note is about the day the rules become the product.
