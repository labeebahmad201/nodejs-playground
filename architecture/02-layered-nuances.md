# Layered architecture — 42 nuances in code

*Companion to [02 — Layered architecture](02-layered-architecture.md). Each section has the rule, the correct code, the anti-pattern, and a short proof. The runnable versions live in [02-layered-example](02-layered-example/README.md).*

> This is a catalog, not a complete application. Read one section at a time. The snippets are deliberately small; the runnable lab has the full types, wiring, and tests.

**Conventions.** Every proof assumes `test` from `node:test`, `assert` from `node:assert/strict`, and `randomUUID` from `node:crypto`. `Order` is `{ id, total }` unless a section adds fields. Types such as `OrderRepository`, `Store`, and `FakeDb` are sketched only where the section needs them. The use-case/application-service/controller/domain-service distinction is defined in [08](#08-application-vs-domain-service).

**Scope.** This catalog is about **layered architecture**. Some sections borrow DDD vocabulary — aggregate, domain service, repository — because those concepts answer *where a rule or transaction lives*. They are optional lenses, not a requirement to adopt DDD. The words themselves — object, class, value object, entity, model, aggregate — are defined in [Appendix A](#appendix-a-the-vocabulary-object-class-value-object-entity-model-aggregate).

| If you are not doing DDD | Read it as |
| --- | --- |
| **Aggregate** | The object graph that must be consistent together |
| **Domain service** | A domain-layer operation that does not fit one entity; often a pure policy or function |
| **Repository** | The persistence abstraction |
| **Bounded context** | A module or capability boundary |

Layered architecture is a technical decomposition. DDD is a modeling discipline. They compose, but they are not the same thing.

## TL;DR — Judgment notes

*The short version. Each note links to the section that earns it.*

> **The one that changes the most designs:** separate aggregates mean separate transactions. A shared transaction couples their consistency, availability, schema, and deployment — and makes later extraction a distributed-transaction problem. [Details](#13a-aggregates-transactions-and-coupling)

**Structure**

- **A layer is a dependency rule, not a folder.** If persistence imports application, the layer names are a costume. [Details](#02-downward-dependency-rule)
- **A controller that computes business rules is a fat controller.** A service that only forwards is a sinkhole. [Details](#05-fat-controller) · [Details](#06-sinkhole)
- **Validation has three homes:** shape at the edge, invariants in the domain, uniqueness in the database. [Details](#09-where-validation-lives)
- **Anemic models are fine for CRUD.** They are a bug when the domain has invariants. [Details](#07-anemic-vs-rich-domain)
- **“We are one team” and faster AI edits do not erase two reasons to change.** The first lowers coordination cost; the second lowers typing cost. Neither lowers blast radius. [Details](#the-team-size-trap) · [Details](#change-cost-vs-blast-radius)

**Services and models**

- **Application services orchestrate use cases; domain services own rules that span entities.** [Details](#08-application-vs-domain-service)
- **A use case is a scenario; an application service implements it; the controller calls it.** [Details](#08-application-vs-domain-service)
- **The domain may know a repository port it owns, not the database.** Entities enforce invariants; application services load and save. [Details](#can-the-domain-call-the-repository)
- **Active Record is fine for CRUD; use a repository when the domain has invariants.** The trade-off is in [14a](#14a-active-record-vs-repository).
- **Map when the representation changes.** A cast is not a mapper. [Details](#12-mapping-between-layers)
- **Do not load an aggregate to render a summary.** Use a projection. [Details](#13-read-models-and-projections)
- **Add CQRS when reads and writes diverge.** Do not use one aggregate for a report. [Details](#41-when-to-add-cqrs)
- **One aggregate per transaction.** If the rule spans aggregates, it is a workflow, not a transaction. [Details](#13a-aggregates-transactions-and-coupling)

**Transactions**

- **The application service owns the transaction; the repository and domain service participate but never commit.** [Details](#18-transaction-boundary-at-the-service)
- **A domain service may read through a repository port, but it never saves or commits.** The application service owns the transaction. [Details](#domain-service-with-a-repository-read-dont-write)
- **Pass the tx handle to every write.** A default-connection write escapes the rollback. [Details](#21-passing-the-tx-handle)
- **An inner call either joins the caller’s transaction or gets a second connection; a savepoint is the third option.** A second `BEGIN` does not nest — it silently takes over the caller’s boundary. [Details](#22-nested-transactions)
- **Isolation is a visibility contract, not a safety switch.** `READ COMMITTED` plus a row lock covers most invariants; `SERIALIZABLE` without a retry loop just moves the failure to your users. [Details](#23-isolation-levels)
- **A retry is safe only when the operation is idempotent.** The same key must return the same result. [Details](#25-idempotency)

**Errors**

- **Catch only what you can handle or translate.** Otherwise let it propagate. [Details](#10-where-error-handling-lives)
- **Adapters translate vendor and driver errors.** The application and edge never see the raw error. [Details](#10-where-error-handling-lives)
- **Depend on the error contract you own, not on a vendor's error text.** [Details](#10-where-error-handling-lives)
- **Do not swallow.** A boolean or null hides the difference between duplicate, unavailable, and success. [Details](#10-where-error-handling-lives)

**Cross-cutting concerns**

- **Authentication is coarse and at the edge; authorization of a specific object is a domain rule.** A check in the controller has no object, and every new door must copy it. [Details](#29-authorization-placement)
- **Cache at the service boundary and invalidate on write.** The mechanism lives in `shared/`, the key and TTL policy in the module; delete the key, do not write a guess. [Details](#30-caching)
- `process.env` **read inside a method is a hidden collaborator.** Read and validate it once at startup, pass a typed config inward. [Details](#31-configuration)
- **Nothing constructs its own collaborators.** One composition root wires everything; constructor injection is the seam. [Details](#32-dependency-injection-and-wiring)
- **A** `shared/` **folder is fine; a file in it that imports a layer is not.** The shared kernel stays a leaf. [Details](#33-shared-utilities)
- **Write the event in the same transaction as the state change, then publish after commit.** An event emitted before commit can describe a state that never existed. [Details](#34-domain-events)
- **Tenant scoping belongs in the repository/query builder**, not in an optional service argument. [Details](#42-multi-tenancy)

**Testing**

- **Test each layer with a fake for the layer below.** Test adapters against the real dependency: same engine and version as production, schema from the real migrations. [Details](#35-unit-testing-per-layer) · [Details](#36-integration-testing-at-boundaries)
- **One contract suite, every provider.** A contract test replaces the endpoint, not the call. [Details](#37-contract-testing)

**Evolution and alternatives**

- **Layers are logical; tiers are deployment.** Splitting the deployment changes the composition root, not the service. [Details](#38-logical-layers-vs-physical-tiers)
- **A module is a public contract, not a folder.** Internal imports are boundary violations. [Details](#39-modular-monolith)

## Contents

### A. Structure and responsibilities

- [01. Four canonical layers](#01-four-canonical-layers)
- [02. Downward dependency rule](#02-downward-dependency-rule)
- [03. Strict vs. relaxed layers](#03-strict-vs-relaxed-layers)
- [04. Layer skipping](#04-layer-skipping)
- [05. Fat controller](#05-fat-controller)
- [06. Sinkhole](#06-sinkhole)
- [07. Anemic vs. rich domain](#07-anemic-vs-rich-domain)
- [08. Application vs. domain service](#08-application-vs-domain-service)
- [09. Where validation lives](#09-where-validation-lives)
- [10. Where error handling lives](#10-where-error-handling-lives)

### B. Models and data transformation

- [11. Entity, DTO, ViewModel, domain](#11-entity-dto-viewmodel-domain)
- [12. Mapping between layers](#12-mapping-between-layers)
- [13. Read models and projections](#13-read-models-and-projections)
- [13a. Aggregates, transactions, and coupling](#13a-aggregates-transactions-and-coupling)
- [14. Repository interface vs. implementation](#14-repository-interface-vs-implementation)
- [14a. Active Record vs. repository](#14a-active-record-vs-repository)
- [15. Pagination, filtering, sorting](#15-pagination-filtering-sorting)
- [16. N+1 queries](#16-n1-queries)
- [17. Batch operations](#17-batch-operations)

### C. Transactions and consistency

- [18. Transaction boundary at the service](#18-transaction-boundary-at-the-service)
- [19. Repository is transaction-agnostic](#19-repository-is-transaction-agnostic)
- [20. Callback-based unit of work](#20-callback-based-unit-of-work)
- [21. Passing the tx handle](#21-passing-the-tx-handle)
- [22. Nested transactions](#22-nested-transactions)
- [23. Isolation levels](#23-isolation-levels)
- [24. Optimistic vs. pessimistic locking](#24-optimistic-vs-pessimistic-locking)
- [25. Idempotency](#25-idempotency)
- [26. Distributed boundaries](#26-distributed-boundaries)
- [27. Eventual consistency](#27-eventual-consistency)

### D. Cross-cutting concerns

- [28. Logging placement](#28-logging-placement)
- [29. Authorization placement](#29-authorization-placement)
- [30. Caching](#30-caching)
- [31. Configuration](#31-configuration)
- [32. Dependency injection and wiring](#32-dependency-injection-and-wiring)
- [33. Shared utilities](#33-shared-utilities)
- [34. Domain events](#34-domain-events)

### E. Testing

- [35. Unit testing per layer](#35-unit-testing-per-layer)
- [36. Integration testing at boundaries](#36-integration-testing-at-boundaries)
- [37. Contract testing](#37-contract-testing)

### F. Evolution and alternatives

- [38. Logical layers vs. physical tiers](#38-logical-layers-vs-physical-tiers)
- [39. Modular monolith](#39-modular-monolith)
- [40. Migrating toward Clean/Hexagonal](#40-migrating-toward-cleanhexagonal)
- [41. When to add CQRS](#41-when-to-add-cqrs)
- [42. Multi-tenancy](#42-multi-tenancy)

### G. Appendix

- [Appendix A. The vocabulary: object, class, value object, entity, model, aggregate](#appendix-a-the-vocabulary-object-class-value-object-entity-model-aggregate)

## 01. Four canonical layers

**Rule.** Presentation parses input, application decides, persistence stores. Each layer has one job.

**Correct**

```ts
type Order = { id: string; customerEmail: string; total: number };

class OrderController {
  private readonly service: OrderService;
  constructor(service: OrderService) { this.service = service; }

  create(body: { customerEmail: string; total: number }): Order {
    if (!body.customerEmail.includes("@")) throw new Error("invalid email");
    return this.service.create(body.customerEmail, body.total);
  }
}

class OrderService {
  private readonly repository: OrderRepository;
  constructor(repository: OrderRepository) { this.repository = repository; }

  create(customerEmail: string, total: number): Order {
    if (total <= 0) throw new Error("total must be positive");
    const order = { id: randomUUID(), customerEmail, total };
    this.repository.save(order);
    return order;
  }
}

class InMemoryOrderRepository implements OrderRepository {
  private readonly rows: Order[] = [];
  save(order: Order): void { this.rows.push(order); }
  all(): readonly Order[] { return this.rows; }
}
```

**Anti-pattern**

```ts
class FatController {
  private readonly rows: Order[] = [];

  create(body: { customerEmail: string; total: number }): Order {
    if (!body.customerEmail.includes("@")) throw new Error("invalid email");
    if (body.total <= 0) throw new Error("total must be positive");
    const order = { id: randomUUID(), ...body };
    this.rows.push(order);
    return order;
  }

  count(): number { return this.rows.length; }
}
```

**Why the anti-pattern is bad.** The controller now owns three reasons to change: the HTTP shape, the business rule, and the storage. A CLI, a queue consumer, or a test cannot reuse the rule without duplicating it or going through the controller. Swapping the repository means editing presentation, and testing the rule requires the controller's private storage. The code looks shorter only because the layers are collapsed; the next change pays for it.

**Proof**

```ts
class SpyOrderService extends OrderService {
  calls = 0;
  constructor() { super(new InMemoryOrderRepository()); }
  override create(customerEmail: string, total: number): Order {
    this.calls += 1;
    return super.create(customerEmail, total);
  }
}

test("the controller delegates; the service is reusable without it", () => {
  const service = new SpyOrderService();
  const controller = new OrderController(service);

  controller.create({ customerEmail: "a@b.com", total: 42 });
  assert.equal(service.calls, 1); // presentation -> application

  service.create("b@c.com", 7);
  assert.equal(service.calls, 2); // the use case runs without HTTP

  const fat = new FatController();
  fat.create({ customerEmail: "c@d.com", total: 9 });
  assert.equal(fat.count(), 1);
  assert.equal("service" in fat, false); // its storage is the controller
});
```

## 02. Downward dependency rule

**Rule.** Presentation calls the use case; the use case calls the repository; the repository talks to the database. No arrow points back.

**The four names, concretely.**

- **Presentation** — `OrderController`: HTTP or CLI input.
- **Application / business** — `PlaceOrder`, `PricingService`: what the use case does.
- **Persistence** — `SqlOrderRepository`: how an order is saved and loaded.
- **Database** — `DatabaseSync` / SQLite: where the bytes live.

The database is not a code layer. It is the thing the repository talks to.

**A real flow**

```ts
// presentation/order-controller.ts
class OrderController {
  constructor(private readonly placeOrder: PlaceOrder) {}

  create(body: { customerEmail: string; total: number }): Order {
    return this.placeOrder.execute(body);
  }
}

// application/place-order.ts
class PlaceOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly pricing: PricingService,
  ) {}

  execute(command: { customerEmail: string; total: number }): Order {
    const order = Order.place(
      command.customerEmail,
      this.pricing.price(command.total),
    );
    this.orders.save(order);
    return order;
  }
}

// persistence/sql-order-repository.ts
class SqlOrderRepository implements OrderRepository {
  constructor(private readonly db: DatabaseSync) {}

  save(order: Order): void {
    this.db
      .prepare("INSERT INTO orders (id, total) VALUES (?, ?)")
      .run(order.id, order.total);
  }
}
```

The arrows:

```text
OrderController ──▶ PlaceOrder ──▶ OrderRepository
                         │
                         └──▶ PricingService

SqlOrderRepository ──▶ DatabaseSync
```

`OrderController` knows the use case. `PlaceOrder` knows the repository and pricing. `SqlOrderRepository` knows the database. None of them knows the layer above it.

**Anti-pattern**

```ts
// persistence/sql-order-repository.ts
import { PricingService } from "../application/pricing-service.ts";

class BadOrderRepository implements OrderRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly pricing: PricingService,
  ) {}

  save(order: Order): void {
    if (!this.pricing.isValid(order)) throw new Error("invalid order");
    this.db.prepare("INSERT INTO orders ...").run(...);
  }
}
```

**Why the anti-pattern is bad.** The repository now imports a business service to decide whether an order is valid. `PlaceOrder` already depends on the repository, so the dependency graph has a cycle: application → persistence and persistence → application. The repository cannot be tested with a database alone; you need the pricing service. The pricing rule is now enforced in persistence, so a change to pricing can require a change to the repository. **The persistence layer is no longer replaceable in isolation.**

**Proof**

```ts
const db = new DatabaseSync(":memory:");
db.exec("CREATE TABLE orders (id TEXT PRIMARY KEY, total INTEGER NOT NULL)");

// The correct repository needs only the database.
const repository = new SqlOrderRepository(db);
repository.save(Order.place("a@b.com", 42));

// The bad repository calls business logic while saving.
const bad = new BadOrderRepository(db, new PricingService());
const invalid = { id: "o-1", total: -1 } as Order;
assert.throws(() => bad.save(invalid), /invalid order/);
```

The proof shows the extra dependency: `SqlOrderRepository` can be constructed with a database alone; `BadOrderRepository` needs a `PricingService`, and it runs a business rule inside `save`.

In a real project, you would also enforce the direction with an import check — dependency-cruiser, ArchUnit, Nx module boundaries, Packwerk — so `persistence` cannot import `application`.

## 03. Strict vs. relaxed layers

**Rule.** A strict layer calls only the next layer down. A relaxed layer may skip one. Relaxed is safe for a read with no policy; it is a smell for a write.

**Correct**

```ts
class StrictWriteController {
  private readonly service: OrderService;
  constructor(service: OrderService) { this.service = service; }
  create(order: Order): void { this.service.create(order); }
}

class RelaxedReadController {
  private readonly repository: OrderRepository;
  constructor(repository: OrderRepository) { this.repository = repository; }
  list(): readonly Order[] { return this.repository.list(); }
}
```

**Anti-pattern**

```ts
class RelaxedWriteController {
  private readonly repository: OrderRepository;
  constructor(repository: OrderRepository) { this.repository = repository; }
  create(order: Order): void { this.repository.save(order); }
}
```

**Proof**

```ts
const repository = new OrderRepository();
const service = new OrderService(repository);
const order = { id: "o-1", total: 10 };

new StrictWriteController(service).create(order);
assert.equal(service.auditCalls, 1);
assert.equal(repository.saveCalls, 1);

new RelaxedReadController(repository).list();
assert.equal(service.auditCalls, 1); // the read skipped the service

new RelaxedWriteController(repository).create(order);
assert.equal(service.auditCalls, 1); // no audit for the skipped write
assert.equal(repository.saveCalls, 2);
```

## 04. Layer skipping

**Rule.** Skipping is a decision, not an accident. Allow it for read-only paths that need no policy; forbid it for writes that need validation, authorization, or a transaction.

**Correct**

```ts
function maySkipService(operation: "read" | "write"): boolean {
  return operation === "read";
}

class ReadController {
  private readonly repository: OrderRepository;
  constructor(repository: OrderRepository) { this.repository = repository; }
  list(): readonly Order[] { return this.repository.list(); }
}

class WriteController {
  private readonly service: OrderService;
  constructor(service: OrderService) { this.service = service; }
  create(order: Order): void { this.service.create(order); }
}
```

**Anti-pattern**

```ts
class WriteControllerSkippingService {
  private readonly repository: OrderRepository;
  constructor(repository: OrderRepository) { this.repository = repository; }

  create(order: Order): void {
    this.repository.save(order); // no validation, no transaction, no audit
  }
}
```

**Proof**

```ts
const repository = new OrderRepository();

assert.equal(maySkipService("read"), true);
assert.equal(maySkipService("write"), false);

const skipped = new WriteControllerSkippingService(repository);
skipped.create({ id: "o-1", total: -1 });
assert.equal(repository.list().length, 1); // the invalid order was saved

assert.throws(
  () => new WriteController(new OrderService(repository)).create({ id: "o-2", total: -1 }),
  /positive/,
);
```

## 05. Fat controller

**Rule.** The controller parses and delegates. It does not own pricing, eligibility, or persistence rules.

**Correct**

```ts
class CheckoutService {
  private readonly discounts: Record<"standard" | "vip", number>;
  constructor(discounts: Record<"standard" | "vip", number>) {
    this.discounts = discounts;
  }
  price(tier: "standard" | "vip", total: number): number {
    if (total <= 0) throw new Error("total must be positive");
    return total * this.discounts[tier];
  }
}

class ThinController {
  private readonly service: CheckoutService;
  constructor(service: CheckoutService) { this.service = service; }
  create(body: { tier: "standard" | "vip"; total: number }) {
    return { total: this.service.price(body.tier, body.total) };
  }
}
```

**Anti-pattern**

```ts
class FatController {
  create(body: { tier: "standard" | "vip"; total: number }) {
    if (body.total <= 0) throw new Error("total must be positive");
    const total = body.tier === "vip" ? body.total * 0.9 : body.total;
    return { total };
  }
}
```

**Proof**

```ts
const service = new CheckoutService({ standard: 1, vip: 0.8 });
assert.equal(new ThinController(service).create({ tier: "vip", total: 100 }).total, 80);
assert.equal(new FatController().create({ tier: "vip", total: 100 }).total, 90);
// The policy changed to 0.8; the controller still says 0.9.
```

## 06. Sinkhole

**Rule.** A layer that only forwards adds cost without value. Either it enforces a rule, owns a transaction, or translates something — or it should disappear.

**Correct**

```ts
class OrderService {
  private readonly repository: OrderRepository;
  private readonly audit: AuditLog;
  constructor(repository: OrderRepository, audit: AuditLog) {
    this.repository = repository;
    this.audit = audit;
  }

  place(order: Order): void {
    if (order.total <= 0) throw new Error("total must be positive");
    this.repository.save(order);
    this.audit.record(order.id);
  }
}
```

**Anti-pattern**

```ts
class PassThroughService {
  private readonly repository: OrderRepository;
  constructor(repository: OrderRepository) { this.repository = repository; }

  place(order: Order): void {
    this.repository.save(order);
  }
}
```

**Proof**

```ts
const repository = new OrderRepository();
const audit = new AuditLog();
new OrderService(repository, audit).place({ id: "o-1", total: 10 });

assert.deepEqual(repository.saved, ["o-1"]);
assert.deepEqual(audit.entries, ["o-1"]);

new PassThroughService(repository).place({ id: "o-2", total: -1 });
assert.deepEqual(repository.saved, ["o-1", "o-2"]); // the invalid order was saved
```

## 07. Anemic vs. rich domain

**Rule.** If a rule protects an invariant, put it on the object that owns the invariant. A service that mutates a record owns nothing.

**What the words mean.**

- An **anemic model** is a record: public fields, no behavior, no rules.
- A **rich model** is an object: private state, behavior, and invariants.
- An **invariant** is a condition that must always be true — `total > 0`, `0 <= discount <= 1`, a cancelled order cannot be paid.

**Correct**

```ts
class Order {
  private currentTotal: number;
  private constructor(total: number) { this.currentTotal = total; }

  static create(total: number): Order {
    if (total <= 0) throw new Error("total must be positive");
    return new Order(total);
  }

  applyDiscount(rate: number): void {
    if (rate < 0 || rate > 1) throw new Error("discount must be between 0 and 1");
    this.currentTotal *= 1 - rate;
  }

  get total(): number { return this.currentTotal; }
}
```

**Anti-pattern**

```ts
type AnemicOrder = { total: number };

class AnemicOrderService {
  applyDiscount(order: AnemicOrder, rate: number): void {
    order.total = order.total * (1 - rate);
  }
}

class LoyaltyDiscountService {
  applyLoyaltyDiscount(order: AnemicOrder, rate: number): void {
    order.total = order.total - rate; // a different rule, in a different place
  }
}
```

**Why the anti-pattern is bad.**

- **The invariant is optional.** `AnemicOrder` is `{ total: number }`; any code can create `{ total: -1 }` or set `order.total = -500`.
- **The rule is duplicated.** `AnemicOrderService` and `LoyaltyDiscountService` each implement a discount differently; the object cannot enforce one rule.
- **The object can be invalid between calls.** A caller can pass the same order to two services and skip the one it does not like.
- **The domain model is a persistence record.** It has no behavior, so the rules scatter across services and callers.
- **Tests must know which service to call.** They cannot test the object's invariant directly.

The rich model makes the invariant part of the type: the constructor is private, `total` is read-only from outside, and every state change goes through a method that validates. There is no valid `Order` with a negative total.

**When anemic is fine.** A pure CRUD/admin panel with no real invariants can use a record plus a transaction script. The trade-off is not “anemic is always wrong”; it is “anemic is wrong when the domain has rules that the record cannot protect.”

A domain service is legitimate when a rule spans multiple objects or needs an external policy. It is not a license to pull every single-object invariant out of the object.

**Proof**

```ts
const rich = Order.create(100);
rich.applyDiscount(0.2);
assert.equal(rich.total, 80);
assert.throws(() => rich.applyDiscount(2), /between 0 and 1/);
// rich.total = -500; // type error: the state is read-only

const anemic: AnemicOrder = { total: 100 };
new AnemicOrderService().applyDiscount(anemic, 2);
assert.equal(anemic.total, -100); // the invariant is not owned

anemic.total = -500; // the type system allows it
assert.equal(anemic.total, -500);

const second: AnemicOrder = { total: 100 };
new LoyaltyDiscountService().applyLoyaltyDiscount(second, 30);
assert.equal(second.total, 70); // a different rule, in a different service
```

## 08. Application vs. domain service

**Rule.** The application service orchestrates a use case. **Domain services enforce domain rules that do not belong to a single entity.** The application service composes; it does not absorb.

**Use case vs. application service.** These are different levels of description, not two objects that call each other.

- A **use case** is the scenario or goal: “place an order.” It is a behavior, not a class.
- An **application service** is the code that executes it. `PlaceOrderService` is the use-case implementation.
- The **controller** calls the application service.
- The use case does **not** call the application service. The application service implements the use case.

| Term | What it is | Example |
| --- | --- | --- |
| **Use case** | The scenario or goal | “Place an order” |
| **Application service** | The code that runs the use case | `PlaceOrderService.execute()` |
| **Input port** | Optional contract for the use case | `PlaceOrderUseCase` |
| **Controller** | Driving adapter that invokes it | `OrderController` |
| **Domain service** | A rule that spans entities | `PricingService` |
| **Entity** | Owns its own invariants | `Order` |

```ts
interface PlaceOrderUseCase {
  execute(command: PlaceOrderCommand): Promise<OrderId>;
}

class PlaceOrderService implements PlaceOrderUseCase {
  async execute(command: PlaceOrderCommand): Promise<OrderId> {
    // orchestrate the use case
  }
}

class OrderController {
  constructor(private readonly placeOrder: PlaceOrderUseCase) {}

  async create(body: PlaceOrderBody): Promise<{ id: string }> {
    return { id: await this.placeOrder.execute(body) };
  }
}
```

`PlaceOrderService` is the application service. It is also the use-case implementation. `PlaceOrderUseCase` is an optional contract, not a separate object that calls the service. The controller calls the contract.

The analogy: the use case is the recipe; the application service is the cook; the controller is the waiter. The recipe does not call the cook. The cook follows the recipe. The waiter hands the order to the cook.

“Service” is overloaded: an **application service** coordinates a use case, a **domain service** enforces a domain rule, and an **infrastructure service** adapts an external system. The layer and role matter, not the word.

An application service can expose multiple use cases (`OrderApplicationService.place/cancel/refund`) or one class per use case (`PlaceOrder`, `CancelOrder`). Both are valid; the trade-off is cohesion versus class count.

**What the two services are.**

|  | Application service | Domain service |
| --- | --- | --- |
| **Job** | Run one use case: load, call, save, emit | Enforce a domain rule that spans objects or needs a policy |
| **Knows about** | Transactions, authorization, ports, workflow | Domain concepts: pricing, eligibility, inventory policy |
| **Does not own** | Domain rules that belong elsewhere | Transactions, HTTP, the application workflow |
| **Example** | `CheckoutApplicationService` | `PricingService`, `InventoryService` |

A domain service is not a use case. It is a domain concept that does not naturally sit on one entity. If the rule belongs to one entity, put it on the entity (section 07).

**Correct**

```ts
interface PricingService { price(base: number): number; }
interface InventoryService { reserve(sku: string, quantity: number): void; }

class CheckoutApplicationService {
  private readonly pricing: PricingService;
  private readonly inventory: InventoryService;
  constructor(pricing: PricingService, inventory: InventoryService) {
    this.pricing = pricing;
    this.inventory = inventory;
  }

  checkout(base: number, sku: string): { total: number } {
    const total = this.pricing.price(base);
    this.inventory.reserve(sku, 1);
    return { total };
  }
}

class VipPricingService implements PricingService {
  price(base: number): number {
    return base > 100 ? base * 0.9 : base;
  }
}
```

**Anti-pattern**

```ts
class FatCheckoutApplicationService {
  private readonly inventory: InventoryService;
  constructor(inventory: InventoryService) { this.inventory = inventory; }

  checkout(base: number, sku: string): { total: number } {
    const total = base > 100 ? base * 0.9 : base; // pricing rule trapped here
    this.inventory.reserve(sku, 1);
    return { total };
  }
}
```

**Why the anti-pattern is bad.**

- **The pricing rule is not reusable.** A quote, refund, or subscription use case cannot call it; it duplicates the `base > 100` ternary.
- **The rule cannot be tested alone.** Testing pricing requires the checkout use case and an inventory dependency.
- **The rule is coupled to one channel.** A different channel, customer tier, or promotion requires editing checkout.
- **The application service becomes a god service.** Every use case adds its own rules; the class grows without a boundary.
- **The domain service disappears.** Pricing is a domain concept with tiers, coupons, tax, and currency; it is not a ternary in a workflow.

Orchestration is allowed: the application service can own the transaction, authorization, idempotency, and the order of calls. What it should not own is a domain rule that another use case also needs.

Not every calculation needs a domain service. A trivial one-off can stay in the use case. The smell is a **domain policy** — pricing, eligibility, tax — trapped in a workflow.

**Proof**

```ts
class FakePricing implements PricingService {
  price(_base: number): number { return 42; }
}

class RecordingInventory implements InventoryService {
  readonly reserved: string[] = [];
  reserve(sku: string, _quantity: number): void { this.reserved.push(sku); }
}

const inventory = new RecordingInventory();
const service = new CheckoutApplicationService(new FakePricing(), inventory);

assert.equal(service.checkout(1000, "sku-1").total, 42); // pricing is swappable
assert.deepEqual(inventory.reserved, ["sku-1"]);

const fat = new FatCheckoutApplicationService(inventory);
assert.equal(fat.checkout(1000, "sku-2").total, 900); // hardcoded
// There is no PricingService to inject or test.
```

## 09. Where validation lives

**Rule.** Presentation — the controller plus its DTO and validation pipe — validates shape. The domain validates invariants. Persistence validates uniqueness and constraints. Each layer rejects what it owns.

**NestJS note: the DTO is presentation, not the domain.** A `CreateOrderDto` with `class-validator` decorators is still the presentation layer. The `ValidationPipe` runs before the controller method and rejects malformed input; the controller stays thin. That is the same rule, implemented by the framework.

```ts
class CreateOrderDto {
  @IsEmail() customerEmail!: string;
  @IsInt() @Min(1) total!: number;
}

@Post()
create(@Body() dto: CreateOrderDto) {
  return this.orders.create(dto.customerEmail, dto.total);
}
```

The DTO validates **shape and format**: required fields, email syntax, integer range, string length, enum membership. It should not validate a **domain invariant** that depends on domain state — credit limit, stock availability, “this order can be cancelled” — because the same use case can be called from a queue, a CLI, or a test, and those callers bypass the DTO. The domain check is the guarantee; the DTO check is the friendly early error.

Do not put a repository call in a DTO validator such as `@IsUniqueEmail`. That is a persistence rule, it races with concurrent requests, and it makes the transport depend on the database. Use a unique constraint and translate the error in the repository or adapter.

| Validation | Example | Home |
| --- | --- | --- |
| **Shape / format** | email syntax, `total` is an integer | DTO + validation pipe (presentation) |
| **Domain invariant** | `total > 0`, discount 0..1 | entity or value object |
| **Use-case rule** | customer exists, credit limit | application service |
| **Uniqueness** | email is unique | database constraint; repository translates |
| **Authorization** | user may refund this order | edge (coarse) + domain policy (fine) |

The inline controller check below is the dependency-free equivalent; in NestJS, the email check moves into `CreateOrderDto`.

**Correct**

```ts
class OrderController {
  private readonly service: OrderService;
  constructor(service: OrderService) { this.service = service; }

  create(body: { customerEmail: string; total: number }): Order {
    if (!body.customerEmail.includes("@")) throw new Error("presentation: invalid email");
    return this.service.create(body.customerEmail, body.total);
  }
}

class OrderModel {
  static create(customerEmail: string, total: number): Order {
    if (total <= 0) throw new Error("domain: total must be positive");
    return { id: randomUUID(), customerEmail, total };
  }
}

class OrderRepository {
  private readonly emails = new Set<string>();
  save(order: Order): void {
    if (this.emails.has(order.customerEmail)) throw new Error("persistence: duplicate order");
    this.emails.add(order.customerEmail);
  }
}
```

**Anti-pattern**

```ts
class FatValidationController {
  private readonly rows: Order[] = [];

  create(body: { customerEmail: string; total: number }): Order {
    if (!body.customerEmail.includes("@")) throw new Error("invalid email");
    if (body.total <= 0) throw new Error("total must be positive");
    const order = { id: randomUUID(), ...body };
    this.rows.push(order);
    return order;
  }
}
```

**Proof**

```ts
const controller = new OrderController(new OrderService(new OrderRepository()));
assert.throws(() => controller.create({ customerEmail: "nope", total: 10 }), /invalid email/);
assert.throws(() => controller.create({ customerEmail: "a@b.com", total: -1 }), /positive/);

controller.create({ customerEmail: "a@b.com", total: 10 });
assert.throws(
  () => controller.create({ customerEmail: "a@b.com", total: 20 }),
  /duplicate/,
);

const fat = new FatValidationController();
fat.create({ customerEmail: "a@b.com", total: 10 });
assert.doesNotThrow(() => fat.create({ customerEmail: "a@b.com", total: 20 }));
// The duplicate was accepted because persistence has no constraint.
```

## 10. Where error handling lives

**Rule.** Each layer throws the error it owns. The edge maps errors to transport statuses. The domain never imports HTTP, and the application never imports the vendor SDK.

**Who throws what.**

| Error | Example | Thrown by | Edge maps to |
| --- | --- | --- | --- |
| **Shape** | invalid email, `total` is not an integer | DTO + validation pipe | `400` |
| **Domain invariant** | `total <= 0`, invalid status transition | entity / domain service | `422` or `409` |
| **Use case** | order not found, stale version, forbidden | application service | `404` / `409` / `403` |
| **Dependency** | payment declined, provider unavailable, timeout | adapter translates; application decides | `402` / `503` / `202` |
| **Persistence** | unique constraint, foreign key | database; repository translates | `409` / `422` |
| **Programming** | null dereference, broken invariant | anywhere | `500` + alert |

The point is not “the controller catches everything.” The point is that the type crossing each boundary belongs to that boundary.

**Correct**

```ts
class InvalidOrder extends Error {}
class OrderNotFound extends Error {}
class DatabaseUnavailable extends Error {}

function toHttpStatus(error: unknown): number {
  if (error instanceof InvalidOrder) return 422;
  if (error instanceof OrderNotFound) return 404;
  if (error instanceof DatabaseUnavailable) return 503;
  return 500;
}
```

**Anti-pattern**

```ts
class HttpAwareDomainError extends Error {
  readonly status = 422; // the domain now knows HTTP
}

function badToHttpStatus(_error: unknown): number {
  return 500; // every failure becomes an opaque server error
}
```

**Proof**

```ts
assert.equal(toHttpStatus(new InvalidOrder()), 422);
assert.equal(toHttpStatus(new OrderNotFound()), 404);
assert.equal(toHttpStatus(new DatabaseUnavailable()), 503);

assert.equal(badToHttpStatus(new HttpAwareDomainError()), 500);
```

## Third-party calls: the adapter translates, the application decides, the edge maps

The adapter is the only place that knows Stripe/Axios. It catches the vendor error and returns or throws a port error.

```ts
type PaymentFailure =
  | { kind: "declined"; reason: string }
  | { kind: "unavailable"; retryable: boolean }
  | { kind: "timeout"; ambiguous: boolean }
  | { kind: "unexpected"; cause: unknown };

type PaymentResult =
  | { ok: true; paymentId: string }
  | { ok: false; failure: PaymentFailure };

interface PaymentGateway {
  charge(input: ChargeInput): Promise<PaymentResult>;
}

class StripeAdapter implements PaymentGateway {
  async charge(input: ChargeInput): Promise<PaymentResult> {
    try {
      const charge = await stripe.charges.create({
        amount: input.amount.cents,
        currency: input.amount.currency,
        source: input.token,
        idempotencyKey: input.idempotencyKey,
      });
      return { ok: true, paymentId: charge.id };
    } catch (error) {
      if (isCardError(error)) {
        return { ok: false, failure: { kind: "declined", reason: error.message } };
      }
      if (isTimeout(error)) {
        return { ok: false, failure: { kind: "timeout", ambiguous: true } };
      }
      if (isRetryable(error)) {
        return { ok: false, failure: { kind: "unavailable", retryable: true } };
      }
      return { ok: false, failure: { kind: "unexpected", cause: error } };
    }
  }
}
```

The application service handles the port outcomes:

```ts
const result = await this.payments.charge(input);
if (!result.ok) {
  switch (result.failure.kind) {
    case "declined":
      order.markPaymentFailed(result.failure.reason);
      break;
    case "unavailable":
      order.markPaymentPending(); // retry later
      break;
    case "timeout":
      order.markPaymentUnknown(); // do not blindly retry
      break;
    case "unexpected":
      throw new PaymentUnexpected(result.failure.cause);
  }
}
```

The edge mapper is the **same** `toHttpStatus` **from above**. Add the dependency branches to it:

```ts
if (error instanceof PaymentDeclined) return 402;
if (error instanceof PaymentUnavailable) return 503;
if (error instanceof PaymentTimeout) return 202;
```

**Where it lives.** At the edge: `presentation/http/error-mapper.ts`, an exception filter, or an error middleware. It is one function for the whole edge, not one per adapter. The controller or filter calls it; the domain and application do not know it exists.

**Mapper vs. handler.** `toHttpStatus` is the policy: error type → status. The handler is the mechanism: catch the error, call the mapper, log, and write the response. In NestJS that is a global exception filter; in Express, an error-handling middleware; in a plain controller, a small `try/catch`. One handler at the edge, not one per adapter.

```ts
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(toHttpStatus(error)).json(toErrorBody(error));
  }
}
```

`toErrorBody` is the second half of the mapper: it turns the error into a safe `{ code, message }` body. A status alone is not enough, and the body must not leak stack traces, SQL, or vendor details.

**The translation chain.** Translation and handling are different. The adapter translates the driver/vendor error into a port error; the application service translates the port error into a use-case error, or handles it; the edge maps the use-case/domain error to HTTP.

```ts
// adapter: database error -> port error
try {
  await this.db.insert(order);
} catch (error) {
  if (isUniqueViolation(error)) throw new DuplicateOrder(order.id);
  if (isConnectionError(error)) throw new RepositoryUnavailable(error);
  throw new RepositoryUnexpected(error);
}

// application: port error -> use-case error, or handle it
try {
  await this.orders.save(order);
} catch (error) {
  if (error instanceof DuplicateOrder) throw new OrderAlreadyExists(order.id);
  throw error;
}

// edge: use-case/domain error -> HTTP
if (error instanceof OrderAlreadyExists) return 409;
if (error instanceof RepositoryUnavailable) return 503;
```

The upper layer still depends on the port’s error **categories** — `DuplicateOrder`, `RepositoryUnavailable`, `RepositoryUnexpected`. It does not depend on the driver’s codes. That is explicit coupling to a contract, not hidden coupling to an implementation.

**Catch only what you can handle or translate.** If you cannot name the error in your own vocabulary, it is not yours to catch. The tempting shortcut is to catch the repository error and return a boolean or `null` so the caller does not have to deal with it:

```ts
// bad: the reason is gone
async save(order: Order): Promise<boolean> {
  try {
    await this.db.insert(order);
    return true;
  } catch {
    return false;
  }
}

const saved = await this.orders.save(order);
if (!saved) return null; // caller sees “not found”, not “database down”
```

This is worse than throwing. The failure becomes a normal result, and the caller cannot distinguish a duplicate from an unavailable database. The error is swallowed.

**If you cannot handle it, do not catch it.** Let it propagate. The layer above may be able to translate it; the edge is the last resort. The edge maps known errors and returns `500` for unknown errors. It does not swallow them either.

```ts
// bad: swallow
try {
  await this.orders.save(order);
} catch {
  // ignore
}

// bad: turn a failure into a normal result
try {
  await this.orders.save(order);
} catch {
  return null;
}

// good: add context and rethrow
try {
  await this.orders.save(order);
} catch (error) {
  throw new OrderPersistenceFailed("could not save order", { cause: error });
}
```

If you catch only to log and continue, you have converted a failure into silent data loss. If you catch to add context, rethrow with `cause`. If you catch to translate, throw the translated error. If you can do none of those, do not catch.

**At the edge.** HTTP maps known errors and returns `500` for unknown errors. A queue worker marks the job failed, retries, or dead-letters it; it does not acknowledge a failed job. A CLI exits non-zero. A cron job alerts. The edge is the last translator, not a place to swallow.

**The only exception.** A truly best-effort, non-critical side effect — metrics, telemetry, a cache warm-up — may be caught and logged. It must be explicit, bounded, and never on the critical path. Business writes, payments, and messages are not best-effort.

**Hidden coupling.** The same problem appears when the upper layer catches the vendor error directly:

```ts
// bad: the application knows SQLite
try {
  await this.orders.save(order);
} catch (error) {
  if (String(error).includes("SQLITE_CONSTRAINT")) {
    throw new OrderAlreadyExists(order.id);
  }
}
```

If you move to Postgres, the message changes and the branch silently stops working. The application’s behavior depends on a vendor string it does not own. That is hidden coupling: the dependency is real but absent from the interface.

**Couple to what you own.** The port owns the error categories; the adapter owns the translation; the application owns the use-case decision; the edge owns the HTTP mapping.

```ts
// The port is owned by the application.
class DuplicateOrder extends Error {}
class RepositoryUnavailable extends Error {}
class RepositoryUnexpected extends Error {}

interface OrderRepository {
  save(order: Order): Promise<void>;
}

// The adapter owns the vendor translation.
class SqlOrderRepository implements OrderRepository {
  async save(order: Order): Promise<void> {
    try {
      await this.db.insert(order);
    } catch (error) {
      if (isUniqueViolation(error)) throw new DuplicateOrder(order.id);
      if (isConnectionError(error)) {
        throw new RepositoryUnavailable("database unavailable", { cause: error });
      }
      throw new RepositoryUnexpected("save failed", { cause: error });
    }
  }
}
```

The application can now catch `DuplicateOrder` and turn it into `OrderAlreadyExists`. It never sees `SQLITE_CONSTRAINT`. The edge maps `OrderAlreadyExists` to `409` and `RepositoryUnavailable` to `503`. If the database changes, only the adapter changes.

That is the rule: **depend on the error contract you own, not on the error text of a system you do not control.**

**What not to do.**

```ts
// 1. The adapter leaks the vendor error.
catch (error) { throw error; } // StripeError crosses the port

// 2. The application catches the vendor type.
catch (error) { if (error.type === "card_error") ... }

// 3. The controller catches the HTTP client error.
catch (error) { if (error.isAxiosError) return 500; }
```

If the vendor detail is useful for support, keep it as `cause` or log it at the adapter. Do not make it the control-flow type outside the adapter.

**Unknown errors.** If the adapter cannot classify the error, wrap it as `unexpected` with `cause`. The application can map it to a use-case failure or let it bubble. The edge returns `500` and alerts. Do not swallow it, and do not pretend a system failure is a business decline.

**Retries.** Transient errors (`timeout`, `5xx`, rate limit) can be retried at the adapter or a resilience decorator with an idempotency key. Terminal errors (`declined`, invalid request) are not retried. The adapter does not retry a declined card; the application decides whether the use case can be retried.

Do not hold a database transaction across the network call. Use an outbox or a saga (sections 26 and 27) so the provider call and the local state have a defined failure path.

## 11. Entity, DTO, ViewModel, domain

**Rule.** Each layer gets the shape it needs. The persistence row is not the domain object, and the domain object is not the JSON response.

**What the four shapes are.**

| Shape | Example | Purpose | Owns |
| --- | --- | --- | --- |
| **Persistence row** | `OrderRow` | Map the table | snake_case, cents, internal columns |
| **Domain entity** | `Order` | Protect invariants | identity, behavior |
| **DTO** | `OrderDto` | Carry data across a boundary | transport fields, no behavior |
| **ViewModel** | `OrderView` | Render for a screen | formatting, labels, derived fields |

The word **entity** is overloaded. An ORM entity is a row (`OrderRow`). A DDD entity is a domain object with identity and behavior (`Order`). Look at the layer, not the name.

**Correct**

```ts
type OrderRow = {
  id: string;
  customer_email: string;
  total_cents: number;
  internal_note: string;
};

type Order = { id: string; customerEmail: string; total: number };
type OrderDto = { id: string; customerEmail: string; total: number };
type OrderView = { id: string; total: string };

function rowToDomain(row: OrderRow): Order {
  return {
    id: row.id,
    customerEmail: row.customer_email,
    total: row.total_cents / 100,
  };
}

function toDto(order: Order): OrderDto {
  return {
    id: order.id,
    customerEmail: order.customerEmail,
    total: order.total,
  };
}

function toView(dto: OrderDto): OrderView {
  return { id: dto.id, total: `$${dto.total.toFixed(2)}` };
}
```

**Anti-pattern**

```ts
function leakyView(row: OrderRow): Record<string, unknown> {
  return { ...row, total: row.total_cents };
}
```

**Why the anti-pattern is bad.**

- **It leaks internal fields.** `internal_note` crosses the boundary; a real row might also contain cost, flags, or PII.
- **It leaks the units.** `1234` cents becomes `total: 1234`, which the UI reads as `$1,234.00` instead of `$12.34`.
- **The API becomes the table.** Adding, renaming, or removing a column silently changes the response.
- **There is no formatting step.** Currency, locale, and labels are pushed to every client, or duplicated.
- **There is no validation.** The row can contain states the domain forbids; the view exposes them anyway.
- **It changes for the wrong reason.** A schema migration and a UI change now edit the same function.

**When one shape is fine.** A tiny CRUD/admin endpoint where the row and the view are genuinely identical — no internal fields, no unit conversion, no formatting — can use one shape. The separation is a trade-off; do not create four types for a trivial form. The moment one of those differences appears, split the shape.

**Proof**

```ts
const row: OrderRow = {
  id: "o-1", customer_email: "ada@example.com",
  total_cents: 1234, internal_note: "fraud review",
};

const view = toView(toDto(rowToDomain(row)));
assert.deepEqual(view, { id: "o-1", total: "$12.34" });
assert.equal("internal_note" in view, false);
assert.equal("total_cents" in view, false);

const leaked = leakyView(row);
assert.equal(leaked.internal_note, "fraud review"); // internal field
assert.equal(leaked.customer_email, "ada@example.com"); // schema shape
assert.equal(leaked.total, 1234); // cents presented as dollars
```

## 12. Mapping between layers

**Rule.** Map explicitly when a **technical boundary** changes the representation. A cast does not convert units, parse dates, or validate shape.

**Technical boundary, not capability boundary.** This section is about the horizontal boundary between layers and adapters: HTTP vs. application, domain vs. row, vendor vs. port. A capability boundary — Orders vs. Payments — is a different thing: it decides what may cross and who owns the data. A mapper can serve both, but the reason is different.

| Crossing | Mapper? | Why |
| --- | --- | --- |
| HTTP DTO → command | Usually | Transport shape vs. use-case shape |
| Command → domain object | Often no | The application constructs domain objects directly |
| Domain object → row | Yes, in the repository adapter | Schema, units, internal columns |
| Domain object → view | Yes, in the presenter | Formatting, omit internals |
| Domain object → event | Yes, at the event adapter | Stable contract, versioning |
| Vendor model → port | Yes, in the adapter | Vendor types must not leak |
| Module A → module B | Public contract or ACL, not a layer mapper | Capability boundary, data ownership |

A mapper is a **seam**, not a tax on every call. If the representation is identical and no type must be hidden, passing the value through is fine. The cast is never fine.

**Where the mapper lives.** The mapper is an outer-layer function. It imports the row and the domain; neither imports it. A reasonable layout:

```text
src/
  domain/order.ts
  persistence/
    order.row.ts          // OrderRow
    order.mapper.ts       // rowToDomain
    sql-order-repository.ts
  presentation/
    order.view.ts         // OrderView
    order.presenter.ts    // toView
```

The repository calls `rowToDomain`; the presenter calls `toView`. The domain never imports `order.mapper` or `order.row`.

**Function, private method, or class?** All three are valid:

- a free function in `persistence/order.mapper.ts` — small, testable, no `this`;
- a private method on `SqlOrderRepository` — the mapping is an implementation detail;
- a dedicated `OrderMapper` class with `toDomain` / `toRow` — common in Java/C#.

What is not valid in a strict hexagonal design is putting `toDomain` on the domain entity (`Order.fromRow(row)`): the domain would import the persistence row. A static factory is acceptable only if the “row” is a domain DTO and you accept the coupling; it is a trade-off, not the default.

**Same file or separate?**

- **Same file as the repository** when the mapper is small and has one consumer. `function rowToDomain` sits next to `SqlOrderRepository`.
- **Adjacent** `order.mapper.ts` when the mapper is non-trivial, tested directly, or used by more than one repository method or adapter.
- **A shared mapper** only within the same persistence module, and only if multiple adapters use the same row shape. Do not create a global `common/mappers` folder; it becomes a hub and couples unrelated modules.

**Repository-specific by default.** The row is a persistence detail; the mapper belongs to the adapter. The port (`OrderRepository`) deals only in domain types and never mentions `OrderRow`.

```ts
// infrastructure/persistence/order.mapper.ts
import type { OrderRow } from "./order.row.ts";
import { Order } from "../../domain/order.ts";

export function rowToDomain(row: OrderRow): Order {
  // ...
}

export function domainToRow(order: Order): OrderRow {
  // ...
}
```

```ts
// infrastructure/persistence/sql-order-repository.ts
import { domainToRow, rowToDomain } from "./order.mapper.ts";

class SqlOrderRepository implements OrderRepository {
  async findById(id: string): Promise<Order | null> {
    const row = await this.db.findOrderRow(id);
    return row ? rowToDomain(row) : null;
  }

  async save(order: Order): Promise<void> {
    await this.db.upsertOrder(domainToRow(order));
  }
}
```

The repository interface never sees `OrderRow`:

```ts
// application/ports/order-repository.ts
interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
}
```

**Correct**

```ts
type OrderRow = { id: string; created_at: string; total_cents: number };
type Order = { id: string; createdAt: Date; total: number };

export function rowToDomain(row: OrderRow): Order {
  const createdAt = new Date(row.created_at);
  if (Number.isNaN(createdAt.getTime())) throw new Error("invalid created_at");
  return {
    id: row.id,
    createdAt,
    total: row.total_cents / 100,
  };
}

class SqlOrderRepository {
  findById(id: string): Order | null {
    const row = this.db
      .prepare("SELECT id, created_at, total_cents FROM orders WHERE id = ?")
      .get(id) as OrderRow | undefined;

    return row ? rowToDomain(row) : null;
  }
}
```

**Anti-pattern**

```ts
function leakyMap(row: OrderRow): Order {
  return {
    ...row,
    createdAt: row.created_at,
    total: row.total_cents,
  } as unknown as Order;
}
```

**Why the anti-pattern is bad.**

- **The cast silences the compiler.** `created_at` is a string, but `Order` expects a `Date`; `total_cents` is cents, but `total` expects dollars.
- **The failure moves to runtime.** The first `order.createdAt.getTime()` or `order.total.toFixed(2)` fails somewhere else, far from the mapper.
- **The row shape leaks into the domain.** The domain now carries `created_at`-shaped data under a camelCase name.
- **There is no validation.** An invalid date string and a missing field both pass.

Mapping is not a place for business rules. It converts representation: names, units, dates, enums. The domain still owns the invariants (`total > 0`, valid status transitions).

**Proof**

```ts
const row: OrderRow = {
  id: "o-1", created_at: "2026-01-02T03:04:05.000Z", total_cents: 1234,
};

const mapped = rowToDomain(row);
assert.ok(mapped.createdAt instanceof Date);
assert.equal(mapped.total, 12.34);

const leaked = leakyMap(row);
assert.equal(typeof leaked.createdAt, "string");
assert.equal(leaked.total, 1234);
assert.throws(() => leaked.createdAt.getTime(), /not a function/);
```

## 13. Read models and projections

**Rule.** Shape read data for the screen. Do not load an aggregate and walk its children just to render a list.

**What is an aggregate?** An aggregate is a cluster of domain objects treated as one **consistency boundary**. One object is the **aggregate root**; external code holds the root, not the internals. The root enforces the invariants of the whole cluster.

```ts
class Order { // aggregate root
  private readonly lines: OrderLine[] = [];

  addLine(sku: string, price: Money, quantity: number): void {
    if (quantity <= 0) throw new Error("quantity must be positive");
    if (this.lines.length >= 100) throw new Error("too many lines");
    this.lines.push(new OrderLine(sku, price, quantity));
  }

  get total(): Money {
    return this.lines.reduce((sum, line) => sum.add(line.subtotal), Money.zero());
  }
}

class OrderLine { // inside the aggregate
  constructor(
    readonly sku: string,
    readonly price: Money,
    readonly quantity: number,
  ) {}

  get subtotal(): Money { return this.price.multiply(this.quantity); }
}
```

`Order` plus its `OrderLine`s is the aggregate. `Order` is the root.

An aggregate is **not**:

- a table row — that is the persistence shape;
- a DTO — that is a transport shape;
- a bounded context — that is a much larger language and model boundary;
- the whole object graph — keep aggregates small.

| Concept | Scope | Example |
| --- | --- | --- |
| **Entity** | One object with identity | `Order`, `Customer` |
| **Aggregate** | Consistency boundary around a root | `Order` + `OrderLine`s |
| **Bounded context** | Model and language boundary | Sales vs. Billing |

The boundary is about consistency and transactions: inside the aggregate, invariants must hold immediately; across aggregates, use references by ID, separate transactions, and eventual consistency.

In one sentence: **within an aggregate, the objects that participate in an invariant are created, updated, or rejected as one unit.** Not every object changes on every operation; the set is validated and committed together.

| Operation | Inside the boundary | What is atomic |
| --- | --- | --- |
| Add a line | `Order` + `OrderLine` | Insert the line, update the total, check the line limit |
| Cancel the order | `Order` | Change the status; reject later line additions |
| Change the customer’s address | `Customer` | Update the address; orders keep their shipping snapshot |
| Place the order and charge the card | `Order` + `Payment` | Separate aggregates; use a saga or outbox, not one transaction |
| Render an order summary | None — a projection | No aggregate load |

**Why this matters for reads.** Loading the `Order` aggregate to render a summary means:

- selecting columns and rows the screen does not need;
- reconstituting domain objects and enforcing invariants for a read-only view;
- possibly lazy-loading lines (N+1);
- coupling the screen to the aggregate shape.

A projection reads exactly the fields the screen needs, in one query.

`Aggregate` here is the DDD aggregate, not the SQL `SUM`/aggregate function. If the word is ambiguous in your team, say “aggregate root” or “consistency boundary.”

**Correct**

```ts
type OrderSummary = {
  orderId: string;
  customerName: string;
  total: number;
  itemCount: number;
};

class OrderSummaryQuery {
  private readonly db: FakeDb;
  constructor(db: FakeDb) { this.db = db; }

  execute(): OrderSummary[] {
    this.db.queries += 1;
    return this.db.orders.map((order) => {
      const customer = this.db.customers.find((c) => c.id === order.customerId);
      const items = this.db.items.filter((item) => item.orderId === order.id);
      return {
        orderId: order.id,
        customerName: customer?.name ?? "unknown",
        total: order.totalCents / 100,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      };
    });
  }
}
```

**Anti-pattern**

```ts
class AggregateReport {
  private readonly db: FakeDb;
  constructor(db: FakeDb) { this.db = db; }

  execute(): Array<{ orderId: string; items: ItemRow[] }> {
    this.db.queries += 1;
    return this.db.orders.map((order) => {
      this.db.queries += 1; // lazy-load per order
      return {
        orderId: order.id,
        items: this.db.items.filter((item) => item.orderId === order.id),
      };
    });
  }
}
```

**Proof**

```ts
const db = new FakeDb(); // 2 orders
assert.equal(new OrderSummaryQuery(db).execute().length, 2);
assert.equal(db.queries, 1);

const db2 = new FakeDb();
new AggregateReport(db2).execute();
assert.equal(db2.queries, 3); // 1 + one per order
```

## 13a. Aggregates, transactions, and coupling

**The rule.** One aggregate per transaction. Separate aggregates commit in separate local transactions and coordinate with domain events, an outbox, or a saga.

“No shared transaction” does not mean “no transaction.” Each aggregate still has its own transaction. The point is that the transaction boundary matches the aggregate boundary.

Fowler states it directly: “Transactions should not cross aggregate boundaries.” Vernon’s rule is the same: both the referencing aggregate and the referenced aggregate “must not be modified in the same transaction. Only one or the other may be modified in a single transaction.”

**Why.** A shared transaction across aggregates couples them:

- **Commit/rollback:** both must succeed or fail together.
- **Availability:** if one store is down, both fail.
- **Latency:** both must be available inside the same lock window.
- **Schema and migration:** changes must be coordinated.
- **Deployment:** both must ship together.
- **Ownership:** one team cannot change its store independently.
- **Extraction:** if the aggregates become separate services, the shared transaction becomes a distributed transaction (2PC) or a shared database.

That is the answer to “they could be two services later.” A shared transaction now is exactly what makes that extraction expensive. One aggregate per transaction is the seam that lets you split later.

**Approaches.**

| Approach | Consistency | Coupling | Use when |
| --- | --- | --- | --- |
| One aggregate per transaction + events/outbox | Eventual | Low | Default; aggregates may split; long-lived system |
| Shared local transaction | Immediate | High | True invariant; same database and service; accept the coupling |
| Distributed transaction (2PC) | Immediate | Very high | Rare; strong consistency across services; usually avoid |

**What it looks like.**

Bad: order and payment in one transaction, with a network call inside it.

```ts
await db.transaction(async (tx) => {
  const order = Order.place(/* ... */);
  await orders.save(tx, order);
  const payment = await stripe.charge(/* ... */); // network inside the transaction
  await payments.save(tx, payment);
});
```

This holds locks across a network call, and the provider can succeed while the commit fails.

Good: order and payment are separate aggregates. The order transaction writes an outbox row; the payment is a separate local transaction driven by a relay or consumer.

```ts
await db.transaction(async (tx) => {
  const order = Order.place(/* ... */);
  await orders.save(tx, order);
  await outbox.add(tx, new OrderPlaced(order.id, order.total));
});
```

```text
Order transaction: order + OrderPlaced (outbox)
  → Payment service: local transaction charge + PaymentSucceeded
  → Order service: local transaction mark paid
  or PaymentFailed
  → Order service: local transaction cancel
```

Compensation replaces rollback across aggregates.

**The judgment tests.**

1. **Crash test.** If I write A and crash before B, is the state acceptable? If no, either A and B are one aggregate, or you are accepting coupling.
2. **Split test.** Would I be comfortable if A and B were in different services tomorrow? If no, do not share a transaction now; design the seam.
3. **Invariant or workflow?** A true invariant lives inside one aggregate. A workflow spans aggregates and needs a saga or process manager.

**The counterpoint.** A local transaction across aggregates is not illegal. In a monolith, it can be pragmatic when the invariant truly spans them. But it is a trade-off: you are coupling their consistency, availability, schema, and deployment. Even in a modular monolith, a transaction across modules couples their schemas, migrations, and release train — the same force at a smaller scale. Keep it small, name the cost, and revisit it when extraction is near. The mistake is pretending it is free.

**References.**

- Fowler, [*DDD_Aggregate*](https://martinfowler.com/bliki/DDD_Aggregate.html) (2013): “Transactions should not cross aggregate boundaries.”
- Evans, [*Domain-Driven Design*](https://www.domainlanguage.com/ddd/) (2003), ch. 6: the aggregate is the consistency boundary; “any rule that spans AGGREGATES will not be expected to be up-to-date at all times” (p. 128).
- Vernon, [*Effective Aggregate Design*](https://www.dddcommunity.org/library/vernon_2011/) (2011), Parts I–III: “Model true invariants in consistency boundaries”; “Design small aggregates”; “Reference other aggregates by identity”; “Use eventual consistency outside the boundary.”
- Richardson, [*Pattern: Saga*](https://microservices.io/patterns/data/saga.html): a saga is a sequence of local transactions with compensation; under its forces, “2PC is not an option.”
- Helland, [*Life Beyond Distributed Transactions*](https://ics.uci.edu/~cs223/papers/cidr07p15.pdf) (2007/2016): entities “may be atomically updated within the entity but never atomically updated across entities”; cross-entity consistency is messaging and activities.
- Kleppmann, [*Designing Data-Intensive Applications*](https://dataintensive.net/) (2017), ch. 9: distributed transactions, 2PC, and their availability and latency costs.
- Newman, [*Monolith to Microservices*](https://samnewman.io/books/monolith-to-microservices/) (2019), for why shared data and transactions make extraction expensive.
- Ford, Richards, Sadalage & Dehghani, [*Software Architecture: The Hard Parts*](https://www.oreilly.com/library/view/software-architecture-the/9781492086888/) (2021), for data ownership and distributed workflows.

## 14. Repository interface vs. implementation

**Rule.** The service depends on the repository contract. The composition root chooses the adapter.

**Correct**

```ts
interface OrderRepository {
  save(order: Order): void;
  all(): readonly Order[];
}

class InMemoryOrderRepository implements OrderRepository {
  private readonly rows: Order[] = [];
  save(order: Order): void { this.rows.push(order); }
  all(): readonly Order[] { return this.rows; }
}

class SqlLikeOrderRepository implements OrderRepository {
  private readonly rows: Order[] = [];
  save(order: Order): void { this.rows.push({ ...order, id: `sql-${order.id}` }); }
  all(): readonly Order[] { return this.rows; }
}

class OrderService {
  private readonly repository: OrderRepository;
  constructor(repository: OrderRepository) { this.repository = repository; }
  create(total: number): Order {
    const order = { id: randomUUID(), total };
    this.repository.save(order);
    return order;
  }
}
```

**Anti-pattern**

```ts
class BadOrderService {
  private readonly repository = new InMemoryOrderRepository();

  create(total: number): Order {
    const order = { id: randomUUID(), total };
    this.repository.save(order);
    return order;
  }
}
```

**Proof**

```ts
const memory = new InMemoryOrderRepository();
const sql = new SqlLikeOrderRepository();

new OrderService(memory).create(10);
new OrderService(sql).create(20);

assert.equal(memory.all()[0]?.total, 10);
assert.equal(sql.all()[0]?.id.startsWith("sql-"), true);
// BadOrderService has no constructor parameter to swap.
```

### Can the domain call the repository?

**Short answer.** The domain can depend on a repository **port** it owns. It should not depend on a concrete repository, ORM, SQL, or vendor SDK. And the default is still: the application service loads and saves; the entity enforces its own invariants.

**What “policy” means here.** A policy is a named business rule, not an architectural policy. `CreditLimitPolicy` answers: “Can this customer place this order without exceeding their credit limit?” It is a domain concept.

There are two different questions:

- **Can a domain service use a repository interface?** Sometimes. A domain service is a good home for a rule that spans aggregates, such as a credit-limit check. But the cleaner default is for the application service to load the data and pass it in; the policy itself stays pure. A repository inside a domain service is the exception, not the default.
- **Should an entity call a repository?** Usually no. The entity should not query the database to enforce its own invariant. The application service loads what the rule needs and passes it in.

| Where the repository is | Verdict |
| --- | --- |
| Entity → concrete database | Bad: the domain knows SQL and vendor errors |
| Entity → repository port | Usually avoid: the entity becomes persistence-aware |
| Application service → repository port | Default: load, call the domain, save |
| Domain service → repository port | Acceptable for cross-aggregate rules, but prefer passing the data in |
| Adapter → database | Expected: the adapter owns the translation |

**Where a rule lives.**

| Rule | Home | Why |
| --- | --- | --- |
| `total > 0` | `Order` entity | One aggregate owns it |
| discount between 0 and 1 | `Order` entity | One aggregate owns it |
| credit limit | `CreditLimitPolicy` (domain service) | Spans `Order` and `Customer` |
| “only support can refund” | `RefundPolicy` (domain service) | Eligibility spans user and order |
| transaction, authorization | application service | Use-case coordination |
| unique email | database constraint | Persistence enforces it |

**A pure policy.**

```ts
class CreditLimitPolicy {
  canPlace(orderTotal: Money, creditLimit: Money, outstanding: Money): boolean {
    return outstanding.add(orderTotal).isAtMost(creditLimit);
  }
}
```

The application service loads the customer and the order, then calls the policy:

```ts
const customer = await this.customers.byId(command.customerId);
const order = Order.place(command.customerEmail, command.total);

if (!this.creditPolicy.canPlace(order.total, customer.creditLimit, customer.outstanding)) {
  throw new CreditLimitExceeded();
}

await this.orders.save(order);
```

The policy has no repository. The application service has the repository. The policy is testable with three values.

If the rule genuinely needs a lookup that cannot be passed in, a domain service can take a repository port. That is a trade-off: it makes the domain service harder to test and couples it to persistence. Prefer passing a read model or a snapshot.

**Correct**

```ts
interface OrderRepository {
  byId(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

class Order {
  private status: "pending" | "shipped" | "cancelled";

  cancel(): void {
    if (this.status === "shipped") throw new OrderCannotBeCancelled();
    this.status = "cancelled";
  }
}

class CancelOrder {
  private readonly orders: OrderRepository;
  private readonly uow: UnitOfWork;

  constructor(orders: OrderRepository, uow: UnitOfWork) {
    this.orders = orders;
    this.uow = uow;
  }

  async execute(id: string): Promise<void> {
    await this.uow.run(async () => {
      const order = await this.orders.byId(id);
      if (!order) throw new OrderNotFound(id);
      order.cancel();
      await this.orders.save(order);
    });
  }
}
```

**Anti-pattern**

```ts
class BadOrder {
  private readonly db: DatabaseSync;
  private readonly id: string;

  constructor(db: DatabaseSync, id: string) {
    this.db = db;
    this.id = id;
  }

  cancel(): void {
    try {
      this.db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(this.id);
    } catch (error) {
      if (String(error).includes("SQLITE_BUSY")) throw new Error("try again");
    }
  }
}
```

The entity now knows SQL and SQLite’s error text. Testing `cancel()` requires a database. Changing the database changes the entity.

**The “level 1 is tied to level 3” problem.** At runtime the call chain is:

```text
Controller → Application service → Domain → Repository → Database
```

The source dependencies should be:

```text
Controller → Application → Domain → OrderRepository (port)
                                         ▲
                                         │ implements
                              SqlOrderRepository → Database
```

The domain imports the port; the adapter imports the port and the domain. The domain never imports the adapter. That is the inversion.

If the domain imports `SqlOrderRepository` or `DatabaseSync`, the arrows point outward. The controller now transitively depends on the database — level 1 is tied to level 3. The abstraction is supposed to cut that chain:

- the domain depends on a stable contract it owns;
- the adapter depends on the domain and the database;
- the database can change without changing the domain.

When the repository leaks `SQLITE_BUSY`, the coupling becomes direct: the domain’s control flow depends on a vendor string. That is a **leaky abstraction** and **hidden coupling**.

The principles involved:

- **Dependency Inversion Principle** — depend on abstractions, not concretions.
- **The Dependency Rule** — source dependencies point inward; the domain does not know infrastructure.
- **Encapsulation / information hiding** — the repository hides how storage works; leaking driver errors breaks the hiding.
- **Acyclic dependencies** — domain → persistence and persistence → domain creates a cycle.
- **Stable dependencies** — the domain is more stable than the database or vendor, so dependencies should point toward it.

**The trade-off.** Active Record and CRUD frameworks put persistence in the model on purpose. That is productive for a simple form over a table, but it couples the model to the schema. The full comparison, examples, and decision table are in [14a](#14a-active-record-vs-repository).

**References.**

- Parnas, [*On the Criteria To Be Used in Decomposing Systems into Modules*](https://www.cs.colostate.edu/~france/CS314/Readings/Parnas-decomposition.pdf) (1972), for information hiding.
- Martin, [*The Clean Architecture*](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) (2012) and *Clean Architecture* (2017), for the Dependency Rule and the Dependency Inversion Principle.
- Fowler, [*Inversion of Control*](https://martinfowler.com/articles/injection.html) (2004), for the difference between injection and inversion.
- Cockburn, [*Hexagonal Architecture*](https://alistair.cockburn.us/hexagonal-architecture/) (2005), for ports and adapters.
- Evans, [*Domain-Driven Design*](https://www.domainlanguage.com/ddd/) (2003), for repositories and the domain model.

## 14a. Active Record vs. repository

**The question.** Should the model know how it is stored?

Two legitimate answers:

- **Active Record:** the model is the row. It has fields, business methods, and `save`/`find`/`delete`. The framework maps it to the table.
- **Data Mapper / repository:** the model is pure. A repository loads and saves it; an adapter maps it to rows.

### Active Record

```ts
class Order extends BaseModel {
  static table = "orders";

  id!: string;
  total!: number;
  status!: "pending" | "paid";

  async pay(): Promise<void> {
    if (this.status !== "pending") throw new Error("order already paid");
    this.status = "paid";
    await this.save(); // persistence is part of the model
  }
}

const order = await Order.find("o-1");
await order.pay();
```

**What you get:** one object, less code, framework conventions, fast CRUD, easy forms and admin panels.

**What you pay:** the model knows the schema; tests need a database; business rules and persistence are mixed; a schema change ripples through the model; lazy loading and N+1 hide in property access; the same object often leaks into the API; the transaction is implicit.

### What “two reasons to change” means

It is not mainly about swapping the database. It is about two independent change axes:

- **Storage and schema:** a new column, a type change, normalization, an index, a migration, a read replica, a reporting table, a vendor change.
- **Business rules:** who gets a discount, when an order can be cancelled, how credit limits work, tax policy, refund eligibility.

They change for different actors and at different times.

| Change | Triggered by | Active Record impact | Repository impact |
| --- | --- | --- | --- |
| Add `fraud_score` | Risk / ops | The `Order` model gets a field, cast, maybe a scope | The row and mapper change; the domain is unchanged |
| Change the VIP discount threshold | Product | `Order.applyDiscount` and the persistence code are in the same class | `Order.applyDiscount` changes; the adapter is unchanged |
| Rename `total` to `total_cents` | DBA / migration | The model and every business method that uses `total` change | The mapper absorbs the rename; the domain is unchanged |
| Swap Postgres for DynamoDB | Platform | The model’s queries, casts, and relationships change | The adapter changes; the domain is unchanged |
| Add a reporting read model | Analytics | The model grows reporting concerns or a second path | A new projection/adapter; the domain is unchanged |

The problem is not that either change is bad. The problem is that in Active Record both changes edit the same class, for different reasons, often by different people. That is the SRP violation: not “too many methods,” but **two actors with two reasons to change**.

When the schema is stable and the rules are trivial, the two axes rarely collide. Active Record is fine. When both change often, the class becomes the meeting point of every migration and every policy change.

### Repository and a pure model

```ts
class Order {
  private constructor(
    readonly id: OrderId,
    private status: "pending" | "paid",
    readonly total: Money,
  ) {}

  static place(id: OrderId, total: Money): Order {
    if (!total.isPositive()) throw new InvalidOrder("total must be positive");
    return new Order(id, "pending", total);
  }

  pay(): void {
    if (this.status !== "pending") throw new OrderAlreadyPaid(this.id);
    this.status = "paid";
  }
}

interface OrderRepository {
  byId(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

class SqlOrderRepository implements OrderRepository {
  async byId(id: OrderId): Promise<Order | null> {
    const row = await this.db.findOrderRow(id.value);
    return row ? rowToDomain(row) : null;
  }

  async save(order: Order): Promise<void> {
    await this.db.upsertOrder(domainToRow(order));
  }
}

class PayOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(id: OrderId): Promise<void> {
    await this.uow.run(async () => {
      const order = await this.orders.byId(id);
      if (!order) throw new OrderNotFound(id);
      order.pay();
      await this.orders.save(order);
    });
  }
}
```

**What you get:** the domain is testable without a database; invariants are protected; the schema is decoupled; you can swap adapters; the transaction is explicit; read models can be separate.

**What you pay:** mapping code, more files, indirection, mapping bugs, and ceremony for CRUD.

The key difference is one line: in Active Record, `order.pay()` saves. In the repository style, `order.pay()` only changes the object; `PayOrder` saves and commits. The entity owns the invariant; the repository owns persistence; the application service owns the transaction.

### When to separate

| Force | Active Record | Repository + pure model |
| --- | --- | --- |
| Domain complexity | Low | High |
| Invariants | Few or none | Many |
| Test the domain without a database | Not important | Important |
| Schema churn | Low | High |
| Multiple storage or read models | No | Yes |
| Team and horizon | Small, short | Larger, long |
| Framework convention | Strong | Worth overriding |
| Mapping cost | Low | High |
| Failure mode | Schema-coupled model; DB-bound tests | Ceremony; mapping bugs; over-abstraction |

### The heuristic

- If the main rules are database constraints — required, unique, foreign key — Active Record is fine.
- If you can name an invariant that must hold across multiple writes or entry points, separate.
- If you need to test the rule without a database, separate.
- If the schema is expected to change independently of the rules, separate.
- If the framework’s CRUD is the product, Active Record is pragmatic.
- If the domain is the product, separate.

### The team-size trap

SRP is about reasons to change, not org-chart boxes. A small team can own both the schema and the business rules; the two change axes still exist. What changes is the coordination cost.

- **Same team, infrequent changes, stable schema:** combining is pragmatic.
- **Same team, independent and frequent changes:** separation can still pay, because the friction is local — tests, migrations, reviews, comprehension.
- **Different teams:** the boundary is also a coordination seam; separate.

Do not use “we are one team” as proof that the two reasons collapsed. Use it as evidence that the coordination cost of coupling is lower.

### Change cost vs. blast radius

“Change management” is often read as “the cost of making the change.” AI attacks that cost: it writes the edit faster, generates the migration, updates the test.

But there is a second cost: **blast radius** — how much must be re-verified, re-reviewed, re-deployed, and how many consumers can be affected if the change is wrong.

AI reduces the first. It does not automatically reduce the second. More generated code can increase it if the change touches shared classes, schemas, or contracts. The bottleneck moves from typing to review, verification, and coordination.

That is why SRP still matters in the AI age. The point of separating two reasons to change is not that typing the change is expensive; it is that a change in one axis cannot break the other. The blast radius is smaller.

| Dimension | AI effect | Separation effect |
| --- | --- | --- |
| Cost to write the change | Lower | Slightly higher (mapping, indirection) |
| Blast radius | Not necessarily lower; can be higher | Lower |
| Verification | More code to review and test | Localized tests |
| Coordination | Not lower | Fewer shared owners |
| Reversibility | Not lower | Easier local rollback |
| Risk of the wrong abstraction | Higher with more generated code | Lower when the boundary is right |

The question is not “can AI make this change quickly?” It is “if this change is wrong, how much can it break?”

### You do not have to choose for the whole system

Use Active Record for a simple CRUD or admin subdomain. Use repository plus a pure model for the core domain. This is a bounded-context decision, not a religion. The mistake is forcing one style everywhere.

### The line to keep

The repository works on the model; the model owns the invariants. The repository does not decide whether an order can be paid; it only loads and saves the aggregate. If the repository starts enforcing business rules, the boundary has moved.

### References

- Fowler, [*Active Record*](https://martinfowler.com/eaaCatalog/activeRecord.html), [*Data Mapper*](https://martinfowler.com/eaaCatalog/dataMapper.html), [*Repository*](https://martinfowler.com/eaaCatalog/repository.html), and [*Unit of Work*](https://martinfowler.com/eaaCatalog/unitOfWork.html) in *Patterns of Enterprise Application Architecture* (2002).
- Evans, [*Domain-Driven Design*](https://www.domainlanguage.com/ddd/) (2003), for repositories and aggregates.
- Vernon, [*Implementing Domain-Driven Design*](https://www.oreilly.com/library/view/implementing-domain-driven-design/9780133039900/) (2013), for repository and aggregate boundaries.
- Ousterhout, [*A Philosophy of Software Design*](https://web.stanford.edu/~ouster/cgi-bin/book.php) (2018), for complexity, classitis, and change locality.
- Rails, [*Active Record Basics*](https://guides.rubyonrails.org/active_record_basics.html) and TypeORM, [*Active Record vs. Data Mapper*](https://typeorm.io/active-record-vs-data-mapper), for concrete framework trade-offs.
- Harvey, [*AI is an Amplifier*](https://www.infoq.com/presentations/dora-ai-adoption-engineering-performance) (DORA/InfoQ), for AI scaling the system you already have.
- Spotify Engineering, [*Coding Is No Longer the Constraint*](https://engineering.atspotify.com/2026/6/code-with-claude-coding-is-no-longer-the-constraint) (2026), for the shift from coding to review and decision-making.

## 15. Pagination, filtering, sorting

**Rule.** Filtering, ordering, and slicing belong in the query. Pass a typed query object through the service to the repository; the adapter turns it into SQL.

**The three words.**

- **Filter:** which rows? (`status = 'paid'`, `total >= 20`)
- **Sort:** in what order? (`created_at DESC, id DESC`)
- **Page:** which slice? (`LIMIT 20 OFFSET 40`, or a keyset cursor)

**Why push it down.** The database has indexes, a query planner, and a sort engine. If you load every row and filter in the service:

- you read and transfer the whole table;
- the index on `total` or `created_at` is unused;
- memory and latency grow with the table, not with the page;
- pagination becomes unstable under concurrent writes: rows shift between pages;
- you may load data the caller is not allowed to see.

The repository should build something like:

```sql
SELECT id, total, created_at
FROM orders
WHERE tenant_id = $1 AND total >= $2
ORDER BY total ASC, id ASC
LIMIT $3 OFFSET $4;
```

The service passes values; the adapter parameterizes them. Never concatenate a sort or filter field from the request; whitelist the allowed fields.

**Correct**

```ts
type Order = { id: string; total: number };

type PageRequest = { limit: number; offset: number };
type OrderFilter = { minTotal?: number };
type OrderSort = "id" | "total";

class FakeDb {
  readonly orders: Order[] = [
    { id: "o-1", total: 10 },
    { id: "o-2", total: 20 },
    { id: "o-3", total: 30 },
    { id: "o-4", total: 40 },
    { id: "o-5", total: 50 },
  ];
  queryCalls = 0;
  allCalls = 0;
}

class OrderRepository {
  private readonly db: FakeDb;
  constructor(db: FakeDb) { this.db = db; }

  query(page: PageRequest, filter: OrderFilter, sort: OrderSort): Order[] {
    this.db.queryCalls += 1;
    // In a real adapter:
    // SELECT ... WHERE total >= ? ORDER BY total LIMIT ? OFFSET ?
    const filtered = this.db.orders.filter(
      (order) => filter.minTotal === undefined || order.total >= filter.minTotal,
    );
    const sorted = [...filtered].sort((a, b) =>
      sort === "id" ? a.id.localeCompare(b.id) : a.total - b.total,
    );
    return sorted.slice(page.offset, page.offset + page.limit);
  }

  all(): Order[] {
    this.db.allCalls += 1;
    return this.db.orders;
  }
}

class OrderService {
  private readonly repository: OrderRepository;
  constructor(repository: OrderRepository) { this.repository = repository; }
  list(page: PageRequest, filter: OrderFilter, sort: OrderSort): Order[] {
    return this.repository.query(page, filter, sort);
  }
}
```

**Anti-pattern**

```ts
class BadOrderService {
  private readonly repository: OrderRepository;
  constructor(repository: OrderRepository) { this.repository = repository; }

  list(page: PageRequest, filter: OrderFilter): Order[] {
    const all = this.repository.all(); // load every row
    const filtered = all.filter(
      (order) => filter.minTotal === undefined || order.total >= filter.minTotal,
    );
    return filtered.slice(page.offset, page.offset + page.limit);
  }
}
```

**What goes wrong.**

- **O(table) instead of O(page).** The cost grows with the table, not the page size.
- **Indexes are unused.** The database cannot use `total`, `created_at`, or `tenant_id` indexes because the predicates are not in the query.
- **Deep pages get slower.** Offset pagination already has a cost; loading everything multiplies it.
- **Concurrent writes shift rows.** A row can appear twice or disappear between pages.
- **Sorting differs.** JavaScript sorting may not match database collation, null ordering, or locale rules.
- **Data leak.** You load fields and rows the caller did not ask for, then discard them in memory.

**When not to push down.**

- **Computed or derived fields** that are not columns. Use a read model/projection, or a bounded candidate query.
- **Fuzzy or full-text search.** Use a search index, not `LIKE '%term%'` over the table.
- **Cross-service data.** Use an API composition or a read model.
- **A permission rule that cannot be expressed in SQL.** Filter a bounded candidate set, or precompute the authorized read model. Do not load the whole table.
- **A genuinely small in-memory list or cache.** Application-side filtering is fine; the database is not the bottleneck.

**Pagination nuance.** Offset pagination is fine for small or stable datasets. For deep pages or feeds, use keyset pagination with a stable, indexed sort key:

```sql
WHERE (created_at, id) < ($1, $2)
ORDER BY created_at DESC, id DESC
LIMIT $3;
```

Offset gets slower as the offset grows, and it can skip or duplicate rows when the underlying data changes.

**Proof**

```ts
const db = new FakeDb();
const service = new OrderService(new OrderRepository(db));

const page = service.list({ limit: 2, offset: 1 }, { minTotal: 20 }, "total");

assert.deepEqual(page.map((order) => order.id), ["o-3", "o-4"]);
assert.equal(db.queryCalls, 1);
assert.equal(db.allCalls, 0);

const db2 = new FakeDb();
new BadOrderService(new OrderRepository(db2))
  .list({ limit: 2, offset: 1 }, { minTotal: 20 });

assert.equal(db2.allCalls, 1); // the whole table was loaded
assert.equal(db2.queryCalls, 0); // the database did no filtering
```

## 16. N+1 queries

**Rule.** Load the parent set once and the child set once. A query inside a loop multiplies latency with the data size.

**Correct**

```ts
class OrderListQuery {
  private readonly db: FakeDb;
  constructor(db: FakeDb) { this.db = db; }

  execute(): Array<OrderRow & { items: ItemRow[] }> {
    const orders = this.db.findOrders();
    const items = this.db.findItemsForOrders(orders.map((order) => order.id));
    return orders.map((order) => ({
      ...order,
      items: items.filter((item) => item.orderId === order.id),
    }));
  }
}
```

**Anti-pattern**

```ts
class NPlusOneQuery {
  private readonly db: FakeDb;
  constructor(db: FakeDb) { this.db = db; }

  execute(): Array<OrderRow & { items: ItemRow[] }> {
    return this.db.findOrders().map((order) => ({
      ...order,
      items: this.db.findItems(order.id), // one query per order
    }));
  }
}
```

**Proof**

```ts
const db = new FakeDb(); // 3 orders
new OrderListQuery(db).execute();
assert.equal(db.queries, 2); // orders + items

const db2 = new FakeDb();
new NPlusOneQuery(db2).execute();
assert.equal(db2.queries, 4); // 1 + 3
```

## 17. Batch operations

**Rule.** A batch is one unit of work. Per-row commits turn a failed batch into a partial write.

**What this teaches.** The transaction scope is the batch scope:

- Begin once, before the first row.
- Write all rows inside the same transaction.
- Commit once, after the last row.
- On any failure, roll back all of them.

Begin/commit per row makes each row its own unit of work. A failure on row 999 cannot undo rows 1–998; they are already durable.

**When partial success is acceptable.** Not every batch is all-or-nothing. If 998 of 1,000 rows succeeding is acceptable, use per-row or chunked transactions, record which rows succeeded and failed, and make retries idempotent. The mistake is claiming atomicity while committing per row.

**A real batch.** The loop in the example is the simplest shape. In a real adapter, `saveAll` is usually one transaction with a bulk insert (`insertMany`, `COPY`, `UNNEST`), not a loop of individual inserts. The important part is one begin and one commit.

**Correct**

```ts
class BatchOrderRepository {
  private readonly store: BatchStore;
  constructor(store: BatchStore) { this.store = store; }

  saveAll(ids: readonly string[]): void {
    this.store.begin();
    try {
      for (const id of ids) this.store.stage(id);
      this.store.commit();
    } catch (error) {
      this.store.rollback();
      throw error;
    }
  }
}
```

**Anti-pattern**

```ts
class PerRowOrderRepository {
  private readonly store: BatchStore;
  constructor(store: BatchStore) { this.store = store; }

  save(id: string): void {
    this.store.begin();
    this.store.stage(id);
    this.store.commit();
  }

  saveAll(ids: readonly string[]): void {
    for (const id of ids) this.save(id);
  }
}
```

**The cost.** A large transaction holds locks, grows the undo log, uses memory, and can lag replication. If the batch is huge, chunk it: each chunk is atomic; the whole batch is not. That is a deliberate trade-off, not an accident.

**Proof**

```ts
const batch = new BatchStore();
assert.throws(() => new BatchOrderRepository(batch).saveAll(["a", "b", "bad"]));
assert.deepEqual(batch.committed, []);

const perRow = new BatchStore();
assert.throws(() => new PerRowOrderRepository(perRow).saveAll(["a", "b", "bad"]));
assert.deepEqual(perRow.committed, ["a", "b"]); // partial write
```

## 18. Transaction boundary at the service

**Rule.** The **application service** owns the unit of work. The repository and the domain service participate; they do not commit.

**Which service?** The application service, not the domain service.

|  | Application service | Domain service |
| --- | --- | --- |
| **Job** | Run one use case: load, decide, save, authorize, commit | Enforce a domain rule that spans objects |
| **Knows about** | Transactions, repositories, ports, workflow | Domain concepts only |
| **Owns the transaction?** | Yes | No — it participates |
| **Example** | `TransferMoney` | `FeePolicy`, `CreditLimitPolicy` |

The domain service may be called inside the transaction, but it must not begin or commit. If it does, it imposes a transaction boundary on every caller, and the application service loses control of the use case. The repository participates too; the application service owns the boundary.

Why not the domain service?

- It may be reused by use cases with different atomicity needs.
- Transaction management is an application/workflow concern, not a domain rule.
- The domain should stay free of database and transaction APIs.

Why not the repository?

- A repository call does not know the whole use case.
- Per-call commits turn a multi-step use case into partial writes.

Why not the controller?

- It owns HTTP parsing, validation, and rendering.
- A transaction there spans work that is not part of the unit of work.

### Domain service with a repository: read, don’t write

A domain service may inject a repository **port** when it needs to load an aggregate for a cross-aggregate rule. That is accepted in DDD. The boundary is:

- read through the port;
- do not save;
- do not commit;
- let the application service own the transaction and persistence.

Prefer a narrow read-only port (`AccountFinder`) over the full repository if the domain service only reads. Prefer passing loaded aggregates into a pure policy when the rule is simple.

**The purer shape** — the domain service takes the aggregates:

```ts
class TransferPolicy {
  transfer(source: Account, target: Account, amount: Money): void {
    source.withdraw(amount);
    target.deposit(amount);
  }
}

class TransferApplicationService {
  execute(command: TransferCommand): Promise<void> {
    return this.uow.run(async () => {
      const source = await this.accounts.byId(command.source);
      const target = await this.accounts.byId(command.target);
      if (!source || !target) throw new AccountNotFound();

      this.policy.transfer(source, target, command.amount);

      await this.accounts.save(source);
      await this.accounts.save(target);
    });
  }
}
```

**The repository-injected shape** — the domain service loads, but does not save:

```ts
class TransferDomainService {
  constructor(private readonly accounts: AccountFinder) {}

  transfer(sourceId: string, targetId: string, amount: Money): void {
    const source = this.accounts.byId(sourceId);
    const target = this.accounts.byId(targetId);
    if (!source || !target) throw new AccountNotFound();

    source.withdraw(amount);
    target.deposit(amount);
  }
}
```

The application service still wraps the call in `uow.run` and saves or commits. The domain service only reads.

**Where the rule comes from.** No canonical DDD source says “a domain service may read but not write.” The rule is a stricter derivation from two canonical rules:

1. Evans: “Leave transaction control to the client. Although the REPOSITORY will insert into and delete from the database, it will ordinarily not commit anything.”
2. Fowler’s Service Layer “controls transactions”; Vernon likewise places transaction management in the application layer.

Evans also explicitly allows domain services to have side effects: “The execution of a SERVICE … may even change that global information (that is, it may have side effects).” Statelessness is not the same as read-only.

So the read-only rule is a **practical boundary**, not a DDD law. Its purpose is to stop a domain service from hiding a write and to keep the application service in control of the unit of work.

**A note on the C# example.** `_unitOfWork.Commit()` persists the changes only if the unit of work or ORM tracks the loaded aggregates (EF Core, Hibernate). If the repository returns detached objects, the application service must call `Save` explicitly. The boundary rule is the same; the mechanism differs.

**A note on “pure.”** A domain service with a repository is not pure in the functional sense; it is testable with a fake. That is still a good boundary, but “testable” is the accurate word.

**A note on uniqueness.** A read-only `existsByEmail` is a pre-check, not a guarantee. The database unique constraint is the source of truth; the check can race.

**A note on naming.** A “domain service” that loads aggregates from a repository and mutates them is already halfway into application-service territory. The purer version takes the loaded aggregates. The repository-injected version is a pragmatic compromise; keep the transaction and save in the application service.

**Sources.**

- Evans, [*Domain-Driven Design*](https://www.domainlanguage.com/ddd/) (2003), ch. 5 (Services) and ch. 6 (Repositories).
- Fowler, [*Service Layer*](https://martinfowler.com/eaaCatalog/serviceLayer.html) (PoEAA, 2002).
- Vernon, [*Implementing Domain-Driven Design*](https://www.oreilly.com/library/view/implementing-domain-driven-design/9780133039900/) (2013), for application-layer transaction management.

**Correct**

```ts
class UnitOfWork {
  run<T>(work: () => T): T {
    this.store.begin();
    try {
      const result = work();
      this.store.commit();
      return result;
    } catch (error) {
      this.store.rollback();
      throw error;
    }
  }
}

class TransferApplicationService {
  transfer(from: string, to: string, amount: number): void {
    this.uow.run(() => {
      this.repository.debit(from, amount);
      if (amount > 100) throw new Error("transfer limit exceeded");
      this.repository.credit(to, amount);
    });
  }
}
```

**Anti-pattern**

```ts
transfer(from: string, to: string, amount: number): void {
  this.store.begin();
  this.repository.debit(from, amount);
  this.store.commit();

  if (amount > 100) throw new Error("transfer limit exceeded");

  this.store.begin();
  this.repository.credit(to, amount);
  this.store.commit();
}
```

**Proof**

```ts
const store = new AccountStore(); // a=100, b=100
assert.throws(() => correctService.transfer("a", "b", 150), /limit/);
assert.equal(store.get("a"), 100); // rolled back

assert.throws(() => badService.transfer("a", "b", 150), /limit/);
assert.equal(store.get("a"), -50); // the debit committed
```

## 19. Repository is transaction-agnostic

**Rule.** A repository may stage a write. It may not decide when the transaction ends.

**What “transaction-agnostic” means.** The repository does not begin, commit, or roll back. It uses the transaction context the caller provides — a `tx` handle, an ambient connection, or a unit of work. It can run inside a transaction or outside one; it does not decide.

**Why.** The unit of work belongs to the use case, not the repository.

- **Composition:** a use case may call two repository methods or two repositories — order and inventory, debit and credit, order and outbox. If each call commits, the use case cannot be atomic.
- **Policy:** isolation, retry, and whether an inner call joins or nests belong to the application service, not the adapter.
- **Reuse:** the same repository method can run inside or outside a transaction.
- **Failure:** a commit in the middle of a use case leaves partial writes the caller cannot roll back.

The repository is not the combiner. The application service or unit of work combines; the repository participates.

**The tell.** `save()` calling `commit()`, `saveChanges()`, or `db.transaction()` is the repository owning the boundary. A repository method may accept a `tx` handle; it should not create the transaction.

**The nuance.** A repository-specific batch method may own a transaction if the batch is the entire use case, but then it is not composable. Prefer a unit of work outside; let `saveAll(tx, rows)` participate.

**Correct**

```ts
class OrderRepository {
  private readonly store: Store;
  constructor(store: Store) { this.store = store; }

  save(id: string): void {
    this.store.stage(id); // no commit
  }
}

class OrderService {
  place(id: string, shouldFail: boolean): void {
    this.store.begin();
    try {
      this.repository.save(id);
      if (shouldFail) throw new Error("downstream failure");
      this.store.commit();
    } catch (error) {
      this.store.rollback();
      throw error;
    }
  }
}
```

**Anti-pattern**

```ts
class CommittingOrderRepository {
  save(id: string): void {
    this.store.begin();
    this.store.stage(id);
    this.store.commit(); // the repository owns the boundary
  }
}
```

**Proof**

```ts
const store = new Store();
assert.throws(() => new OrderService(store, new OrderRepository(store))
  .place("o-1", true), /downstream/);
assert.deepEqual(store.committed, []);

const bad = new Store();
new CommittingOrderRepository(bad).save("o-2");
assert.deepEqual(bad.committed, ["o-2"]);
```

## 20. Callback-based unit of work

**Rule.** Make the transaction a function: `transaction(work)` owns begin, commit, and rollback. Do not scatter `BEGIN`/`COMMIT` through the service.

**What it buys.** The boundary lives in one function. The caller supplies the work; the helper decides begin, commit, or rollback. There is no `BEGIN` in the service and no path where a thrown error skips the rollback.

**Correct**

```ts
class FakeDb {
  transaction<T>(work: () => T): T {
    this.begin();
    try {
      const result = work();
      this.commit();
      return result;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }
}

db.transaction(() => {
  orders.save(order);
  outbox.add(event);
});
```

**Anti-pattern**

```ts
class FakeDb {
  manual<T>(work: () => T): T {
    this.begin();
    const result = work(); // if this throws, no rollback
    this.commit();
    return result;
  }
}
```

**Why the manual version is fragile.** An early return, a throw, or a missing `catch` leaves the transaction open or the write partial. The helper makes the happy path and the failure path symmetric.

**Nuance.** Do not catch and swallow inside the callback; the helper will commit a partial success. External I/O belongs outside the transaction.

**Proof**

```ts
const db = new FakeDb();
assert.throws(() => db.transaction(() => {
  db.pending.push("o-1");
  throw new Error("failed");
}), /failed/);
assert.deepEqual(db.log, ["BEGIN", "ROLLBACK"]);
assert.deepEqual(db.committed, []);

const bad = new FakeDb();
assert.throws(() => bad.manual(() => {
  bad.pending.push("o-2");
  throw new Error("failed");
}), /failed/);
assert.deepEqual(bad.log, ["BEGIN"]); // no COMMIT, no ROLLBACK
```

## 21. Passing the tx handle

**Rule.** Every write inside the unit of work must use the same connection. A default-connection write escapes the rollback.

**What the handle is.** In a real driver the handle *is* the connection: a pooled client with a transaction open on it. A transaction is session state — the database remembers “this session is in a transaction,” and no other session can join it. `pool.query(…)` borrows a different client, runs outside your `BEGIN`, and commits on its own. That is the anti-pattern below, written with a connection pool instead of a fake `defaultTransaction`.

**The scope is the session, not only atomicity.** The connection also carries `SET LOCAL`, temp tables, advisory locks, cursors, prepared statements, and `search_path`. Two writes can share a transaction only if they share that state, which is why the handle has to be the same connection object and not merely a transaction id.

**Where it is not one connection.** A savepoint is a nested scope on the same connection; `REQUIRES_NEW` deliberately takes a *different* connection and is the exception that proves the rule; a transaction spanning two systems has no single connection at all and needs a coordinator (2PC) or an outbox. The invariant that survives all three: every write executes in the atomicity scope the caller opened, and the connection is the physical form of that scope.

**Correct**

```ts
class Db {
  transaction<T>(work: (tx: Transaction) => T): T {
    const tx = new Transaction(this.nextId++);
    try {
      const result = work(tx);
      tx.commit();
      return result;
    } catch (error) {
      tx.rollback();
      throw error;
    }
  }
}

class OrderRepository {
  save(tx: Transaction, id: string): void {
    tx.pending.push(id);
  }
}
```

**Anti-pattern**

```ts
class OrderRepository {
  saveOnDefault(db: Db, id: string): void {
    db.defaultTransaction.pending.push(id);
    db.defaultTransaction.commit(); // outside the caller's tx
  }
}
```

**Proof**

```ts
const db = new Db();
assert.throws(() => db.transaction((tx) => {
  repository.save(tx, "order");
  repository.save(tx, "payment");
  throw new Error("payment failed");
}), /payment failed/);
assert.deepEqual(db.defaultTransaction.committed, []);

assert.throws(() => db.transaction((tx) => {
  repository.save(tx, "order");
  repository.saveOnDefault(db, "payment");
  throw new Error("payment failed");
}), /payment failed/);
assert.deepEqual(db.defaultTransaction.committed, ["payment"]);
```

## 22. Nested transactions

*An inner call that opens its own transaction does not nest. It ends the caller’s — or commits half of it.*

**The situation.** A function owns a transaction and calls another function that was also written to be atomic:

```ts
async function placeOrder(db: Db, order: Order) {
  return withTransaction(db, async (conn) => {
    await insertOrder(conn, order);
    await recordAudit(conn, order.id); // it calls BEGIN "to be safe"
  });
}
```

One connection, one open transaction, two functions that each believe they own the boundary. Which one wins?

**What the database can actually do.** Four statements:

| Statement | Effect |
| --- | --- |
| `BEGIN` | opens a transaction on this connection |
| `COMMIT` | makes its pending writes durable, closes it |
| `ROLLBACK` | discards its pending writes, closes it |
| `SAVEPOINT name` · `ROLLBACK TO SAVEPOINT name` | marks a point inside an open transaction, and returns to it |

A transaction is not an object in the server that you can nest. It is **state on one connection**, and one connection has at most one open transaction. Every problem in this note follows from that sentence.

**What happens if both functions open one.**

```ts
function recordAudit(conn: Connection, id: string) {
  conn.query("BEGIN");           // ignored — a transaction is already open
  conn.query(`INSERT audit-${id}`);
  conn.query("COMMIT");          // closes the CALLER's transaction
}
```

Postgres does not nest. `BEGIN` inside a transaction emits `WARNING: there is already a transaction in progress` and does nothing. So this `COMMIT` commits the caller’s pending work as well. Two consequences:

- The order is now durable even though `placeOrder` is about to fail.
- `placeOrder`’s `ROLLBACK` emits `WARNING: no transaction in progress` and does nothing.

This is the worst kind of bug: it passes every test where nothing throws, and on the failure path it leaves committed partial data with no error to alert anyone. It is also why “every function owns its transaction” feels safe and is not.

**The mirror case.** If the inner function ends with `ROLLBACK` instead of `COMMIT`, that statement discards the caller’s pending writes and closes the caller’s transaction. The caller’s own `COMMIT` then warns `no transaction in progress` and commits nothing — the opposite damage, from the same cause. The rule to remember: **a** `BEGIN` **you did not open is a no-op; a** `COMMIT` **or** `ROLLBACK` **you did not open lands on somebody else’s transaction.**

**The three possible answers.**

| If the inner call… | Then | Cost |
| --- | --- | --- |
| must share the caller’s fate | use the **same connection** | none — this is the default |
| should be undoable alone, but not outlive the caller | `SAVEPOINT` on the same connection | cheap; an outer rollback still kills it |
| must survive the caller’s rollback | a **second connection** with its own transaction | two connections at once; it cannot see the caller’s uncommitted rows |

The only API needed for the first answer is a helper that checks out one connection and runs a callback inside `BEGIN`/`COMMIT`:

```ts
async function withTransaction<T>(db: Db, work: (conn: Connection) => Promise<T> | T): Promise<T> {
  const conn = db.connect();          // one connection = one transaction
  try {
    conn.query("BEGIN");
    const result = await work(conn);
    conn.query("COMMIT");
    return result;
  } catch (error) {
    conn.query("ROLLBACK");
    throw error;
  } finally {
    db.release();                     // return the connection, not the transaction
  }
}
```

(`Db` here is a pool; `connect()` checks out one connection. See the example for the full model.)

**Correct**

```ts
// 1. Join — the inner helper receives the caller's connection and never opens
//    a transaction of its own.
async function placeOrder(db: Db) {
  return withTransaction(db, async (conn) => {
    conn.query("INSERT order o-1");
    await recordAudit(conn, "o-1");        // same conn: one transaction
  });
}

// 2. Savepoint — same connection, undo only this part.
await withTransaction(db, (conn) => {
  conn.query("INSERT order o-1");
  conn.query("SAVEPOINT bonus");
  conn.query("INSERT bonus b-1");
  conn.query("ROLLBACK TO SAVEPOINT bonus");
});

// 3. Second connection — independent, survives the caller.
await withTransaction(db, async (conn) => {
  conn.query("INSERT order o-1");
  await withTransaction(db, async (audit) => {  // audit !== conn
    audit.query("INSERT audit a-1");
  });
  throw new Error("payment failed");            // the order dies, the audit does not
});
```

**Two connections mean two independent outcomes** — neither call decides the other’s fate:

| conn2 (audit) | conn1 (order) | What survives |
| --- | --- | --- |
| commits | commits | order + audit |
| **commits** | **rolls back** | **audit only** — an audit that references an order that does not exist |
| rolls back | commits | order only |
| rolls back | rolls back | nothing |

Compare the join case, where only two states exist: both, or neither. That is the entire trade — you give up “both or neither” to get “this one survives even if that one dies.”

**What the second connection costs.**

1. **Pool exhaustion.** Both transactions hold a connection at once. Call it per row in a loop and you serialize that many checkouts; at `pool.size` the pool is empty and every request waits for a connection that only a waiting request could release. It looks like a database outage.
2. **It cannot see the caller’s uncommitted writes.** Different connection, different snapshot. The audit row can reference an order id that never commits, or say “payment captured” about a payment that was rolled back. Survival is not consistency.
3. **It can deadlock on a row.** The outer holds a lock, the inner asks for the same row, the inner waits for the outer, the outer waits for the inner. Keep the independent write off the aggregate the outer is modifying.

**Anti-pattern**

```ts
// Each helper owns its own boundary, so the caller has nothing to roll back.
const saveOrder = () => withTransaction(db, (conn) => conn.query("INSERT o-1"));
const savePayment = () => withTransaction(db, (conn) => conn.query("INSERT p-1"));

await saveOrder();     // durable immediately
await savePayment();   // if this fails, the order is already committed
```

**Where this actually bites in Node.** The nested-call case above is rarer than these three, which are the same bug wearing ordinary clothes:

- `pool.query(…)` **inside a transaction.** It borrows a different connection, so the write escapes the rollback (§21).
- `Promise.all([pool.query(…), pool.query(…)])`**.** Two connections, two transactions. If one fails, the other is already committed.
- **A side effect inside the transaction.** An HTTP call, a queue publish, an email. The outside world sees state that is not committed yet, or acts on work that will be rolled back. Move the call after the commit, or use an outbox ([01c](01c-outbox-pattern.md), [01e](01e-external-calls-inside-transactions.md)).

**The seven names, in one paragraph.** Java’s Spring and .NET give these decisions names, and TypeORM copies them: `REQUIRED` = join; `NESTED` = savepoint; `REQUIRES_NEW` = second connection; `SUPPORTS` and `NOT_SUPPORTED` = run without one; `MANDATORY` and `NEVER` = assert which case you think you are in. You will meet them in framework documentation and code review comments. There is nothing to memorize, because each name is just one row of the table above.

**Proof**

```ts
// 1. A failure rolls back every write on the connection.
assert.deepEqual(db.committed, []);

// 2. An inner BEGIN is ignored; its COMMIT commits the caller's rows too, and
//    the caller's ROLLBACK afterwards does nothing.
assert.deepEqual(db.committed, ["o-1", "audit-o-1"]);

// 3. A savepoint undoes the bonus and keeps the order.
assert.deepEqual(db.committed, ["o-1"]);

// 4. A second connection commits while the caller rolls back — and saw nothing
//    of the caller's pending row.
assert.deepEqual(db.committed, ["audit-1"]);

// 5. With a one-connection pool, the second transaction never starts.
await assert.rejects(async () => withTransaction(db, async () => {
  await withTransaction(db, () => undefined);
}), /pool exhausted/);

// 6. Two independently-owned transactions cannot fail together.
assert.deepEqual(db.committed, ["o-1", "p-1"]);

// 7. The second connection can fail without taking the caller down.
assert.deepEqual(db.committed, ["o-1"]);
```

## Questions to ask

- Does this write have to fail with the caller’s transaction, or survive it?
- If it survives, am I prepared to hold a second connection — and can it even see what the caller is doing?
- Is this call really “optional within one commit” (savepoint), or am I using a savepoint to avoid a real second transaction?
- Is the helper I am calling opening its own transaction because it must, or because nobody passed it a connection?
- What is this code doing *inside* the transaction that talks to the outside world?

## What this is not

- It is not a claim that every call needs isolation. The default — one connection, one transaction, passed down — is right almost always.
- It is not about transactions across two systems. That is §26 and §27, and the answer there is not a nested transaction.
- It is not a reason to avoid savepoints. They are the cheapest way to make one step optional.

## 23. Isolation levels

*Atomicity is about failure. Isolation is about concurrency: what one transaction is allowed to see of another’s half-finished work.*

**The context.** §22 was about one transaction and its own failures. This is a different problem. Two transactions run at the same time, and each one can observe the other’s partial work, or be surprised by work that landed between two of its own statements. Isolation is the contract that decides how much of that is allowed.

**The three anomalies, as stories.** These are not abstract; each one is a support ticket.

- **Dirty read.** A transfer has moved $100 out of an account but not committed. Your loan check reads the new balance, approves the loan, and then the transfer rolls back. You made a decision on a value that never existed.
- **Non-repeatable read.** Inside one transaction you read an account twice, and get different numbers, because someone committed in between. Your transaction is now reasoning about two different worlds.
- **Phantom.** You count the rows matching a condition, someone inserts another matching row and commits, and you count again and get a different answer. The classic break: “no two active bookings for the same room” — both requests check “no conflict”, both insert, both are right at the moment they checked.

A fourth anomaly, **lost update**, is a write-write collision: two transactions read the same balance and both write back `balance - 100`, so one decrement disappears. Isolation levels alone do not fix it in the common engines; it needs a lock or a version check (§24).

**The levels, honestly.**

| Level | Dirty read | Non-repeatable | Phantom | In practice |
| --- | --- | --- | --- | --- |
| `READ UNCOMMITTED` | possible | possible | possible | Postgres accepts it and silently runs `READ COMMITTED` |
| `READ COMMITTED` | no | possible | possible | Default in Postgres, Oracle, SQL Server. Each statement sees the latest committed state |
| `REPEATABLE READ` | no | no | no\* | Default in MySQL/InnoDB. In Postgres it is snapshot isolation: one snapshot for the whole transaction |
| `SERIALIZABLE` | no | no | no | Postgres uses SSI: little blocking, but it **aborts** conflicting transactions (`40001`) |

\* The SQL standard allows phantoms at `REPEATABLE READ`. Postgres and InnoDB do not, which is why the standard’s table is a poor guide to what your database does. Read the engine’s documentation, not the standard’s.

**Why not always** `SERIALIZABLE`**.** Because “correct” has a bill. Higher isolation means fewer concurrent outcomes, and Postgres’s `SERIALIZABLE` pays it in aborts rather than locks: your transaction fails with `40001` and must be retried. A serializable level **without a retry loop** is not more correct — it just moves the failure from your data to your users.

**Choosing, by invariant rather than by feel.**

| The invariant | The cheapest mechanism |
| --- | --- |
| “This row’s value must be current when I write it” | `SELECT … FOR UPDATE` at `READ COMMITTED` (§24) |
| “This value must be unique” | A unique index — not a `SELECT` then `INSERT` |
| “A sum or count across rows must hold” | `SERIALIZABLE` **plus** a retry loop, or a lock on a row that represents the set |
| “A stale read is fine, I just need consistency within a report” | `REPEATABLE READ` |
| “I need one value right now” | The default `READ COMMITTED` |

The mistake is choosing a level globally “to be safe”. Safety is an invariant, not a setting. Pick the level for the transaction, and the lock or constraint for the specific rule.

**Correct** — set the level on the transaction, and retry when the database aborts it:

```ts
async function withSerializable<T>(pool: Pool, work: (c: PoolClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      const code = (error as { code?: string }).code;
      if (code !== "40001" || attempt === 2) throw error; // 40001 = serialization_failure
    } finally {
      client.release();
    }
  }
}
```

Which is also why `work` must be free of side effects: it may run three times. External calls and queue publishes do not belong inside a retried transaction (§22, [01e](01e-external-calls-inside-transactions.md)).

**Anti-pattern**

```ts
// 1. Setting the level on the connection instead of the transaction.
await pool.query("SET SESSION default_transaction_isolation = 'serializable'");

// 2. Read-modify-write with no lock: a lost update waiting for traffic.
const { rows } = await pool.query("SELECT balance FROM accounts WHERE id = $1", [id]);
await pool.query("UPDATE accounts SET balance = $1 WHERE id = $2", [rows[0].balance - 100, id]);
```

Two separate bugs. The `SET SESSION` sticks to that pooled connection, so it silently applies to whichever request borrows it next — and stops applying to the request after that. The read-modify-write is a lost update even at `SERIALIZABLE` if it is not retried, and is simply wrong at `READ COMMITTED`.

**Where this bites in Node.**

- `SELECT` **then** `UPDATE` **is a race.** The gap between the two statements is where the other request lives. `FOR UPDATE`, or `UPDATE … SET x = x - 100` in one statement, or a version column.
- **“Check then insert” cannot enforce uniqueness.** A unique index is the only thing that can. Everything else is a query that was true a millisecond ago.
- **Polling inside a long transaction.** At `REPEATABLE READ` you will never see rows committed after your snapshot; a loop waiting for work will wait forever. Keep transactions short.
- `SET SESSION` **on a pooled client** leaks isolation to unrelated requests. Use `BEGIN ISOLATION LEVEL …` or `SET LOCAL` inside the transaction.
- `SERIALIZABLE` **without retries** turns a rare conflict into a 500 for the user.

**Proof**

```ts
// An uncommitted write is visible at READ_UNCOMMITTED, invisible at READ_COMMITTED.
assert.equal(db.read("READ_UNCOMMITTED", reader, "a"), 2); // dirty read
assert.equal(db.read("READ_COMMITTED", reader, "a"), 1);

// The writer commits. A second read in the same transaction changes its answer.
assert.equal(db.read("READ_COMMITTED", reader, "a"), 2);  // non-repeatable
assert.equal(db.read("REPEATABLE_READ", reader, "a"), 1); // pinned snapshot

// A new row appears between two identical queries, unless the snapshot is pinned.
assert.deepEqual(db.list("READ_COMMITTED", reader), ["a", "b"]); // phantom
assert.deepEqual(db.list("REPEATABLE_READ", reader), ["a"]);      // no phantom

// And the pinned snapshot still permits write skew: two doctors each see
// "two on call", each goes off call, both commit, nobody is on call.
const onCall = (level: Isolation, tx: Tx) =>
  db.list(level, tx).filter((id) => db.read(level, tx, id) === 1).length;
assert.equal(onCall("READ_COMMITTED", db.begin()), 0);
```

## Questions to ask

- What invariant must hold, and which statement in this transaction could break it?
- Is this a read that needs one value, or a read that needs a stable world? (One statement vs. a whole transaction.)
- Am I using isolation to avoid a lock, or a lock to avoid `SERIALIZABLE`?
- If the database aborts this transaction, what retries it — and is the retry safe?
- Did I set the level for this transaction, or for the connection?
- What in this transaction could move after the commit?

## What this is not

- It is not about atomicity or nested transactions. That is §22.
- It is not a substitute for a constraint. Isolation coordinates readers and writers; a unique index enforces a fact.
- It is not “higher is better”. `SERIALIZABLE` without retries converts a data bug into an availability bug.
- It is not portable. The same level name means different things in Postgres, MySQL, and SQL Server; the table above is the common case, the engine’s manual is the truth.

## 24. Optimistic vs. pessimistic locking

**Rule.** Optimistic locking detects a stale write with a version check. Pessimistic locking prevents the concurrent write with a lock. A blind write does neither.

**Correct**

```ts
class VersionedStore {
  update(expectedVersion: number, value: number): void {
    if (this.row.version !== expectedVersion) throw new Conflict();
    this.row.value = value;
    this.row.version += 1;
  }
}

class RowLock {
  acquire(): void {
    if (this.held) throw new Busy();
    this.held = true;
  }
  release(): void { this.held = false; }
}
```

**Anti-pattern**

```ts
class BlindWriteStore {
  update(value: number): void {
    this.value = value; // last write wins
  }
}
```

**Proof**

```ts
const store = new VersionedStore();
const first = store.read();
const second = store.read();
store.update(first.version, 80);
assert.throws(() => store.update(second.version, 70), Conflict);

const lock = new RowLock();
selectForUpdate(lock, () => assert.throws(() => lock.acquire(), Busy));

const blind = new BlindWriteStore();
blind.update(80);
blind.update(70);
assert.equal(blind.read(), 70); // 80 was lost
```

## 25. Idempotency

**Rule.** A retry is safe when the operation is keyed. The key identifies the logical request, not the transport attempt.

**Correct**

```ts
class OrderStore {
  private readonly byKey = new Map<string, Order>();

  create(key: string, total: number): Order {
    const existing = this.byKey.get(key);
    if (existing) return existing;

    const order = { id: randomUUID(), idempotencyKey: key, total };
    this.byKey.set(key, order);
    return order;
  }
}
```

**Anti-pattern**

```ts
class BadOrderStore {
  private readonly orders: Order[] = [];

  create(key: string, total: number): Order {
    const order = { id: randomUUID(), idempotencyKey: key, total };
    this.orders.push(order); // every retry creates a new order
    return order;
  }
}
```

**Proof**

```ts
const store = new OrderStore();
const first = store.create("checkout-123", 42);
const second = store.create("checkout-123", 42);
assert.equal(second.id, first.id);
assert.equal(store.count(), 1);

const bad = new BadOrderStore();
bad.create("checkout-123", 42);
bad.create("checkout-123", 42);
assert.equal(bad.count(), 2);
```

## 26. Distributed boundaries

**Rule.** A local transaction cannot span two services. Use a saga with compensation, or an outbox for reliable events. Do not dual-write.

**Correct**

```ts
function runSaga(orders: OrderService, payments: PaymentService): void {
  const event = orders.outbox.shift();
  if (!event) return;

  try {
    payments.charge(event.orderId);
    orders.markPaid(event.orderId);
  } catch {
    orders.cancel(event.orderId); // compensation
  }
}
```

**Anti-pattern**

```ts
function badFlow(orders: OrderService, payments: PaymentService, id: string): void {
  orders.orders.set(id, "pending");
  payments.charge(id); // if this throws, the order stays pending
  orders.markPaid(id);
}
```

**Proof**

```ts
const orders = new OrderService();
const payments = new PaymentService();
orders.create("fail");
runSaga(orders, payments);
assert.equal(orders.orders.get("fail"), "cancelled");

const bad = new OrderService();
assert.throws(() => badFlow(bad, payments, "fail"), /payment failed/);
assert.equal(bad.orders.get("fail"), "pending");
```

## 27. Eventual consistency

**Rule.** The write model and the read projection update at different times. The UI must handle “pending”, not assume read-your-writes across a boundary.

**Correct**

```ts
class Projection {
  private readonly rows = new Map<string, Order>();

  apply(order: Order): void { this.rows.set(order.id, order); }

  get(id: string): OrderView {
    const row = this.rows.get(id);
    return row ? { status: "ready", total: row.total } : { status: "pending" };
  }
}

class WriteModel {
  save(order: Order): void {
    this.orders.set(order.id, order);
    setTimeout(() => this.projection.apply(order), 10);
  }
}
```

**Anti-pattern**

```ts
function readYourWrites(writeModel: WriteModel, id: string): OrderView {
  const row = writeModel.get(id);
  return row ? { status: "ready", total: row.total } : { status: "pending" };
}
```

**Proof**

```ts
writeModel.save({ id: "o-1", total: 42 });
assert.deepEqual(projection.get("o-1"), { status: "pending" });

assert.deepEqual(readYourWrites(writeModel, "o-1"), { status: "ready", total: 42 });
// It looks consistent only because it reads the wrong store.

await sleep(20);
assert.deepEqual(projection.get("o-1"), { status: "ready", total: 42 });
```

## 28. Logging placement

**Rule.** Each layer logs its own concern. Presentation does not log SQL; persistence does not log HTTP statuses.

**Correct**

```ts
class GoodFlow {
  run(): void {
    this.logger.log("presentation", "POST /orders request-1");
    this.logger.log("application", "place order o-1");
    this.logger.log("persistence", "INSERT orders id=o-1");
  }
}
```

**Anti-pattern**

```ts
class BadFlow {
  run(): void {
    this.logger.log("presentation", "INSERT INTO orders (id) VALUES ('o-1')");
    this.logger.log("persistence", "HTTP 200 OK");
  }
}
```

**Proof**

```ts
const logger = new Logger();
new GoodFlow(logger).run();

assert.equal(messagesFor(logger, "presentation").some((m) => m.includes("SELECT")), false);
assert.equal(messagesFor(logger, "persistence").some((m) => m.includes("HTTP")), false);
```

## 29. Authorization placement

**Rule.** Authentication is coarse and at the edge. Authorization that depends on the business object belongs in the domain.

**Two questions, not one.**

- **Authentication — “who are you?”** It depends on the token or session, never on the order. Verified once at the edge; the result is a `User`, or a rejection.
- **Authorization — “may you do this to *this* object?”** This splits again:
  - *Route policy:* “only support may call `POST /refunds`.” No object needed; the edge can enforce it.
  - *Object policy:* “may this user refund *this* order?” It needs the order’s owner, status, and amount. The edge has an id, not the order.

**Why the object rule does not live in the controller.** Reuse is the symptom, not the reason:

1. **The controller does not have the object.** To check ownership it must load the order — which gives the controller a repository, and loads the order twice: once for the check, once for the change.
2. **There is more than one door.** The same operation arrives from HTTP, a queue consumer, an admin CLI, a scheduled job. A rule in the controller must be copied into every new door; a rule in the domain is enforced for all of them.
3. **It is a business rule.** Refund windows, amount caps, “support may refund up to $500” change for business reasons, on a different schedule than the transport.

**Correct**

```ts
class RefundPolicy {
  canRefund(user: User, order: Order): boolean {
    if (order.status === "refunded") return false;
    if (user.role === "support") return true;
    return order.ownerId === user.id && order.total <= 100;
  }
}

class RefundService {
  refund(user: User, orderId: string): void {
    const order = this.orders.find(orderId);            // load the object
    if (!this.policy.canRefund(user, order)) throw new NotAllowed();
    order.refund();
    this.orders.save(order);
  }
}

class RefundController {
  refund(user: User, orderId: string): void {
    if (!user.authenticated) throw new Unauthenticated(); // who are you
    this.service.refund(user, orderId);                   // may you, for this order
  }
}
```

The edge answers “are you logged in?”. The service loads the object and asks the policy about *it*. The domain throws `NotAllowed`; the edge maps that to `403`. The domain never knows about HTTP.

**Anti-pattern**

```ts
class BadRefundController {
  refund(user: User, _orderId: string): void {
    if (!user.authenticated) throw new Unauthenticated();
    if (user.role !== "support") throw new NotAllowed("support only");
  }
}
```

This cannot be fixed in place, because the information is not here. It cannot see `order.total`, so it denies the owner on a $42 refund. It cannot see `order.status`, so a refunded order can be refunded again. No amount of care in the controller recovers a rule that was placed where the object does not exist.

**Proof**

```ts
assert.throws(() => controller.refund(anonymous, "o-1"), Unauthenticated); // edge

assert.doesNotThrow(() => controller.refund(owner, "o-1"));   // owner, $42
assert.throws(() => controller.refund(owner, "o-2"), NotAllowed); // owner, $500 cap
assert.doesNotThrow(() => controller.refund(support, "o-2")); // support

assert.throws(() => controller.refund(support, "o-3"), NotAllowed); // already refunded

// A worker calling the service directly still gets the rule.
assert.throws(() => service.refund(owner, "o-2"), NotAllowed);

// The edge-only version denies the owner, because it only knows the role.
assert.throws(() => new BadRefundController().refund(owner, "o-1"), /support only/);
```

**What legitimately stays at the edge.** Authentication, route-level role checks, request validation, and **tenant scoping** — though scoping is usually better in the repository or query builder (§42), so no query can forget it.

## Questions to ask

- Does this rule need the object’s state, or only the caller’s identity?
- If I add a second entrance to this operation, will the rule still run?
- Is this an HTTP concern leaking into the domain, or a business rule leaking into HTTP?

## 30. Caching

**Rule.** Cache at the service boundary and invalidate on write. A repository cache with no invalidation serves stale data.

**Correct**

```ts
class CachedOrderService {
  private readonly cache = new Map<string, Order>();

  get(id: string): Order | undefined {
    const cached = this.cache.get(id);
    if (cached) return cached;

    const order = this.repository.findById(id);
    if (order) this.cache.set(id, order);
    return order;
  }

  save(order: Order): void {
    this.repository.save(order);
    this.cache.delete(order.id);
  }
}
```

**Anti-pattern**

```ts
class ForeverCachingRepository {
  findById(id: string): Order | undefined {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const order = this.repository.findById(id);
    if (order) this.cache.set(id, order);
    return order;
  }

  save(order: Order): void {
    this.repository.save(order);
    // no invalidation
  }
}
```

**Proof**

```ts
const repository = new OrderRepository();
repository.save({ id: "o-1", total: 10 });
const service = new CachedOrderService(repository);

service.get("o-1");
service.get("o-1");
assert.equal(repository.reads, 1); // cache hit

service.save({ id: "o-1", total: 20 });
assert.equal(service.get("o-1")?.total, 20); // invalidated
```

**Where the cache lives.** Two pieces, and only one of them is shared:

- **The mechanism** — `get` / `set` / `delete` / TTL, keyed by string, no domain types. This belongs in `shared/` (or `infrastructure/`), next to the logger and the clock.
- **The policy** — the key shape (`order:${id}`), the TTL, and *when* to invalidate. No generic cache can know that an order changed. It stays in the module that owns `Order`, as a thin decorator around the repository port.

```ts
// shared/cache.ts — knows nothing about orders
interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
}

// orders/infrastructure/cached-order-repository.ts — owns the policy
class CachedOrderRepository implements OrderRepository {
  async findById(id: string) {
    const key = `order:${id}`;
    const hit = await this.cache.get<Order>(key);
    if (hit) return hit;
    const order = await this.orders.findById(id);
    if (order) await this.cache.set(key, order, 30_000);
    return order;
  }

  async save(order: Order) {
    await this.orders.save(order);
    await this.cache.delete(`order:${order.id}`); // after commit
  }
}
```

Mechanism in `shared/`, twelve lines of policy in the module. Putting the *policy* in `shared/` is how the folder becomes a junk drawer (§33); putting the *mechanism* in each module means re-implementing expiry three times. The guardrail: the cache is injected into adapters and services, never into the domain.

**Invalidate by deleting, not by setting.** Writing the new value on every save pushes the database’s write load into a store with far less space, caches values nobody has read, and can apply out of order — the older value wins until eviction. Deleting lets the next read repopulate: cheaper, and it self-heals.

Two rules that go with it:

- **Delete after the commit.** Inside the transaction, a rollback loses a good entry, and a concurrent reader can refill from the pre-commit row.
- **TTL is a bound on staleness, not a replacement for invalidation.** It covers the read-fill race (reader loads the old row, writer deletes, reader populates the old value) and per-process caches that never hear about another node’s write.

## 31. Configuration

**Rule.** Read and validate configuration at the edge; pass typed values inward. The domain should not read `process.env`.

**Why** `process.env` **is a coupling.** It is a global, mutable, untyped singleton, and reading it inside a method makes it a dependency the interface does not declare:

- **Hidden.** `new PricingService()` says nothing about needing `TAX_RATE`. The dependency is invisible at the constructor, the type, and the call site — the same failure as any implicit global state ([00c](../fundamentals/oop/00c-implicit-global-state.md)).
- **Unsubstitutable.** One service cannot use 10% while another uses 20% in the same process, and a test cannot change the default without changing it for everything else running.
- **Frozen at import.** A module-level `const RATE = Number(process.env.TAX_RATE)` is read once, at import time — before a test or a tenant can set it.
- **Time-dependent.** The value can change between two calls, so the object has no single configuration, and its behaviour is not a function of its inputs.
- **Unvalidated.** `Number("abc")` is `NaN`, and `?? 0.2` quietly invents a value when the variable is missing. A missing setting should fail at startup, not produce a plausible wrong number.

Injection does not remove the dependency. It makes it **visible, substitutable, and validated in one place**.

**Correct**

```ts
type AppConfig = { taxRate: number };

// The edge reads the environment once, and proves the values are usable.
function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const taxRate = Number(env.TAX_RATE);
  if (!Number.isFinite(taxRate)) throw new Error("TAX_RATE must be a number");
  return { taxRate };
}

class PricingService {
  private readonly config: AppConfig;
  constructor(config: AppConfig) { this.config = config; }

  total(base: number): number {
    return base * (1 + this.config.taxRate);
  }
}
```

Everything inward takes `AppConfig`; nothing inward touches the environment. A bad value fails at the composition root, before the first request.

**Anti-pattern**

```ts
class BadPricingService {
  total(base: number): number {
    const rate = Number(process.env.TAX_RATE ?? 0.2);
    return base * (1 + rate);
  }
}
```

**Proof**

```ts
const service = new PricingService(loadConfig({ TAX_RATE: "0.1" }));
assert.equal(Math.round(service.total(100)), 110);

// The dependency is visible: another rate is just another argument.
assert.equal(Math.round(new PricingService({ taxRate: 0.2 }).total(100)), 120);

// A missing or unparsable value fails at the edge, not mid-calculation.
assert.throws(() => loadConfig({}), /TAX_RATE must be a number/);
assert.throws(() => loadConfig({ TAX_RATE: "abc" }), /TAX_RATE must be a number/);

// The anti-pattern reads ambient state, and hides a default.
process.env.TAX_RATE = "0.1";
assert.equal(Math.round(new BadPricingService().total(100)), 110);
delete process.env.TAX_RATE;
assert.equal(Math.round(new BadPricingService().total(100)), 120); // hidden default
```

## 32. Dependency injection and wiring

**Rule.** Nothing constructs its own collaborators. One place at startup constructs everything and passes it in; that place is the composition root (`main()`, `createApp()`).

**What the words mean.** None of them require a framework.

- **Collaborator** — any object this one *talks to* in order to do its job: a repository, a clock, a mailer, an HTTP client. The line that matters is data vs. behaviour: an `Order` is **data** (held or returned), the `orders` repository is a **collaborator** (called). Only collaborators are injected. ([fundamentals/06-collaborators](../fundamentals/06-collaborators/README.md))
- **Dependency** — anything the object needs from the outside: usually a collaborator, sometimes a value like the `AppConfig` from §31.
- **Injection** — passing it in as a constructor argument, instead of creating it inside.
- **Wiring** — the one function that decides which concrete class plays each role, and hands it down.
- **Port** — the interface the service says it needs. The concrete behind it is the root’s business, not the service’s.

A DI container is just a way to write the wiring function when the graph gets large. A function is dependency injection too. The point is *where the concrete is chosen*, not which library does the choosing.

**Why not** `new` **inside the service.** “It is hard to test” is the smallest of the costs:

1. **Unsubstitutable.** The concrete is fixed when the object is constructed. You cannot swap in a fake, an in-memory version, or a different adapter for a different tenant.
2. **Hidden dependency.** `new OrderService()` reveals nothing; you discover the repository by reading the body. The same defect as `process.env` in §31, with a different global.
3. **Nobody owns the lifetime.** If each service builds its own client, you get N pools, N connections, N caches, and no one to close them. In Node this is how you exhaust Postgres.
4. **Construction details leak.** The service now needs the repository’s constructor arguments — pool, URL, config — so a wiring change ripples into code that should not know about wiring.

**Correct**

```ts
class OrderService {
  private readonly orders: OrderRepository;   // a port, not a class
  constructor(orders: OrderRepository) { this.orders = orders; }

  create(total: number): Order {
    const order = { id: `o-${total}`, total };
    this.orders.save(order);
    return order;
  }
}

// The composition root: the one file allowed to know every concrete class.
function createApp(deps: { orders: OrderRepository }): OrderController {
  return new OrderController(new OrderService(deps.orders));
}

// main
const app = createApp({ orders: new PostgresOrders(pool) });
```

The root is deliberately boring and deliberately central. It is the only module that imports from every layer, which is exactly why it stays small: anything that grows there is a sign a decision is being made too late.

**Anti-pattern**

```ts
class BadOrderService {
  private readonly orders = new InMemoryOrderRepository(); // chosen here, unchangeable outside

  create(total: number): Order {
    const order = { id: `bad-${total}`, total };
    this.orders.save(order);
    return order;
  }
}
```

The field is private, so no caller can reach it, and the constructor takes no argument that could replace it. There is no seam: the only way to change the behaviour is to edit the class.

**Proof**

```ts
// The root can pass a test double; the service is unchanged.
const spy = new SpyOrderRepository();
createApp({ orders: spy }).create(10);
assert.equal(spy.saves, 1);

// The same service class works with a different implementation.
const real = createApp({ orders: new PostgresOrders(pool) });
real.create(20);

// The anti-pattern does the opposite: each instance owns a private store.
const a = new BadOrderService();
const b = new BadOrderService();
a.create(10);
assert.equal(b.count(), 0); // the write in `a` is invisible to `b`
```

That last assertion is the real cost. In tests it looks like a private field; in production it is two pools, two caches, and data that only one instance can see.

## Questions to ask

- Does this class choose a concrete collaborator, or receive it?
- If I needed a fake here tomorrow, is there a seam to put it in?
- Is this wiring code in the composition root, or has it leaked into a service?
- Does anything in the domain `import` a class from `infrastructure`?

## 33. Shared utilities

**Rule.** A shared kernel is small, stable, and a leaf. A `utils` folder that imports persistence is a boundary violation.

**First, the distinction.** Sharing code is not the anti-pattern. Every codebase needs a `shared/` or `utils/` folder, and `Money`, `Result`, `Clock`, `assertNever`, and the `Cache` interface from §30 belong there. The anti-pattern is narrower: **a file in** `shared/` **that imports a layer.** The folder is fine; the direction of one import is not.

```ts
// shared/money.ts — fine: it imports nothing from the application
export class Money {
  constructor(readonly cents: number) {}
  add(other: Money): Money { return new Money(this.cents + other.cents); }
}

// shared/order-helpers.ts — the violation
import { pool } from "../db.ts";             // shared → persistence
import { Order } from "../domain/order.ts";  // shared → domain
```

**Why the direction matters.** Everything imports `shared/`. So whatever `shared/` imports, everything imports transitively:

```
domain/pricing.ts → shared/order-helpers.ts → db.ts
```

The pricing rule now needs Postgres to compile and to test. Nobody decided that; one import, in a folder everyone uses, did it. The leaf grew a root.

**Why "small and stable" as well.** Everything in `shared/` is a public API for the repository: a change there is reviewed and re-tested by every module. Adding to it is locally cheap and globally expensive, which is why `utils/` fills with `db.ts`, `order-mapper.ts`, and `auth.ts` — each a small favour to one caller and a permanent tax on everyone else.

**What belongs, and what does not.**

| Belongs in `shared/` | Does not |
| --- | --- |
| `Money`, `Duration`, `Result` | `Order`, `Invoice` — domain concepts |
| `Clock`, an id generator | `orderMapper` — knows the persistence shape |
| `assertNever`, `sleep` | `db.ts`, `pool.ts` — infrastructure |
| The `Cache` interface (§30) | `auth.ts` — knows sessions and HTTP |

**Correct**

```ts
type Module = "presentation" | "application" | "domain" | "persistence" | "shared";
type Edge = { from: Module; to: Module };

const correct: Edge[] = [
  { from: "presentation", to: "application" },
  { from: "presentation", to: "shared" },
  { from: "application", to: "domain" },
  { from: "domain", to: "shared" },
  { from: "persistence", to: "shared" },
];

function forbidden(edges: Edge[]): Edge[] {
  return edges.filter((edge) =>
    edge.from === "shared" ||
    (edge.from === "domain" && edge.to !== "shared"),
  );
}
```

This snippet is not a utility; it is the **check**. The rule is worth nothing if it lives in a reviewer's memory, so it becomes a lint or CI rule over imports: `shared` may have no edges out, and `domain` may only point at `shared`. The utility the folder exists for — `Money` — is in the example file.

**Anti-pattern**

```ts
const bad: Edge[] = [
  ...correct,
  { from: "shared", to: "persistence" }, // utils imports the pool
  { from: "domain", to: "persistence" }, // the domain imports the pool directly
];
```

In files, the first edge is `shared/utils.ts` containing `import { pool } from "../db.ts"`. It usually arrives as a helper that saves a row, which means an application service has been written inside the shared folder.

**Proof**

```ts
assert.deepEqual(forbidden(correct), []);
assert.deepEqual(forbidden(bad), [
  { from: "shared", to: "persistence" },
  { from: "domain", to: "persistence" },
]);
```

## Questions to ask

- Does anything in `shared/` import from a module? (If yes, it is not shared.)
- Is this used in three places, or is it used once and parked here “for later”?
- Does this file know a domain concept — `Order`, `refund`, `invoice`? Then it belongs to that domain.
- Would a change here force every module to re-test? Then it had better be small.

## 34. Domain events

**Rule.** Record the event in the same transaction as the state change. Publish after commit. An event emitted before commit can describe a state that never existed.

**Correct**

```ts
class OrderService {
  place(id: string, fail: boolean): void {
    this.store.begin();
    try {
      this.store.addOrder(id);
      this.store.addEvent(`OrderPlaced:${id}`);
      if (fail) throw new Error("order failed");
      this.store.commit();
    } catch (error) {
      this.store.rollback();
      throw error;
    }

    for (const event of this.store.drainOutbox()) {
      this.bus.publish(event);
    }
  }
}
```

**Anti-pattern**

```ts
class BadOrderService {
  place(id: string, fail: boolean): void {
    this.bus.publish(`OrderPlaced:${id}`); // before the write is durable
    if (fail) throw new Error("order failed");
    this.store.committedOrders.push(id);
  }
}
```

**Proof**

```ts
const store = new Store();
const bus = new EventBus();

assert.throws(() => new OrderService(store, bus).place("o-1", true), /failed/);
assert.deepEqual(store.committedOrders, []);
assert.deepEqual(bus.published, []); // no phantom event

assert.throws(() => new BadOrderService(store, bus).place("o-2", true), /failed/);
assert.deepEqual(bus.published, ["OrderPlaced:o-2"]); // phantom event
```

## 35. Unit testing per layer

**Rule.** Test each layer with a fake for the layer below. Do not require a database to test a business rule.

**Correct**

```ts
class FakeOrderRepository implements OrderRepository {
  readonly saved: Order[] = [];
  save(order: Order): void { this.saved.push(order); }
}

test("the service is tested with a fake repository", () => {
  const repository = new FakeOrderRepository();
  new OrderService(repository).create(10);
  assert.equal(repository.saved.length, 1);
});

test("the controller is tested with a fake service", () => {
  const service = new SpyOrderService();
  new OrderController(service).create(20);
  assert.equal(service.calls, 1);
});
```

**Anti-pattern**

```ts
test("everything through the real database", () => {
  const db = new RealDb();
  db.connect(); // every test now needs infrastructure
  const controller = new OrderController(new OrderService(new SqlOrderRepository(db)));
  controller.create(10);
  assert.equal(db.rows.length, 1);
});
```

**Proof**

```ts
const repository = new FakeOrderRepository();
new OrderService(repository).create(10);
assert.equal(repository.saved.length, 1);
// No database was started.
```

## 36. Integration testing at boundaries

**Rule.** Test the adapter against the real dependency. A mock cannot prove a primary key, a foreign key, or a transaction.

**What “real” means.** The collaborator must be something your code does not control: a database engine, a broker, an HTTP server, the filesystem. The example uses SQLite in memory — still a *real* engine (real SQL, real constraints), just a cheap one. In CI, use the same engine and major version as production, started for the test run.

**The guidelines.**

1. **Same engine, same major version.** `postgres:16` in a container, not SQLite pretending to be Postgres. Dialects differ on `ON CONFLICT`, `RETURNING`, JSON types, collation, and isolation.
2. **Build the schema from the real migrations.** A hand-written `CREATE TABLE` in the test proves a schema that production does not have; the first migration will disagree with it.
3. **One disposable database per worker.** Not a shared dev database. Shared state makes tests order-dependent, and leftover rows make failures impossible to reproduce.
4. **Start it per run; tear it down.** A container or a temp schema, and a pool closed in `after`. A leaked connection turns the next test into a mystery.
5. **Test the boundary, not the rule.** Constraints, types, SQL, mappings, error codes, commit and rollback. The business logic was covered with a fake in §35.
6. **Keep the set small.** These tests are slow. One or two per adapter, aimed at the behaviours a fake cannot reproduce.
7. **Write down what you are not testing.** If the engine differs from production, or the version is older, say which behaviours are unverified. Silence reads as coverage.
8. **Pair with a contract test (§37).** This proves the real adapter works; the contract test proves the fake agrees with it.

**Which boundaries get this treatment.**

| Boundary | The real dependency |
| --- | --- |
| Database | The engine itself, in a container |
| HTTP client | A stub server, or the real service in a test environment |
| Queue / broker | The broker, or a compatible test instance |
| Filesystem | A temporary directory |

If the boundary is *inside* your process — a port you own — that is a fake, and §35 covers it.

**Correct**

```ts
class SqlOrderRepository {
  private readonly db: DatabaseSync;
  constructor(db: DatabaseSync) { this.db = db; }

  save(order: Order): void {
    this.db.prepare("INSERT INTO orders (id, total) VALUES (?, ?)")
      .run(order.id, order.total);
  }
}

const db = new DatabaseSync(":memory:");
// Reduced for the example: in CI this schema comes from the migrations.
db.exec("CREATE TABLE orders (id TEXT PRIMARY KEY, total INTEGER NOT NULL)");
const repository = new SqlOrderRepository(db);

repository.save({ id: "o-1", total: 10 });
assert.throws(() => repository.save({ id: "o-1", total: 20 }), /UNIQUE|constraint/i);
```

The CI version of the same test replaces the first two lines with the production engine and the real migrations:

```ts
const db = await startPostgres("postgres:16"); // container, same major version
await runMigrations(db);                       // the migrations production runs
const repository = new SqlOrderRepository(db);
```

**Anti-pattern**

```ts
class MockOrderRepository {
  readonly rows: Order[] = [];
  save(order: Order): void { this.rows.push(order); }
}

const mock = new MockOrderRepository();
mock.save({ id: "o-1", total: 10 });
mock.save({ id: "o-1", total: 20 });
assert.equal(mock.rows.length, 2); // the duplicate passes
```

The other version of this mistake is the shared dev database: tests pass alone, fail in a suite, and leave rows that change next week’s result.

**Proof**

```ts
// The real adapter rejects the duplicate; the mock never sees the constraint.
assert.throws(() => repository.save({ id: "o-1", total: 20 }), /UNIQUE|constraint/i);
assert.equal(mock.rows.length, 2);
```

## Questions to ask

- Which behaviour here belongs to the dependency rather than to my code?
- Am I running the same engine and version as production?
- Did the schema come from the migrations?
- Will this test leave anything behind for the next run?
- Is this a boundary at all, or a port I could fake more cheaply?

## 37. Contract testing

**Rule.** The consumer owns the contract. Every provider implementation — fake, HTTP, vendor — must satisfy the same test.

### 37.1 A contract test is not a unit test: replace the endpoint, not the call

**The difference in one line.** A unit test fakes the gateway; a contract test exercises it.

|  | Unit test (§35) | Contract test (§37) |
| --- | --- | --- |
| Subject | the service or use case | the gateway implementation |
| Gateway | a fake; the real one is never constructed | the real adapter, called |
| Network | none | real HTTP to a stand-in |
| Proves | the rule | the provider keeps its promise |
| Layer above | present — it is the subject | absent |

**What is replaced is the destination, not the call.** The adapter keeps its real HTTP client, real JSON, real headers, and real error handling. Only the base URL and the credentials change:

```ts
// On every PR: a local stub. No internet, deterministic answers.
const stub = new HttpGateway({ baseUrl: "http://localhost:4010", apiKey: "test" });
await assertPaymentContract(stub);

// Nightly: the vendor's sandbox. The same code, real responses, test credentials.
const sandbox = new HttpGateway({ baseUrl: "https://sandbox.example.test", apiKey: TEST_KEY });
await assertPaymentContract(sandbox);
```

**Why the call must not be mocked.** If you stub the HTTP client, the test still passes when the URL is wrong, the auth header is missing, `10` is sent as `"10"`, or `id` is read from the wrong field of the response. Those are the defects this test exists to catch.

**The rule of thumb.** A mock may not cross the boundary you are testing. In §35 the gateway is a collaborator, so faking it is correct. In §37 it is the subject, so it stays real and only its destination is substituted.

**The warning sign.** `if (process.env.NODE_ENV === "test")` inside the adapter. Test mode is configuration — a base URL and a key — not a branch in the code under test.

**The three words.**

- **Consumer** — the code that calls the gateway. Your payment use case.
- **Provider** — anything that implements it: the in-memory fake, the HTTP adapter, a vendor SDK, the next version of the API.
- **Contract** — the small set of behavioural promises the consumer actually relies on.

**Why the consumer owns it.** The consumer is who breaks when the promise is unmet, so the consumer decides what the promise is. Here it is: `charge(10)` resolves to an object with a non-empty string `id` and a `status` of `"paid"` or `"failed"`. Nothing about headers, the full body, or how the gateway works inside.

A provider-written contract documents what the provider *happens* to do — every field it returns, every internal detail — and then any change is called breaking even when no consumer reads it. The consumer relies on a slice, so the slice is the contract.

**Why the same test.** One function, run against every implementation:

```ts
await assertPaymentContract(new FakeGateway());
await assertPaymentContract(stub); // the real adapter, pointed at the stand-in
```

Not one test per implementation. Those drift apart within a month, and each one only proves that a thing equals itself. One executable definition, reused, is the contract.

This is what makes the fake in §35 trustworthy. The fast unit tests use `FakeGateway`; the contract test proves `FakeGateway` behaves like `HttpGateway` for the behaviour the use case depends on. Without it, the unit tests prove that the fake works.

In microservices the same idea is called consumer-driven contracts (Pact is the common tool): the consumer publishes its expectations, the provider verifies them in its own CI. Same rule, one process larger.

**A type is not a contract.** The anti-pattern returns `{ ok: true }`. TypeScript accepts it because `as unknown as PaymentGateway` turns checking off, and an interface only promises a shape at compile time. JSON, HTTP, and fakes have no compiler at runtime. The contract test checks the value, and fails with `result.id is not a string` — the failure the fake would otherwise have hidden until production.

**Where this sits.** §35 tests against a fake, §36 tests the real adapter against the real dependency, §37 checks that the two agree. Remove this section and the first is only self-consistent.

**What belongs in a contract.**

| In | Out |
| --- | --- |
| The success shape the consumer reads | The full response body |
| Error behaviour: declined, timeout, duplicate charge | Internal headers, vendor-specific fields |
| How each error maps to a result | Call order, performance, retries |

Narrow is durable: every promise you add is a change you can no longer make without breaking a consumer.

**Correct**

```ts
async function assertPaymentContract(gateway: PaymentGateway): Promise<void> {
  const result = await gateway.charge(10);
  assert.equal(typeof result.id, "string");
  assert.ok(result.id.length > 0);
  assert.ok(result.status === "paid" || result.status === "failed");
}

const http = new HttpGateway({ baseUrl: STUB_URL, apiKey: "test" });

await assertPaymentContract(new FakeGateway());
await assertPaymentContract(http);
```

**Anti-pattern**

```ts
class BadMockGateway {
  async charge(_amount: number): Promise<unknown> {
    return { ok: true }; // not the provider's shape
  }
}

await assertPaymentContract(new BadMockGateway() as unknown as PaymentGateway);
// TypeError / assertion: result.id is not a string
```

**Proof**

```ts
await assert.doesNotReject(assertPaymentContract(new FakeGateway()));
await assert.doesNotReject(assertPaymentContract(http));
await assert.rejects(
  assertPaymentContract(new BadMockGateway() as unknown as PaymentGateway),
  /string/,
);
```

## Questions to ask

- Which fields does the caller actually read?
- What happens on decline, on timeout, and on a duplicate charge?
- Is this test run against every implementation, or only the one being edited?
- Does the contract describe behaviour, or the provider's current payload?
- If the provider changes, would this test fail for a reason the consumer cares about?

## 38. Logical layers vs. physical tiers

**Rule.** A layer is a logical boundary. A tier is a deployment boundary. Changing the deployment shape should not change the domain or application code.

**Two words that get used interchangeably.**

|  | Layer | Tier |
| --- | --- | --- |
| What it is | a rule about who may call whom, in code | a place where code runs |
| Examples | presentation, application, domain, persistence | browser, app server, database; or one deployable vs three |
| Changes when | responsibilities change | you deploy differently |
| Fails as | an import that crosses a boundary (§33) | latency, partial failure, retries |

A "3-tier architecture" usually means three deployment units. It says nothing about how many logical layers there are. You can run a big ball of mud across three machines — three tiers, one layer.

**The rule in plain words.** Deployment is a wiring decision. Application code calls an interface; the composition root decides whether that interface is a local object or an HTTP client. If splitting the deployment forces an edit to `OrderService`, the boundary was not a boundary — the topology had leaked into the logic.

**Correct**

```ts
interface Inventory { reserve(orderId: string): void }

class OrderService {
  private readonly orders: OrderRepository;
  private readonly inventory: Inventory;
  constructor(orders: OrderRepository, inventory: Inventory) {
    this.orders = orders;
    this.inventory = inventory;
  }

  place(order: Order): void {
    this.orders.save(order);
    this.inventory.reserve(order.id);
  }
}

// One process: the same class, a local collaborator.
const monolith = new OrderService(new SqlOrders(db), new LocalInventory(db));

// Two processes: the same class, a remote one.
const split = new OrderService(new SqlOrders(db), new HttpInventory(INVENTORY_URL));
```

Only the composition root knows the shape. `OrderService` is identical in both, so its unit tests are identical too.

**Anti-pattern**

```ts
class OrderService {
  async place(order: Order): Promise<void> {
    await this.orders.save(order);
    await fetch(`${process.env.INVENTORY_URL}/reserve`, { // the topology, in the business method
      method: "POST",
      body: JSON.stringify({ orderId: order.id }),
    });
  }
}
```

Now the class only works in the split shape. To run it in one process you either make a real network call to yourself or add `if (deployment === "split")` inside `place`. Either way the method can no longer be tested without HTTP, and the "layer" is no longer separable from the wire.

**Proof**

```ts
// The same class, and the same test, in both shapes.
assert.equal(monolith.constructor, split.constructor);
assert.ok(!OrderService.toString().includes("fetch"));        // no network in the service
assert.ok(!OrderService.toString().includes("deployment"));   // no branch on topology

function assertPlaces(service: OrderService, orders: InMemoryOrders): void {
  service.place({ id: "o-1", total: 10 });
  assert.equal(orders.rows.length, 1);
}
assertPlaces(monolith, monolithOrders);
assertPlaces(split, splitOrders);
```

**When a split is worth its cost.** Independent scaling, independent release cadence, a separate team's ownership, fault isolation, or a different runtime (a GPU worker, a batch job). Absent one of those, splitting buys latency, partial failure, retries, serialization, auth, and tracing — a distributed monolith, with the same coupling and a worse debugger.

**Start as one unit.** You can split later only if the boundary already exists in the code. Splitting a layered monolith is an adapter and a wiring change; splitting one whose services call `fetch` directly is a rewrite.

## Questions to ask

- Would this class change if we merged the two deployables tomorrow?
- Does anything in `application/` or `domain/` mention a URL, a host, or a port?
- Is this split paying for itself in scaling, release cadence, ownership, or isolation?
- Is this a deployment fact, or a design preference?

## 39. Modular monolith

**Rule.** A module exposes a small public API. Other modules do not import its internals, even when they share a process.

**Correct**

```ts
type ImportEdge = {
  from: "orders" | "billing";
  target: "orders" | "billing";
  path: string;
  internal: boolean;
};

const correct: ImportEdge[] = [
  {
    from: "billing",
    target: "orders",
    path: "modules/orders/index.ts",
    internal: false,
  },
];

function violations(edges: ImportEdge[]): ImportEdge[] {
  return edges.filter((edge) => edge.from !== edge.target && edge.internal);
}
```

**Anti-pattern**

```ts
const bad: ImportEdge[] = [
  ...correct,
  {
    from: "billing",
    target: "orders",
    path: "modules/orders/internal/order-repository.ts",
    internal: true,
  },
];
```

**Proof**

```ts
assert.deepEqual(violations(correct), []);
assert.deepEqual(violations(bad), [bad[1]]);
```

## 40. Migrating toward Clean/Hexagonal

**Rule.** Invert the dependency: the domain declares the port; the adapter implements it; the composition root wires it.

**Correct**

```ts
interface PaymentGateway {
  charge(amount: number): string;
}

class StripeAdapter implements PaymentGateway {
  charge(amount: number): string { return `stripe:${amount}`; }
}

class FakeGateway implements PaymentGateway {
  charge(amount: number): string { return `fake:${amount}`; }
}

class OrderService {
  private readonly gateway: PaymentGateway;
  constructor(gateway: PaymentGateway) { this.gateway = gateway; }
  place(amount: number): string { return this.gateway.charge(amount); }
}
```

**Anti-pattern**

```ts
class BadOrderService {
  private readonly stripe = new StripeClient();

  place(amount: number): string {
    return this.stripe.charge(amount); // the domain constructs the vendor
  }
}
```

**Proof**

```ts
assert.equal(new OrderService(new StripeAdapter()).place(10), "stripe:10");
assert.equal(new OrderService(new FakeGateway()).place(10), "fake:10");
// BadOrderService has no port and no constructor parameter.
```

## 41. When to add CQRS

**Rule.** Use a read projection when reads have a different shape and change rate from writes. Do not load the write aggregate for a report.

**Correct**

```ts
class OrderSummaryQuery {
  private readonly projection: OrderProjection;
  constructor(projection: OrderProjection) { this.projection = projection; }
  execute(): OrderSummary[] { return this.projection.list(); }
}

class OrderProjection {
  readonly rows: OrderSummary[] = [
    { id: "o-1", total: 10, itemCount: 2 },
    { id: "o-2", total: 20, itemCount: 1 },
  ];
  list(): OrderSummary[] { return this.rows; }
}
```

**Anti-pattern**

```ts
class BadOrderReport {
  private readonly repository: WriteRepository;
  constructor(repository: WriteRepository) { this.repository = repository; }

  execute(): Array<{ id: string; itemCount: number }> {
    return this.repository.all().map((order) => ({
      id: order.id,
      itemCount: this.repository.loadItems(order.id).length,
    }));
  }
}
```

**Proof**

```ts
const repository = new WriteRepository();
repository.save({ id: "o-1", total: 10, items: ["book"] });
repository.save({ id: "o-2", total: 20, items: ["pen"] });

new OrderSummaryQuery(new OrderProjection()).execute();
assert.equal(repository.loads, 0); // the read does not touch the aggregate

new BadOrderReport(repository).execute();
assert.equal(repository.loads, 3); // 1 aggregate + 2 item queries
```

## 42. Multi-tenancy

**Rule.** Tenant scoping belongs in the repository or query builder, where it cannot be forgotten. An optional filter in the service is a leak waiting to happen.

**Correct**

```ts
class OrderRepository {
  private readonly context: TenantContext;
  constructor(context: TenantContext) { this.context = context; }

  find(id: string): OrderRow | undefined {
    const tenantId = this.context.tenantId;
    if (!tenantId) throw new Error("tenant context is required");
    return this.rows.find(
      (row) => row.tenantId === tenantId && row.id === id,
    );
  }
}
```

**Anti-pattern**

```ts
class LeakyOrderRepository {
  find(id: string, tenantId?: string): OrderRow | undefined {
    return this.rows.find(
      (row) => (!tenantId || row.tenantId === tenantId) && row.id === id,
    );
  }
}
```

**Proof**

```ts
const context = new TenantContext();
context.tenantId = "tenant-a";
const repository = new OrderRepository(context);
assert.equal(repository.find("o-1")?.tenantId, "tenant-a");
assert.equal(repository.find("o-2"), undefined);

const leaky = new LeakyOrderRepository();
assert.equal(leaky.find("o-2")?.tenantId, "tenant-b"); // the filter was omitted
```

## Appendix A. The vocabulary: object, class, value object, entity, model, aggregate

**Why this appendix exists.** The catalog uses these words without defining them, and ordinary speech blurs them: "model" for a class, "entity" for a table row, "object" for a value. They live on different axes, which is why a sentence that mixes them stops making sense.

| Axis | Words | Question |
| --- | --- | --- |
| Code | class, object | what is it made of? |
| Domain | value object, entity, aggregate | what does it mean, and what must stay true? |
| Transport | DTO, read model, view model | what crosses this boundary? |
| Abstraction | model | (too vague to use alone) |

A class can be a value object, an entity, a DTO, or nothing at all. "Class" describes syntax; "entity" describes a role in the domain.

**Class and object.** A class is a definition. An object is an instance of it.

```ts
class Money { /* definition */ }
const price = new Money(1000, "USD"); // instance
```

Neither word says anything about the business. `class Logger` and `new Logger()` are both correct and neither is a domain concept.

**Model.** A model is a simplified representation of something, built for a purpose. It is the vaguest word in the list, so it is the least useful in a sentence. Three different things get called "the model":

- the **domain model** — the concepts and rules of the business (`Order`, `Money`, the refund policy);
- a **read model** — a shape built to answer one query (§13);
- a **data model** — tables, columns, keys.

"Model" never tells you which one. Say the specific word instead.

**Value object.** No identity: two of them with the same value *are* the same thing. Immutable, and equality is by value.

```ts
class Money {
  readonly cents: number;
  readonly currency: string;

  constructor(cents: number, currency: string) {
    if (!Number.isInteger(cents)) throw new Error("cents must be an integer");
    this.cents = cents;
    this.currency = currency;
    Object.freeze(this);
  }

  equals(other: Money): boolean {
    return this.cents === other.cents && this.currency === other.currency;
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) throw new Error("currency mismatch");
    return new Money(this.cents + other.cents, this.currency);
  }
}
```

Two `new Money(1000, "USD")` values are the same amount of money; there is no "which one". `add` returns a new value instead of mutating, because a mutation would change what every holder of the old value sees. Other examples: `Email`, `DateRange`, `OrderId`.

**Entity.** Identity that survives change. Two orders with the same id are the same order even when every field differs; two orders with different ids are different orders even when every field is identical. Equality is by identity, and it has a lifecycle.

```ts
class Order {
  readonly id: string;
  private status: "draft" | "placed" = "draft";

  constructor(id: string) { this.id = id; }

  place(): void {
    if (this.status !== "draft") throw new Error("already placed");
    this.status = "placed";
  }

  sameIdentity(other: Order): boolean {
    return this.id === other.id;
  }
}
```

`Customer` is an entity. `Order` is an entity. `Money` is not: you do not track *this* ten dollars through time.

The test: **if you can replace all its fields and it is still "the same thing", it is an entity. If replacing a field makes it a different thing, it is a value object.**

Nothing in this class deals with lines yet; that comes with the aggregate below.

**Aggregate.** A cluster of entities and value objects that must stay consistent together, with one root as the only entry point. An aggregate is a *boundary*, not a kind of object (§13a).

```ts
class OrderLine { // inside the aggregate; a value object with a subtotal
  readonly sku: string;
  readonly price: Money;
  readonly quantity: number;

  constructor(sku: string, price: Money, quantity: number) {
    if (quantity <= 0) throw new Error("quantity must be positive");
    this.sku = sku;
    this.price = price;
    this.quantity = quantity;
  }

  get subtotal(): Money { return new Money(this.price.cents * this.quantity, this.price.currency); }
}

class Order { // the same entity, plus the lines it owns: the aggregate root
  private readonly lines: OrderLine[] = [];
  // …
  addLine(line: OrderLine): void {
    if (this.lines.length >= 100) throw new Error("too many lines");
    this.lines.push(line);
  }
  get total(): Money {
    return this.lines.reduce((sum, line) => sum.add(line.subtotal), new Money(0, "USD"));
  }
}
```

`Order` + its `OrderLine`s is the aggregate; `Order` is the root. The invariant — the total equals the sum of the lines, at most 100 lines — holds at every commit. Outside code holds the `Order`, never a loose `OrderLine`, and one aggregate per transaction (§13a).

**The words together.**

| Word | Question it answers | Equality | Example |
| --- | --- | --- | --- |
| Class | what shape is this? | — | `class Money` |
| Object | which instance? | — | `new Money(1000, "USD")` |
| Value object | is it the same value? | by value | `Money`, `Email`, `DateRange` |
| Entity | is it the same thing over time? | by identity | `Order`, `Customer` |
| Aggregate | what must stay consistent together? | root identity | `Order` + `OrderLine` |
| DTO | what crosses this boundary? | — | `OrderDto` (§11) |
| Read model | what does this query need? | — | `OrderSummary` (§13) |
| Model | (say which: domain, read, or data) | — | — |

**Which one is it?** Four questions, in order:

1. Does it need identity that survives change? → **entity**.
2. Do several of those have to stay consistent as one unit? → that cluster is an **aggregate**.
3. Is it defined entirely by its values? → **value object**.
4. Is it only carrying data across a boundary? → **DTO**, and it does not belong in the domain.

**Anti-patterns.**

- **A mutable value object.** `money.cents = 500` changes the value in place, so two holders of "the same" money now disagree. `add` returns a new instance instead.
- **An entity compared by its fields.** `JSON.stringify(a) === JSON.stringify(b)` says the order stopped being the same order when its total changed. Compare ids.
- **An aggregate that is the whole graph.** `Customer` → orders → lines → products loads the world and locks it to save one row. Keep aggregates small (§13).
- **A DTO in the domain.** The screen's shape becomes the business rule's shape; every UI change edits an invariant (§11).
- **"Model" as a synonym for class.** It hides whether you mean the rule, the query, or the table.

**Proof**

```ts
// Value object: equality by value, and mutation is impossible.
const a = new Money(1000, "USD");
const b = new Money(1000, "USD");
assert.ok(a.equals(b));
assert.throws(() => a.add(new Money(1, "EUR")), /currency/);

// Entity: equality by identity, through change.
const order = new Order("o-1");
const same = new Order("o-1");
same.place();
assert.ok(order.sameIdentity(same));      // same order
assert.equal(order.sameIdentity(new Order("o-2")), false);

// Aggregate: the root is the only way in, and it enforces the invariant.
assert.throws(() => order.addLine(new OrderLine("sku", a, 0)), /positive/);
assert.equal(order.total.cents, 0);
```

### Questions to ask

- Is this thing defined by its values, or by an identity it keeps?
- If I change one field, is it still the same thing?
- Which of these must be consistent in one transaction?
- Am I looking at the domain, or at a shape built for a screen or a query?

---

## How to use this catalog

1. Read the matching section in [02 — Layered architecture](02-layered-architecture.md).
2. Copy the correct pattern into the actual project.
3. Change one line to the anti-pattern and watch the proof fail.
4. For the full runnable versions, see [02-layered-example](02-layered-example/README.md).

The catalog is deliberately repetitive: the same `Order`, `OrderRepository`, and `OrderService` appear in different forms so the contrast is visible. In a real project, these types are shared once.