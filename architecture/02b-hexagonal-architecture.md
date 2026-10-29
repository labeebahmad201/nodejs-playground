# 02b — Hexagonal architecture

*A hexagonal architecture puts the application at the center and the world at the edge. The application owns the contracts it offers and the contracts it needs; everything else is an adapter.*

Hexagonal is the boundary pattern the [layered note](02-layered-architecture.md) points at and the [big-ball-of-mud note](02a-big-ball-of-mud.md) leaves room for. It is not a folder layout, a deployment style, or a synonym for clean architecture. It is a rule about which way dependencies point across the I/O boundary.

Cockburn's original goal is the sentence to keep:

> Allow an application to equally be driven by users, programs, automated test or batch scripts, and to be developed and tested in isolation from its eventual run-time devices and databases.

That sentence emphasizes **multiple drivers and isolation**. The database swap is a consequence, not the goal. Most teams never swap their database, so if that is the only justification, the pattern is cost without a benefit.

## The goal it serves

Architecture is judged by the cost of change over the life of the system, not by the tidiness of the folder tree. Martin's formulation is the one to keep: the goal is to minimize the human effort required to build and maintain the system, and a design is good if that effort is low and stays low.

The [HappyCoders introduction](https://www.youtube.com/watch?v=KEuaRdBJGTY) puts the same idea in one sentence:

> A good architecture allows software to be changed throughout its entire lifetime with consistently low effort.

Effort is cost. The changes are not only user requirements. A dependency publishes a CVE and has to be upgraded; a vendor revises the interface you integrate with; a regulation changes the data you may store. None of those are features, and all of them arrive on a schedule you do not control.

The mechanism is not "make everything abstract." It is to split the system into components that are **loosely coupled** and can be **developed and tested independently**. The internet is the standing example: millions of machines, upgraded and replaced independently, because the protocols at the boundary are stable and the implementations behind them are not.

Hexagonal architecture addresses one part of that goal: the boundary between the application and the I/O it needs. It does not address decomposition into capabilities, data ownership, consistency between services, or operability. Those are separate decisions, and a hexagon with none of them is still a mud with good manners. The [protecting the inside](#protecting-the-inside) section covers the capability-boundary part.

## How a layered design decays

The layered note describes the destination; this is the usual route.

1. The design starts clean: presentation, business logic, persistence.
2. A feature is due, so one request reads persistence directly from the presentation layer, skipping the business layer. It is legal, because the layering is *relaxed* (open).
3. A third-party client is added to the business layer. Then a second screen needs it, and calls it directly from presentation. The exception becomes the pattern.
4. A second delivery mechanism arrives — a REST API next to the web UI. The validation that lives in the presentation layer is useful there too, so it is copied. Now two edges own the same rule.
5. The ORM is imported wherever it is convenient. A major-version upgrade now requires changes in every layer, so it is deferred. In the HappyCoders telling, an old EclipseLink version blocked not only its own upgrade but every library whose dependencies conflicted with it.
6. The tests can no longer construct the objects without the framework. A tool like PowerMock appears. That is paint over a crack in the foundation: the test now proves that the mock was configured, not that the rule is right.

Nothing in that sequence is irrational at the moment it happens. Each shortcut is locally cheaper. The architecture failed because **the structure charged nothing for the shortcut** and offered no place to put the boundary that would have made it expensive. Hexagonal's contribution is to turn "you should not import the adapter" into a build error, and to name the seam where the outside world is allowed in.

The same decay can happen inside a hexagon whose imports are not enforced. Folders do not prevent it; the import graph does.

## The definition

The **application** — domain model plus use cases — sits at the center.

The **world** sits outside: HTTP, CLI, queue, cron, tests, database, mail, payment provider, clock.

A **port** is a contract at the boundary. It is defined by the inside, in the inside's language, and describes what the application offers or needs.

An **adapter** is an outside implementation of a port. It translates between the application's types and a technology: a controller parses HTTP, a repository maps rows, a notifier calls a provider.

The **dependency rule** is the point: the outside depends on the inside. The application imports its ports and its own types. It never imports an adapter, a framework, an ORM, or a vendor SDK. The composition root is the only place that knows both sides.

That is not the same as "no dependencies." The application depends on its own ports and model; what it refuses is a dependency on a concrete outside.

The one-sentence version:

> The application defines ports for everything it offers and everything it needs; adapters implement them at the edge; source dependencies point inward; the composition root is the only place that knows the concrete outside.

### The three goals

Cockburn's purpose statement contains three goals. They are worth separating because each one is served by a different side of the boundary:

| Goal | What it means | What serves it | How you prove it |
| --- | --- | --- | --- |
| **Equal drivers** | The core is invoked the same way by a user interface, a REST API, a CLI, a queue consumer, or a test framework | Driving ports | The same use case is called from two drivers with no change to the core |
| **Isolation from driven infrastructure** | The core does not know whether data is in a relational database, a file, or memory, or how a message is delivered | Driven ports | The use-case tests run with no database, network, or system clock |
| **Replaceable infrastructure** | An ORM, database, vendor SDK, or UI can be upgraded or replaced without editing the rules | Adapters plus the dependency rule | An adapter swap changes one adapter and the composition root |

The database swap that dominates most explanations is only the third goal, and only its most dramatic case. Most teams never swap a database. They do upgrade an ORM, change a mail provider, add a queue consumer, and run the use case in a test. Those are the everyday versions of the same three goals.

The **mixing console** is the analogy Cockburn's term comes from. A console has inputs for a microphone, a keyboard, or a guitar, and outputs for headphones, speakers, or a recorder. It does not know what is plugged in; it only requires that the device conform to the port's protocol. Swap the guitar for a keyboard and the console is unchanged. That is the test for a port: can the other side be replaced without the core noticing?

### The shape

```text
  driving adapters        driving ports            application            driven ports          driven adapters
  ────────────────        ─────────────            ───────────            ────────────          ───────────────
  HTTP / CLI / queue ───▶ use cases          ───▶  domain + use cases ───▶ repository     ───▶  Postgres
  test driver        ───▶ (what it offers)         (the hexagon)           notifier       ───▶  SES
                                                                           clock          ───▶  system clock
```

The drawing is a hexagon because Cockburn needed room to draw several ports around the application. **Six has no meaning.** "Ports and adapters" is the more descriptive name.

A reasonable file layout looks like this. It is one layout, not the definition:

```text
src/
  application/
    place-order.ts              use case + application service; owns the transaction
    ports/
      orders.ts                 driven port, shaped by the domain
      order-search.ts           driven port, a read contract
      order-notifier.ts         driven port, named for the event
      unit-of-work.ts           driven port, if the transaction needs one
  domain/
    order/
      order.ts                  aggregate root; invariants live here
      order-line.ts
    money.ts
    order-id.ts
    pricing/
      credit-policy.ts          domain service; a pure rule spanning Customer + Order
    events/
      order-placed.ts
  adapters/
    http/
      place-order-controller.ts driving adapter
    cli/
      main.ts                   driving adapter
    persistence/
      postgres-orders.ts        driven adapter; maps rows, implements Orders
    notifications/
      ses-order-notifier.ts     driven adapter
  composition-root.ts           the only file that knows every concrete
```

This tree is a diagram, not a guarantee. If `application/` imports `adapters/`, the inside now depends on the outside, and the project is a layered monolith wearing hexagonal folder names. Read the imports, not the directories.

### Where the services live

"Service" is the most overloaded word in the layout. It is not a layer and not a folder. It is a name for behavior that does not belong to a single entity. **Where it goes is decided by what it is allowed to depend on**, not by the suffix.

| Kind | Question it answers | Lives in | May depend on | Example |
| --- | --- | --- | --- | --- |
| **Aggregate** | What must stay consistent together? | `domain/` | Domain types only | `Order` |
| **Domain service** | Which rule spans objects but needs no I/O? | `domain/` | Domain types only | `CreditPolicy` |
| **Application service / use case** | In what order, and in which transaction? | `application/` | Domain types and driven ports | `PlaceOrder` |
| **Adapter** | How does one technology do it? | `adapters/` | The port plus a vendor SDK | `SesOrderNotifier` |
| **Composition root** | Which concrete for which port? | `composition-root.ts` | Everything, once | `buildApp()` |

#### The aggregate is not a service

An **aggregate** is a cluster of objects that must be consistent together, with one **root** as the only public entry point. `Order` is the root; `OrderLine` is only reachable through it; `place()` enforces "cannot place an empty order." The aggregate is where invariants live, not where orchestration lives. It has no repository, no transaction, and no clock. See [aggregates](../fundamentals/07-aggregates/README.md) and the [end-to-end slice](02c-end-to-end-slice.md#31-the-aggregate--order).

One transaction should normally change one aggregate. If a rule spans two aggregates, it is a workflow or a domain service plus orchestration — not a bigger aggregate.

#### Does the behavior go in the aggregate or in a service?

The aggregate owns the invariants it can enforce alone. A rule that needs state it does not own does not belong inside it.

| The rule uses... | Put it in | Example |
| --- | --- | --- |
| Only this aggregate's fields | A method on the root | `order.addLine` checks quantity; `order.place` rejects an empty order |
| Another object's state, or a value from outside | A method that takes the value, or a domain service | `order.applyDiscount(percent)`; `CreditPolicy.check(customer, openTotal, total)` |
| Multiple aggregates, a query, or a transaction | The application service | Load the customer and the open total, check the policy, save the order |
| A vendor, network, clock, or connection | An adapter, behind a port the application service calls | `SesOrderNotifier`, `PostgresOrders` |

Two failure modes are common:

- **Anemic aggregate plus a god service.** `Order` is a bag of getters and setters; `OrderService` enforces every rule. The invariants are now optional, because any caller can construct an `Order` and bypass the service.
- **An aggregate with collaborators.** `Order` holds a `Customers` repository or a `PricingService` field. It can no longer be constructed from its own state, mapped to a row, or tested without the collaborator. That is a service wearing an entity's name.

"Putting the service inside the aggregate" is the second failure. A service is not owned by an aggregate. If the behavior needs only the aggregate's data, it is a method; if it needs collaborators, it lives outside and receives or returns the aggregate.

```ts
// The aggregate enforces what it can see.
class Order {
  addLine(line: OrderLine): void { /* quantity invariant */ }
  place(): void { /* non-empty invariant */ }
  applyDiscount(percent: number): void { /* uses this.total */ }
}

// The domain service enforces a rule that needs a customer and an order.
class CreditPolicy {
  check(customer: Customer, openTotal: Money, newTotal: Money): void { /* ... */ }
}
```

The aggregate is the consistency boundary. The domain service is a rule that crosses it. The application service is the sequence that crosses both — and the only one of the three that owns a transaction or touches a port.

#### The domain service is pure

A **domain service** holds a rule that needs more than one object but has no I/O. `CreditPolicy` compares a `Customer`'s limit with the `Order`'s total; it belongs to neither object, and it must not open a transaction or send mail.

```ts
// domain/pricing/credit-policy.ts
export class CreditPolicy {
  check(customer: Customer, openTotal: number, newTotal: number): void {
    const available = customer.creditLimit - openTotal;
    if (newTotal > available) throw new CreditLimitExceeded(available, newTotal);
  }
}
```

It is testable with three numbers. If it needs to read something, prefer passing the value in; the application service loads it through a port. A domain service that reads through a repository is still not allowed to save or commit.

#### The application service is the use case

The **application service** is the scenario: load, decide, change state, save, commit. It owns the transaction, authorization, and idempotency. In a small system it is the use case; `PlaceOrder` is both the name and the implementation.

```ts
// application/place-order.ts
export class PlaceOrder {
  private readonly orders: Orders;
  private readonly customers: Customers;
  private readonly policy: CreditPolicy;
  private readonly uow: UnitOfWork;

  constructor(orders: Orders, customers: Customers, policy: CreditPolicy, uow: UnitOfWork) {
    this.orders = orders;
    this.customers = customers;
    this.policy = policy;
    this.uow = uow;
  }

  async execute(command: PlaceOrderCommand): Promise<OrderId> {
    return this.uow.transaction(async () => {
      const customer = await this.customers.byId(command.customerId);
      if (!customer) throw new NotFound(command.customerId);
      const order = Order.draft(command.customerId);
      for (const line of command.lines) order.addLine(line);
      this.policy.check(customer, await this.orders.openTotalFor(customer.id), order.total);
      order.place();
      await this.orders.save(order);
      return order.id;
    });
  }
}
```

A separate `PlaceOrderUseCase` interface is optional. Add it when a second driver, a decorator, or a module boundary needs it; otherwise the concrete class is the port. The [layered slice](02c-end-to-end-slice.md#4-the-contract-question) takes that decision apart.

#### "Infrastructure service" means adapter

A mail client, a payment gateway wrapper, a storage client, and a queue publisher are **adapters**. If a class imports a vendor SDK or opens a socket, it is outside, even if its name ends in `Service`. The application sees `OrderNotifier`; the adapter sees SES.

The same applies to a framework provider. A NestJS `@Injectable()` that only wires collaborators is a composition-root detail. If it contains business rules, it is an application service that has been placed in the framework's folder.

#### The test that classifies a service

Ask what it needs to be constructed:

| Constructor needs | It belongs in |
| --- | --- |
| Only domain objects and values | `domain/` |
| Domain types plus ports, a clock, or a unit of work | `application/` |
| A vendor client, a connection, or a framework request object | `adapters/` |

The anti-pattern is a top-level `services/` folder — the layered layout's dumping ground. It puts `OrderService`, `MailService`, and `PricingService` beside each other even though one orchestrates a transaction, one sends email, and one is a pure rule. The folder hides the dependency each one is allowed to have, which is the only thing the hexagon is trying to make visible.

## The two ports

The symmetry is the part most explanations miss. There are two kinds of ports, and they mirror each other:

|  | **Driving / primary / inbound** | **Driven / secondary / outbound** |
| --- | --- | --- |
| **What it is** | A contract for what the application offers | A contract for what the application needs |
| **Who defines it** | The inside | The inside |
| **Who implements it** | An adapter: HTTP controller, CLI, queue consumer, test driver | An adapter: Postgres repository, SES notifier, Stripe gateway, clock |
| **Call direction at runtime** | Adapter → application | Application → adapter (through the port) |
| **Source dependency** | Adapter → application | Adapter → port ← application |
| **Typical language shape** | A public use-case class or method; an interface is optional | An interface or abstract type owned by the application |
| **Test substitute** | The test calls the use case | A fake implements the port |

Both port definitions are owned by the inside. That is the inversion. If the repository interface lives with persistence, the domain still depends on persistence — you have just renamed the arrow. The [layered note](02-layered-architecture.md#the-dependency-arrow-ends-at-the-database) makes the same point.

### Call direction is not dependency direction

At runtime the application calls the adapter: `orders.save(order)` eventually reaches Postgres. At compile time the application depends only on `Orders`; the adapter depends on `Orders` and on the application's types.

That is the inversion. The runtime arrow points outward; the source arrow points inward. Confusing the two is how people conclude that "the domain calls the database, so the domain depends on it."

### Port is not an interface

A port is a boundary contract, not a language keyword.

On the **driven** side, you usually need an abstraction the inside owns: an `interface`, an abstract class, or a function type. The application must be able to substitute a fake or a different adapter without changing.

On the **driving** side, you often do **not** need an interface. The HTTP controller can depend on the concrete `PlaceOrder` use-case class. The controller is outside; the arrow still points inward. Adding `interface PlaceOrderUseCase` with one implementation is usually ceremony.

The test is not "is there an `interface`?" It is:

> Does the inside depend on the outside, or does the outside depend on the inside?

## Ports are contracts, not method lists

A port has a shape, not just a name. The [membrane model](02a-big-ball-of-mud.md#boundaries-are-membranes-not-walls) applies directly: direction, surface, payload, semantics, ownership, enforcement.

- **Name it in the inside's language.** `Orders`, `OrderNotifier`, `Clock` — not `IDbRepository`, `PostgresGateway`, or `StripeClient`.
- **Do not mirror the adapter.** A port with `execute(sql)` is a database driver with a nicer name.
- **Do not mirror the table.** `findByStatusAndCreatedAtBetween` is a query surface, not a domain contract. Split it from the domain port if reads change for different reasons.
- **The payload is part of the contract.** Domain objects are fine if they are controlled. ORM rows, vendor types, and HTTP DTOs are not.
- **Errors are part of the contract.** Not-found, conflict, duplicate, validation, timeout, and retryable-versus-terminal are semantics the caller must know. A port with only `save` is underspecified.
- **Granularity follows reasons to change.** One port per capability the application needs, not one per table and not one per class.
- **Transactions are explicit.** Decide who owns the unit of work. A repository that commits on every `save` turns a multi-step use case into partial writes.
- **A port with one implementation can still be justified** — a test seam, a volatile vendor, a planned replacement — but it has to earn its keep. "We might swap it" is not evidence.

Bad port, good port:

```ts
// Bad: the port is the database's shape.
interface OrderRepository {
  findByStatusAndCreatedAtBetween(status: string, from: Date, to: Date): Promise<Row[]>;
  execute(sql: string): Promise<unknown>;
}

// Better: the port is the application's need.
interface Orders {
  byId(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

// A read port is a different contract with a different reason to change.
interface OrderSearch {
  search(criteria: OrderCriteria): Promise<OrderSummary[]>;
}
```

The same narrowing applies to side effects:

```ts
// Too generic: the application has to know the channel.
interface Mailer {
  send(to: string, subject: string, body: string): Promise<void>;
}

// Better: the application states the event; the adapter chooses the channel.
interface OrderNotifier {
  orderPlaced(order: Order): Promise<void>;
}
```

The second version lets the adapter send email today and a push notification tomorrow without changing the use case. The first version bakes "mail" into the application's vocabulary.

## What crosses the port

The port is a hole in the membrane. The payload decides whether the hole is the size of the contract or the size of the building.

| Payload | Allowed? | Why |
| --- | --- | --- |
| **Domain objects** | Yes, if the model is controlled | The application's language crosses. The adapter maps them to rows. |
| **Purpose-built DTOs** | Yes, at the edge | Read models and API shapes can cross; map at the boundary. |
| **ORM entities / rows** | No | The schema becomes the contract; a migration changes the domain. |
| **Vendor SDK types** | No | The vendor owns the vocabulary; the adapter is supposed to hide it. |
| **HTTP request/response types** | No, inside the application | Parse at the controller; pass a command or a domain type. |
| **Exceptions from the adapter** | No, unmapped | Translate to the port's error contract; otherwise the caller depends on the driver. |

The error side is where "it works in the happy path" ports fail. If the adapter throws `pg.unique_violation` and the use case catches a string, the vendor has leaked through the port. Define a small error taxonomy and map at the adapter.

## Two-way mapping

The core has a rule — "a user needs a valid email" — so it needs a `User` it can create and validate. The database has a different job: store columns. That row type is not the domain type. It has `password_hash`, `version`, and a column name like `created_at`.

Two types exist because the core and the database are answering different questions. The core asks, *is this a valid user?* The database asks, *how do I store these columns?* One type cannot answer both without letting one question dictate the other.

### The core's type

```ts
// domain/user.ts
export class User {
  readonly id: string;
  readonly email: string;
  readonly registeredAt: Date;

  constructor(id: string, email: string, registeredAt: Date) {
    if (!email.includes("@")) throw new Error("invalid email");
    this.id = id;
    this.email = email;
    this.registeredAt = registeredAt;
  }

  static register(email: string, now: Date): User {
    return new User(crypto.randomUUID(), email, now);
  }
}
```

The core names this type in its use case and its port:

```ts
// application/register-user.ts
export class RegisterUser {
  private readonly users: Users;

  constructor(users: Users) {
    this.users = users;
  }

  async execute(email: string, now: Date): Promise<User> {
    const user = User.register(email, now);
    await this.users.save(user);
    return user;
  }
}
```

```ts
// application/ports/users.ts
export interface Users {
  save(user: User): Promise<void>;
  byId(id: string): Promise<User | null>;
}
```

The core asks "is this a valid user?" and hands a `User` to the port. It does not know about a table.

### The adapter's type

The adapter has to store that user. The table is not the object:

```ts
// adapters/persistence/user-row.ts
export type UserRow = {
  id: string;
  email: string;
  password_hash: string | null;
  created_at: string;
  version: number;
};
```

The row has a `password_hash` the domain does not use, a `version` for optimistic locking, and `created_at` as a column name. The fields overlap; the jobs do not.

### Why one type fails

There are only two ways to use one type.

**Put the entity in the core.** The core file imports the ORM, the constructor rule becomes optional because the ORM needs a no-arg constructor, and the table's columns become domain fields. The core is now storing.

```ts
// domain/user.ts — the dependency arrow now points outward
import { Entity, Id, Column, Version } from "typeorm";

@Entity()
export class User {
  @Id id!: string;
  @Column() email!: string;
  @Column({ name: "created_at" }) registeredAt!: Date;
  @Column({ name: "password_hash" }) passwordHash!: string | null;
  @Version version!: number;
}
```

**Put the only `User` in the adapter.** The use case either imports the adapter — the arrow points outward — or returns `unknown` and loses `user.email` without a cast.

```ts
// application/register-user.ts
import { User } from "../adapters/persistence/user.ts"; // outward
```

The port has the same problem: `Users.save(user: User)` would have to import the adapter's `User`, or fall back to `unknown`. `import type` does not fix it; it removes the runtime edge, not the source dependency.

The core is clean and cannot name the thing it creates.

### Two types, one translator

So the core gets a type for deciding, and the adapter gets a type for storing. The adapter implements the port and translates between them:

```ts
// adapters/persistence/jpa-users.ts
interface UserRows {
  insert(row: UserRow): Promise<void>;
  findOneBy(criteria: { id: string }): Promise<UserRow | null>;
}

export class JpaUsers implements Users {
  private readonly rows: UserRows;

  constructor(rows: UserRows) {
    this.rows = rows;
  }

  async save(user: User): Promise<void> {
    await this.rows.insert({
      id: user.id,
      email: user.email,
      password_hash: null,                    // a column the domain does not own
      created_at: user.registeredAt.toISOString(),
      version: 0,
    });                                        // User -> UserRow
  }

  async byId(id: string): Promise<User | null> {
    const row = await this.rows.findOneBy({ id });
    if (!row) return null;
    return new User(row.id, row.email, new Date(row.created_at)); // UserRow -> User
  }
}
```

`UserRow` never crosses the port. `Users` still takes and returns `User`. `JpaUsers` is the only code that imports both.

```text
core:      RegisterUser ──> Users (port)
                              │
                              │ save(User)
                              ▼
adapter:                 JpaUsers ──> UserRow ──> table
                              │
                              └── translates User <-> UserRow
```

The mapper is not a copy. A copy preserves the fields; a mapper preserves the decisions. On save, a `Date` becomes an ISO string. On load, the string becomes a `Date`, the constructor checks the email again, and the columns the core ignores are dropped.

An interface the entity implements does not fix this. The object crossing the port is still the managed entity; lazy loading and session lifetime travel with it. Map to a plain object.

### The rule

The type that crosses the port belongs to the core. The type that stays in the adapter belongs to the adapter.

The test is not "is this type clean?" It is: **does using this type require importing an adapter?** If yes, it is a row, not a core type.

This is not duplication in the wasteful sense. The core type changes when the registration rule changes; the row changes when the table changes. The mapper is the one place where those two changes meet. Name them differently — `User` and `UserRow` — because two classes called `User` in different folders look fine until someone imports the wrong one.

### What this buys when the infrastructure changes

The benefit is easiest to see during an upgrade. If the domain type is the ORM entity, a major ORM release — new annotations, a different constructor rule, a changed lazy-loading model — edits files across `domain/` and `application/`, and every test that constructs a `User` may need a new setup.

If the ORM is confined to `adapters/persistence/`, the same upgrade touches the row type, the mapper, and the adapter. The core keeps its `User`, its constructor rule, and its tests.

The mapper is the shock absorber. It absorbs the difference between the table's shape before the upgrade and the table's shape after it. That is the practical version of "replaceable infrastructure": not that you will swap Postgres tomorrow, but that a forced library upgrade is a bounded change instead of a rewrite. It is the [decay sequence](#how-a-layered-design-decays) in reverse: the upgrade stops at the adapter.

## The composition root is where the hexagon becomes real

The application declares ports. The composition root chooses concretions and wires them. `new` for an adapter belongs at the edge; the application receives the port, never constructs the adapter. If the domain constructs its own adapter, or the framework injects a concrete class into the domain, the arrows still point outward.

The repo's existing [composition-root example](../fundamentals/oop/design-patterns/06-composition-root/composition-root.md) is a working model:

- `contracts.ts` defines the driven ports;
- `order-service.ts` depends only on those ports;
- `infrastructure.ts` holds the adapters;
- `main.ts` is the driving adapter and the composition root.

That is already a minimal hexagon. See the ADR for the decision that keeps `new` at the edge.

## The module is the enforcement

The dependency rule is a statement about imports, and imports are enforced by the build, not by a diagram. A single package with `application/`, `domain/`, and `adapters/` folders enforces nothing: a relative import from `domain/` into `adapters/` compiles without complaint.

The mechanism that makes the rule real is a **module boundary**: a package, a workspace project, or a Maven module whose dependency declarations are the only edges the compiler will accept. The video's Java example does exactly this — an application module, a controller module, a JPA-adapter module, a model module, and a bootstrap module, with dependencies declared so the adapter modules depend on the application, never the reverse. Code that imports the wrong direction does not compile.

In TypeScript the equivalent options, in increasing cost:

| Mechanism | What it enforces | Cost |
| --- | --- | --- |
| **Folder convention** | Nothing | Zero; decays under pressure |
| **Lint rule** (`eslint-plugin-boundaries`, `import/no-restricted-paths`) | Imports that match a pattern | One config; easy to disable with a comment |
| **Dependency-graph test** | The actual import graph in CI | A small test plus a parser; no build restructuring |
| **Workspace packages** (npm/pnpm workspaces, Nx, Turborepo) | Package dependency declarations | Build config, versioning, slower installs, more ceremony |
| **Separate repositories / services** | Network boundary | Everything that comes with distribution — usually the wrong tool for this problem |

The threshold matters. The video is honest about its own screenshot: one application module, three adapter modules, a model module, and a bootstrap module, where some modules hold a single class. For a microservice that writes one entity, that is more structure than code. For an enterprise application where each module grows to hundreds of classes, the same split pays for itself quickly.

A reasonable default: **one package with a dependency-graph test until the adapters grow real dependencies**, then split the volatile or heavy ones (persistence, an external vendor) into their own package. Split because the module earns it, not because the diagram has six sides.

## What it is not

| It is not | Why |
| --- | --- |
| **A folder layout** | `ports/` and `adapters/` prove nothing. The import graph proves the direction. |
| **A layered architecture** | Layered points down at the database; hexagonal puts the database at the edge. Hexagonal still has layers *inside* — domain, application — but the top-level axis is inside/outside, not technical role. |
| **Clean or onion architecture** | Same inward topology, different prescription. Clean adds four rings, use-case interactors, and presenters. Onion centers the domain model and adds application services. Hexagonal is the minimal, symmetric statement: inside, outside, ports, adapters. |
| **Dependency injection** | DI answers *who constructs it*. Hexagonal answers *who owns the contract and what may cross it*. Injecting a concrete class into the domain is still a concrete dependency. |
| **A module boundary** | One hexagon can be a big ball of mud inside. Ports protect the outside boundary; they say nothing about how to split the application into capabilities. See [protecting the inside](#protecting-the-inside). |
| **Microservices** | It is intra-process. One hexagon is one deployable. Distribution is a separate decision. |
| **DDD** | Bounded contexts are a modeling and language boundary. A hexagon can hold one context, part of one, or several. The patterns compose; they are not the same. |
| **"No frameworks"** | Frameworks live in adapters and the composition root. The application is framework-free, not framework-hostile. |
| **A guarantee of testability** | A leaky port or an anemic domain still needs a database and still tests plumbing. The pattern gives you a seam; it does not give you a good model. |

## Protecting the inside

The hexagon protects one boundary: the core from the infrastructure. It does not protect Orders from Billing, or the model from a shared `common/` folder. The hexagon is the inside/outside axis; capability modules are the side-to-side axis. The first is enforced at the deployable edge; the second needs its own rule inside.

The failure is the [one giant hexagon](#one-giant-hexagon): a clean outside and a mud inside. Billing imports `orders/domain/order.ts`, reads a field, and every change to the Orders model becomes a change to Billing. The ports did not help, because both capabilities are on the inside.

The word *module* is overloaded. Here it means a **capability** with its own model and data, not the build module that enforces the hexagon.

### The shape: capability modules with public contracts

Split the inside by capability, not by technical layer. Each module owns its model, its use cases, its adapters, and its data. Other modules see only a small public contract.

```text
src/
  orders/
    domain/order.ts              private
    application/place-order.ts   private
    adapters/persistence/...     private
    public.ts                    the only entry other modules may import
  billing/
    domain/invoice.ts
    application/invoice-order.ts
    adapters/...
    public.ts
  composition-root.ts
```

Modules do not change the service taxonomy. Each capability still has its own `domain/` (aggregates and pure domain services), `application/` (use cases), and `adapters/` (infrastructure services). A domain service belongs to the module that owns the rule; it is not shared across modules. See [where the services live](#where-the-services-live).

```ts
// orders/public.ts
export interface OrderFacts {
  id: string;
  status: "draft" | "placed";
}

export interface OrdersApi {
  place(customerId: string, lines: OrderLineInput[]): Promise<string>;
  facts(id: string): Promise<OrderFacts | null>;
}
```

```ts
// billing/application/invoice-order.ts
import type { OrdersApi } from "../../orders/public.ts";

export class InvoiceOrder {
  private readonly orders: OrdersApi;
  private readonly invoices: Invoices;

  constructor(orders: OrdersApi, invoices: Invoices) {
    this.orders = orders;
    this.invoices = invoices;
  }

  async execute(orderId: string): Promise<string> {
    const facts = await this.orders.facts(orderId);
    if (!facts || facts.status !== "placed") throw new Error("order not placed");
    return this.invoices.create(facts.id);
  }
}
```

The composition root wires the Orders implementation into Billing. Billing never imports `orders/domain/order.ts`; it depends on `orders/public.ts`.

### The rules

1. **One owner per model.** `Order` lives in Orders. Billing gets `OrderFacts`, not `Order`. If Billing needs behavior, Orders exposes a command, not its aggregate.
2. **One owner per table or schema.** Orders owns its tables; Billing does not read or write them directly. If Billing needs a read, it asks Orders or consumes a projection or event.
3. **No cross-module transaction.** A transaction stays inside one module. A workflow across modules is an event, a saga, or a process manager — not a bigger transaction.
4. **Public means small.** `public.ts` exposes commands, queries, and events in the module's language. It does not re-export the domain.
5. **The shared kernel stays small.** Share value types such as `Money`, `OrderId`, and `Result`, not entities. If `common/` starts importing a module's domain, it has become a back door.
6. **The root wires modules, not internals.** `buildOrdersModule(env)` returns the public contract; Billing receives that contract and nothing else.

### Symptoms that the inside is unprotected

- Another module imports `domain/` or `adapters/`.
- `common/` or `shared/` contains entities, not value types.
- Two modules write the same table.
- A transaction spans two modules.
- A change to one module's model forces a change in another.
- A module's domain type is used as another module's API type.

### Enforcement

The module rule is an import rule, so it needs an import mechanism, not a diagram.

| Mechanism | What it enforces | Cost |
| --- | --- | --- |
| **Folder convention** | Nothing | Zero |
| **Lint rule** (`no-restricted-imports`, `eslint-plugin-boundaries`) | `billing/**` may not import `orders/domain`, `orders/application`, or `orders/adapters` | One config |
| **Dependency-graph test** | The actual import graph in CI | A small test |
| **Workspace packages with `exports`** | Only `orders/public.ts` is importable | Build config |
| **Separate services** | A network boundary | Deployment, not a first move |

With workspace packages, the `exports` map is the contract:

```json
// packages/orders/package.json
{
  "name": "@app/orders",
  "exports": { ".": "./src/public.ts" }
}
```

`import { OrdersApi } from "@app/orders"` resolves; `@app/orders/src/domain/order` does not. Without packages, a lint rule or dependency-graph test does the same job.

A practical default: one package, one folder per capability, a `public.ts` per module, and a dependency-graph test. Split into workspace packages when the module grows a real team or a real dependency; split into services only when the deployment needs it.

### What this does not solve

Modules do not make the model rich. A module with an anemic `Order` is still an [anemic hexagon](#the-anemic-hexagon), just smaller.

Modules do not remove transactions. They bound them: a transaction stays inside one module; a workflow across modules is an event, a saga, or a process manager, not a bigger transaction.

The two boundaries are orthogonal:

| Boundary | Separates | Enforced by |
| --- | --- | --- |
| **Hexagon / ports** | Core from infrastructure | Ports; adapters depend inward; import rule |
| **Module / capability** | Orders from Billing | Public contract; private internals; import rule |

You need both. The hexagon without modules is a clean outside around a mud. Modules without the hexagon are a modular monolith that still imports the ORM into its domain. The rules compose: each module keeps its own ports and adapters where it needs them, and the deployable has one outside boundary. For the modular-monolith mechanics, see [01a](01a-modular-monolith.md); for the failure, [02a](02a-big-ball-of-mud.md).

## What it optimizes

- **Multiple drivers.** The same use case runs from HTTP, CLI, a queue consumer, a cron job, and a test without changing the application.
- **Testability without I/O.** The domain and use cases run with in-memory adapters and a fixed clock.
- **Replaceable infrastructure.** A payment provider, storage engine, or messaging system can change behind a port.
- **Delayed decisions.** You can start with the simplest adapter and defer the vendor choice.
- **Framework independence.** The framework is a detail at the edge, so upgrading or replacing it is not a domain rewrite.
- **Explicit contracts.** The ports make the application's needs and offers visible, which is useful for review, onboarding, and architecture tests.
- **Symmetry.** Inputs and outputs are treated by the same rule, so the design does not privilege the database over the UI.

The last point is Cockburn's distinctive contribution. Most "repository pattern" advice only fixes the output side; hexagonal says the input side has the same shape.

## What it costs

### The mapping tax

Domain objects ↔ database rows ↔ API DTOs. The mapping is where bugs live: partial updates, `null` versus absent, time zones, decimal precision, enum drift, and lazy-loaded fields that are not loaded when the mapper runs.

The tax is not optional. If nothing maps, the schema or the vendor type has crossed the boundary. The [two-way mapping](#two-way-mapping) section walks the two failed shortcuts and the split that remains.

### Indirection and ceremony

Every I/O operation gets a port, an adapter, a mapper, and wiring. For thin CRUD, the ceremony outweighs the logic. A three-line controller-service-repository flow becomes six files and two interfaces.

### Leaky ports

The most common failure is a port shaped by the adapter:

- `findByStatusAndOwner` because a screen needs it;
- `getOrder()` returning the ORM entity;
- `PaymentGateway` with Stripe's exact error codes;
- `save` that commits, because the adapter's transaction is convenient.

The port is named after the outside, so the outside is still in charge. The [port-shape section](#ports-are-contracts-not-method-lists) shows the bad and good versions in code.

### Transaction ambiguity

Hexagonal does not solve atomicity. A port can hide the database, but it cannot hide the consistency model. The application has to decide what belongs in one transaction; the adapter only supplies the mechanism.

**The problem.** Registration saves a user and an outbox row. The repository commits on every `save`:

```ts
// adapters/persistence/jpa-users.ts
async save(user: User): Promise<void> {
  await this.db.begin();
  await this.db.insert(toRow(user));
  await this.db.commit(); // the boundary is inside the adapter
}
```

The use case looks atomic, but it is two transactions:

```ts
const user = User.register(email, now);
await this.users.save(user);                       // commits
await this.outbox.add(`welcome:${user.email}`);    // fails: the user is already committed
```

The port did not cause the bug. It also did not prevent it, because the boundary was left inside the adapter.

**The fix.** Make the unit of work an explicit port and let the application own the boundary:

```ts
// application/ports/unit-of-work.ts
export interface UnitOfWork {
  transaction<T>(work: () => Promise<T>): Promise<T>;
}
```

```ts
// application/register-user.ts
async execute(email: string, now: Date): Promise<User> {
  const user = User.register(email, now);
  return this.uow.transaction(async () => {
    await this.users.save(user);
    await this.outbox.add(`welcome:${user.email}`);
    return user;
  });
}
```

```ts
// adapters/persistence/jpa-users.ts — stages, never commits
async save(user: User): Promise<void> {
  await this.db.insert(toRow(user));
}

// adapters/persistence/postgres-unit-of-work.ts
class PostgresUnitOfWork implements UnitOfWork {
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    await this.db.begin();
    try {
      const result = await work();
      await this.db.commit();
      return result;
    } catch (error) {
      await this.db.rollback();
      throw error;
    }
  }
}
```

The repository stages; the unit of work commits or rolls back. The adapter implements `transaction` with the database's mechanism. The application still decides what belongs inside.

One implementation detail matters: the unit of work and the repositories must share the same connection or transaction context. If `save` uses a different connection, it writes outside the boundary. The usual pattern is a transaction-scoped connection that the unit of work opens and the repositories read from the scope.

**The rule.** A repository may participate in a transaction; it must not decide the boundary. If a port method commits, the use case cannot compose it safely. External calls go after the commit, not inside it.

Full proof: [nuance 13](02b-hexagonal-nuances.md#13-who-owns-the-transaction) and the [transaction lab](02b-hexagonal-example/nuances/13-transaction-ownership.ts).

### The anemic hexagon

An **anemic model** is a record with fields and no behavior. Wrap one in ports and adapters and you get an **anemic hexagon**: the use case is "load, set, save," and the invariant lives nowhere.

**The problem.** `Order` is a bag of fields; the use case does the work:

```ts
type Order = { id: string; status: string; total: number };

class PlaceOrder {
  async execute(id: string): Promise<void> {
    const order = await this.orders.byId(id);
    if (!order) throw new Error("not found");
    order.status = "placed";   // any status is allowed
    order.total = -1;          // any total is allowed
    await this.orders.save(order);
  }
}
```

The port is real; the model is not. A controller, a second use case, or a test can set the same fields and skip the check. The rule is optional because the object cannot enforce it.

**The fix.** Put the invariant on the aggregate and let the use case orchestrate:

```ts
class Order {
  private state: "draft" | "placed" = "draft";
  private readonly lines: OrderLine[] = [];

  addLine(line: OrderLine): void { /* quantity > 0 */ }
  place(): void {
    if (this.lines.length === 0) throw new Error("empty order");
    this.state = "placed";
  }
  get status(): string { return this.state; }
}

class PlaceOrder {
  async execute(id: string): Promise<void> {
    const order = await this.orders.byId(id);
    if (!order) throw new Error("not found");
    order.place();               // the rule runs here
    await this.orders.save(order);
  }
}
```

Now the invariant is enforced wherever the object is used, including tests. The use case still owns the transaction, but it does not own the rule.

**The test.** The anemic version accepts `{ status: "placed", total: -1 }`; the rich version rejects `place()` on an empty order. If the core tests only assert that `save` was called, they do not catch the difference.

Full proof: [nuance 31](02b-hexagonal-nuances.md#31-where-the-services-live) and the [services lab](02b-hexagonal-example/nuances/31-where-the-services-live.ts).

### Test-double drift

A fake that only implements the happy path certifies a bug. The in-memory repository accepts a duplicate id because a `Map` overwrites; the real adapter raises a unique-constraint error. The core tests pass; production fails.

**The problem.**

```ts
class InMemoryUsers implements Users {
  private readonly rows = new Map<string, User>();
  async save(user: User): Promise<void> {
    this.rows.set(user.id, user); // duplicate id overwrites; no conflict
  }
}
```

**The fix.** Run the same contract suite against every adapter:

```ts
for (const repo of [inMemory, postgres]) {
  await repo.save(user);                                      // first write is fine
  await assert.rejects(() => repo.save(user), /conflict/);    // duplicate id
}
```

The fake has to model the failure, not just the return value. As written above, `InMemoryUsers` fails this suite; fix the fake or use the real engine in the test.

Full proof: [nuance 22](02b-hexagonal-nuances.md#22-fake-fidelity), [nuance 24](02b-hexagonal-nuances.md#24-one-contract-suite-every-provider), and the [contract lab](02b-hexagonal-example/nuances/24-contract-suite.ts).

### One giant hexagon

The hexagon protects the outside boundary. It says nothing about the inside. One `domain/` with every capability is a big ball of mud with a nicer diagram.

**The problem.** Billing reaches into Orders' internal type:

```ts
// billing/domain/invoice.ts
import { Order } from "../../orders/domain/order.ts";

class Invoice {
  for(order: Order): string {
    return `invoice:${order.id}:${order.status}`; // reads an internal field
  }
}
```

The ports still point the right way; both capabilities are inside. Billing now depends on Orders' internal representation. Rename `status`, change the aggregate, and Billing breaks. The boundary that was supposed to protect the model is bypassed from the inside.

**The fix.** Each capability exposes a small public contract; other capabilities depend on that, not on the model:

```ts
// orders/public.ts
export interface OrderFacts {
  id: string;
  status: "draft" | "placed";
}

export interface OrdersApi {
  facts(id: string): Promise<OrderFacts | null>; // read side only
}
```

```ts
// billing/domain/invoice.ts
import type { OrdersApi } from "../../orders/public.ts";

class Invoice {
  private readonly orders: OrdersApi;

  constructor(orders: OrdersApi) {
    this.orders = orders;
  }

  async for(orderId: string): Promise<string> {
    const facts = await this.orders.facts(orderId);
    if (!facts || facts.status !== "placed") throw new Error("order not placed");
    return `invoice:${facts.id}`;
  }
}
```

The composition root wires the Orders implementation into Billing. The dependency is explicit, testable, and narrow. The same pattern works between modules inside one deployable; a network boundary is a separate decision.

```text
src/
  orders/
    domain/order.ts
    application/place-order.ts
    adapters/persistence/...
    public.ts
  billing/
    domain/invoice.ts
    application/invoice-order.ts
    adapters/...
    public.ts
  composition-root.ts
```

**The rule.** One hexagon is one deployable, not one module. If two capabilities have different reasons to change, give them separate public contracts and wire them at the root. If the contract is a package export, the compiler enforces it; otherwise a dependency-graph test does.

See [02a](02a-big-ball-of-mud.md) and [01a](01a-modular-monolith.md). Full proof: [nuance 26](02b-hexagonal-nuances.md#26-one-giant-hexagon) and the [giant-hexagon lab](02b-hexagonal-example/nuances/26-one-giant-hexagon.ts).

### Composition-root sprawl

The root is allowed to know every concrete class. That does not mean it should construct every class in one function.

**The problem.** The root becomes a second application:

```ts
// composition-root.ts
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const users = new PostgresUsers(pool, new SystemClock(), new RetryPolicy(3));
const mailer = new SesMailer(process.env.AWS_REGION, process.env.SES_FROM);
const orders = new PostgresOrders(pool, users, mailer);
const billing = new Billing(orders, new StripeGateway(process.env.STRIPE_KEY));
// ... 200 more lines of lifetimes, flags, and environment parsing
```

**The fix.** Split the root by module or feature; each module returns its public contract:

```ts
// composition-root.ts
const orders = buildOrdersModule(env);
const billing = buildBillingModule(env, orders.public);
const http = buildHttpAdapter(orders, billing);
```

The root composes modules, not every class. The module builder owns its adapters and exposes only what other modules need. If the root still grows, the problem is the number of ports or lifetimes, not the location of `new`.

### Framework friction

NestJS, Spring, and similar frameworks want to own class construction, decorators, and request scope. You can still do ports and adapters at the module boundary, but a fully framework-free core may fight the framework's conventions. The trade is explicit: purity versus convention.

**The problem.** The framework annotation lands in the core:

```ts
// domain/place-order.ts (NestJS)
import { Injectable } from "@nestjs/common";

@Injectable()
export class PlaceOrder {
  private readonly orders: Orders;

  constructor(orders: Orders) {
    this.orders = orders;
  }
}
```

The class is still testable, but the core now needs the framework's compiler, decorator metadata, and test module. The dependency is small, but it is real.

**The trade.** Keep the annotation at the edge:

```ts
// adapters/http/place-order.controller.ts
@Controller("orders")
export class PlaceOrderController {
  private readonly placeOrder: PlaceOrder;

  constructor(placeOrder: PlaceOrder) {
    this.placeOrder = placeOrder;
  }
  // ...
}
```

The core stays plain; the adapter owns the framework. If the team prefers constructor injection everywhere, the core can carry `@Injectable()` as a deliberate exception. Decide which convention wins; do not let it drift.

### Team cognitive load

Port, adapter, use case, command, DTO, mapper, composition root, unit of work. The vocabulary is not free. A team that does not understand why the ports exist will reproduce the folders and skip the rule.

## Testing both sides of the port

The claim that "hexagonal makes testing easy" is true only if you test both sides, and only if the doubles are honest.

**The core** is tested through a driving port, with driven ports replaced by doubles:

- a **stub** returns a canned value: an order, a customer, a clock instant;
- a **spy** records calls: `save` was called once, with this aggregate;
- the assertion is about the outcome — the order is placed, the total is rejected, the notification is requested — plus the interaction contract that matters.

Because the core has no I/O, those tests are fast, deterministic, and parallel. They also fail for the right reason: a broken rule, not a missing database.

**Each adapter** is tested in isolation from the core:

- a driving adapter (controller) is given a spy that implements the input port, fed a protocol-shaped input, and checked for status, body, and the call it made inward;
- a driven adapter (repository, notifier) is tested against the real dependency — a real database engine with the real migrations, a fake HTTP server, a sandbox vendor — and checked for the row it wrote or the request it sent.

The two directions are not symmetric in value. The core tests are where the rules live. The adapter tests are where the technology lives; they catch the SQL, serialization, and error-mapping bugs that a fake cannot.

The bridge between them is a **contract suite**: the same assertions run against every implementation of a port. In-memory and SQLite repositories should both satisfy "saving the same id twice is a conflict" and "a missing id returns null." If the fake does not model the conflict, the core tests pass and production fails.

| What to test | Substitute | What it proves | What it does not prove |
| --- | --- | --- | --- |
| Use case / domain | Fake driven ports, fixed clock, fixed ids | The rules and the orchestration | SQL, serialization, vendor behavior |
| Driving adapter | Fake input port (spy) | Parsing, status mapping, error mapping | The use case's rules |
| Driven adapter | Real engine / fake server | Queries, mapping, constraints, retries | The use case's rules |
| End to end | Nothing | The wiring is real | Which layer caused a failure |
| Contract suite | Every adapter, one suite | The adapters agree on the contract | That the contract is the right one |

Testing an adapter in isolation is the part most teams skip. It is also the part that catches the mapping bugs the pattern introduces. If you adopt ports and adapters and only test the core with mocks, you have paid the mapping tax and bought none of its insurance.

## Failure modes

| Failure mode | What it looks like | Fix |
| --- | --- | --- |
| **Port mirrors the database** | `findByStatusAndCreatedAtBetween`, `execute(sql)`, one method per screen | Split domain ports from read ports; name by the question, not the query |
| **ORM entity crosses the port** | The repository returns a row; the domain imports the ORM | Map at the adapter; keep a persistence model separate. See [two-way mapping](#two-way-mapping) |
| **Vendor error leaks** | The use case catches `StripeError` or a driver code | Define the port's error contract; translate in the adapter |
| **Anemic hexagon** | Use case is getters, setters, and `save`; no invariants | Put behavior on the domain object; delete ports that only wrap CRUD. See [the anemic hexagon](#the-anemic-hexagon) |
| **Transaction per call** | Two repository calls, two commits, partial writes | Unit-of-work port or application-level transaction boundary. See [transaction ambiguity](#transaction-ambiguity) |
| **External call inside the transaction** | `save`, then `mailer.send`, then commit | Outbox or durable queue; see [01c](01c-outbox-pattern.md) and [01e](01e-external-calls-inside-transactions.md) |
| **One giant hexagon** | One `domain/` with every capability; no internal boundaries | Modularize inside; a public contract per capability; one hexagon per deployable. See [one giant hexagon](#one-giant-hexagon) |
| **Interface explosion** | An interface for every class, all with one implementation | Keep ports at real seams; drop the rest |
| **Fake drift** | In-memory adapter ignores constraints and concurrency | Contract tests; fakes that model the failure modes. See [test-double drift](#test-double-drift) |
| **Composition-root sprawl** | The root is a second application | Split wiring by module; remove unnecessary lifetimes. See [composition-root sprawl](#composition-root-sprawl) |
| **Costume hexagon** | `ports/` and `adapters/` folders, but the domain imports the adapter | Enforce the import graph in CI; delete the folders until the rule is real |

## What the HappyCoders introduction gets right

The [HappyCoders introduction](https://www.youtube.com/watch?v=KEuaRdBJGTY) is the clearest short treatment of the pattern available, and it earns several points most explanations miss:

- **It starts from the goal.** Architecture is about keeping the cost of change low over the system's life, not about drawing rings. The layered-decay story is told as a sequence of locally rational shortcuts, which is how it actually happens.
- **It gives the real failure of layering.** Not "layers are bad," but "a major ORM upgrade now touches every layer, so it is deferred forever." That is the bill, and it is specific.
- **It separates the two port types.** Driving and driven adapters are drawn and named symmetrically, including the call direction on each side.
- **It presents two-way mapping as the consequence, not an afterthought.** The `User`/`JpaUser` dilemma and the mapper in the adapter are the part most introductions skip, and the part that determines whether the pattern is real.
- **It is honest about the cost.** The module screenshot with several single-class modules, and the advice to skip the pattern for a small CRUD microservice, are the right caveats.

Three refinements are worth keeping in mind while reading it:

| The video says | The refinement |
| --- | --- |
| "Ports, in code, are simply interfaces." | Driven ports usually are. A **driving** port can be the concrete use-case class; an interface with one implementation and no second driver or decorator is ceremony. The test is the dependency direction, not the keyword. |
| "All dependencies point toward the core." | Source dependencies do. Runtime calls go outward, and the composition root depends on everything — that is its job. The core depends on its own ports, which live inside. |
| "Hexagonal fulfills all the criteria of good architecture." | It fulfills isolation and replaceability at the I/O boundary. It says nothing about decomposing the inside, data ownership, consistency, or operability, and it adds a mapping tax. It is a means, not a verdict. |

There is also a smaller claim to qualify: "change the business logic without changing the adapters, as long as the ports stay unchanged." That is true, but business changes usually do change the ports. The stronger and more useful claim is the reverse: **upgrading or replacing the infrastructure does not change the core.** That is the direction the dependency rule actually protects.

The video is a good first pass precisely because it is concrete. Read it, then read the failure modes: the pattern it describes is easy to draw and hard to keep.

## Common misreadings

A different popular eight-minute introduction — Hyett's — gets the driving/driven symmetry right, then goes further. The gist of its honeycomb section is that a large application should be split into different hexagons, each responsible for one domain — "this is the concept behind domain driven design" — and then connected together.

That is **bounded contexts plus service decomposition**, not hexagonal architecture. The tell is in the video's listed costs: running twenty containers locally and network latency between hexagons. Those are microservice costs. In-process ports and adapters add indirection and mapping, not network hops.

Corrections worth keeping:

| Claim | Correction |
| --- | --- |
| **Hexagonal means many services, one per domain** | One hexagon is one process. Bounded contexts are a separate decomposition. Distribution is a separate decision. |
| **Ports should be generic** `read`**/**`write` | Generic ports lose the domain's language. Name the contract after the application's need, not the lowest common denominator. |
| **The point is swapping the database** | The point is multiple drivers, isolation, and delayed decisions. Swapping is a consequence, and often never happens. |
| **Six sides mean six ports** | Six was drawing room. The number is arbitrary. |
| **Hexagonal equals clean/onion** | Same inward topology, different prescription. Hexagonal is the minimal symmetric version; clean/onion add rings and boundary objects. |
| **Every port needs an interface** | Only where the inside must substitute the outside. Inbound adapters can depend on a concrete use case. |
| **Hexagonal fixes a mud** | It protects the outside boundary. The inside can still be a mud. |

## Hexagonal vs. the other Day 2 styles

|  | Top-level axis | Port / contract owned by | Database | Boundary payload | Decomposes the inside? | Characteristic failure |
| --- | --- | --- | --- | --- | --- | --- |
| **Layered** | Technical role | Whoever finds it convenient | Foundation | ORM entities, framework types | No | Sinkhole; layered monolith |
| **Hexagonal** | Inside / outside | The inside | An adapter at the edge | Domain types and DTOs | No | One giant hexagon with a mud inside |
| **Clean / onion** | Concentric rings | The inner ring | An outer-ring detail | DTOs; inner entities do not leak outward | No | Ring ceremony; relapse into layered |
| **Vertical slice** | Business capability | The slice | Per-slice | Slice DTOs | Yes, by feature | Duplication and cross-slice consistency |

### Layered vs. hexagonal

Layered asks, "What kind of code is this?" Hexagonal asks, "Is this inside the application or outside it?"

The layers can survive inside the hexagon. A module can have a domain, an application service, and an adapter. What changes is the top-level axis and the direction of the boundary: the database is no longer the foundation; it is one adapter among many.

### Hexagonal vs. clean and onion

They share the dependency rule: dependencies point inward; the domain does not know the framework or the database.

- **Clean** prescribes four rings — entities, use cases, interface adapters, frameworks and drivers — plus input/output ports, interactors, and presenters. It is a fuller architecture.
- **Onion** prescribes a domain model at the center, surrounded by domain services, application services, and infrastructure. It emphasizes the model.
- **Hexagonal** prescribes only two regions and the symmetry between driving and driven ports. It is the least prescriptive of the three.

Cockburn's distinctive claim is the **symmetry of inputs and outputs**. Clean's is the **ring taxonomy**. Onion's is the **domain model at the core**. All three can decay into layered if the dependency rule is not enforced, and none of them decomposes the inside.

### Hexagonal vs. vertical slice

They are orthogonal.

- Hexagonal protects the **I/O boundary**: the application does not know the delivery mechanism or the vendor.
- Vertical slice optimizes the **change axis**: one feature change stays in one slice.
- A slice can be internally hexagonal. A hexagon can contain vertical slices.
- A single hexagon for the whole application tends to hide capability boundaries; a hexagon per module or slice is usually the better composition.

The combination worth defending for a business system: **modular monolith, each module a hexagon, with vertical slices inside where the change locality matters.**

## The repo's example is already a small hexagon

This matters because it makes the pattern concrete without a rewrite:

| File | Hexagonal role | What it already proves |
| --- | --- | --- |
| `contracts.ts` | Driven ports (`OrderRepository`, `Mailer`, `Clock`) plus the `Order` type | The application owns the contracts |
| `order-service.ts` | Application service / use case | It imports only `contracts.ts`, never `infrastructure.ts` |
| `infrastructure.ts` | Adapters | The in-memory repository and console mailer implement the ports |
| `main.ts` | Driving adapter + composition root | It is the only file that imports the concrete adapters |
| `composition-root.md` | The rationale | `new` lives at the edge |

What is missing is not a folder called `ports/`. It is four design decisions:

| Gap | Why it matters | Refactor |
| --- | --- | --- |
| `Order` is an anemic record | No invariants; `placeOrder` can create a negative total | Give `Order` a `place` factory and a `Money` value object |
| `OrderRepository` is write-only | The application cannot load or enforce a lifecycle | Add `byId`; keep `save`; split read models if they appear |
| `Mailer` is channel-shaped | The application knows about email | Replace it with `OrderNotifier.orderPlaced(order)` |
| `placeOrder` saves then mails | A mail failure leaves an order with no confirmation; a retry can duplicate the mail | Use an outbox or a durable queue behind the notifier; see [01c](01c-outbox-pattern.md) |
| No error contract | The caller cannot distinguish not-found from a provider failure | Define the port's errors and map adapter errors |

A sketch of the improved core:

```ts
// domain/order.ts
// Value objects (OrderId, Email, Money) omitted for brevity.
export class Order {
  private constructor(
    readonly id: OrderId,
    readonly customerEmail: Email,
    readonly total: Money,
    readonly placedAt: Date,
  ) {}

  static place(customerEmail: Email, total: Money, now: Date): Order {
    if (!total.isPositive()) {
      throw new InvalidOrder("total must be positive");
    }
    return new Order(OrderId.generate(), customerEmail, total, now);
  }
}
```

```ts
// application/ports/order-repository.ts
export interface Orders {
  byId(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

// application/ports/order-notifier.ts
export interface OrderNotifier {
  orderPlaced(order: Order): Promise<void>;
}
```

```ts
// application/place-order.ts
export class PlaceOrder {
  constructor(
    private readonly orders: Orders,
    private readonly notifier: OrderNotifier,
    private readonly clock: Clock,
  ) {}

  async execute(command: PlaceOrderCommand): Promise<OrderId> {
    const order = Order.place(command.customerEmail, command.total, this.clock.now());
    await this.orders.save(order);
    await this.notifier.orderPlaced(order);
    return order.id;
  }
}
```

This sketch still has the dual-write problem: if `save` succeeds and `orderPlaced` fails, the order exists without a notification. In production, the notifier is fed by an outbox in the same transaction as the order row, or the notification is a durable queue message. Hexagonal makes the seam visible; it does not make the two writes atomic.

The wiring stays at the edge:

```ts
// composition-root.ts
const orders = new PostgresOrders(pool);
const notifier = new OutboxOrderNotifier(outbox);
const placeOrder = new PlaceOrder(orders, notifier, new SystemClock());

const http = new PlaceOrderController(placeOrder);
```

`PlaceOrderController` depends on the concrete `PlaceOrder` class. That is still hexagonal: the controller is an adapter, outside the application, and the arrow points inward. There is no `IPlaceOrder` because nothing inside needs to substitute the controller. This is the port-versus-interface distinction in one line.

The refactor is not "add `ports/` and `adapters/`." It is "make the domain real, narrow the ports, and decide who owns the transaction."

## When it pays

- **Multiple drivers.** HTTP plus CLI plus queue plus cron plus tests is the canonical case.
- **Volatile or replaceable infrastructure.** Payment providers, storage, messaging, and third-party APIs.
- **A domain worth testing without I/O.** Pricing, eligibility, billing, scheduling, workflows with real rules.
- **A long-lived system.** The longer the horizon, the more likely the framework or vendor changes.
- **Delayed decisions.** You want to ship the behavior before choosing the infrastructure.
- **A real test seam.** You need to run the use case with deterministic time, failures, or edge cases that are hard to produce against the real adapter.

## When it does not

- **Thin CRUD.** If the use case is a form over a table, the mapping tax dominates.
- **One adapter, no expected replacement, short horizon.** The port is ceremony.
- **A prototype.** Learn the domain first; consolidate later. Controlled chaos is legitimate early ([02a](02a-big-ball-of-mud.md#what-it-is-not)).
- **The real problem is module boundaries.** Hexagonal will not decompose the inside; a mud with ports is still a mud.
- **The team will cargo-cult the folders.** A rule nobody understands is a costume.
- **The framework's conventions are worth more than the purity.** A framework-shaped adapter at the edge can be the pragmatic choice.

## Three questions before choosing it

1. **Do I have more than one driver, or more than one real outbound implementation — or a test double I actually need?**
2. **Is the domain worth testing without I/O, and does it change independently of the infrastructure?**
3. **Can I enforce the dependency rule — imports, CI, module boundaries — and does the team understand what the ports are for?**

If the first two are yes and the third is no, fix the third before adding ports. If all three are no, hexagonal is ceremony. That is not a moral judgment; it is a trade.

## Decision checklist

- [ ] Can I run the main use cases with no database, HTTP server, queue, or system clock?

- [ ] Does the application import any adapter, framework, ORM, or vendor SDK?

- [ ] Is each port named in the domain's language, not the vendor's or the table's?

- [ ] Does any ORM row, vendor type, or HTTP DTO cross a port?

- [ ] Do I know who owns the transaction boundary, and is it explicit?

- [ ] Is there a composition root, and is it the only place that knows concretes?

- [ ] Does the hexagon have internal module boundaries, or is it one big core?

- [ ] Are the fakes faithful to the contract — errors, constraints, concurrency?

- [ ] Can I swap an adapter without changing the use case?

- [ ] Is each port earning its keep — multiple implementations, a real test seam, or a volatile dependency?

- [ ] Can a new engineer see the inside/outside from the imports, not just the folder names?

- [ ] Do I know what would make me remove a port?

If the answer to the last question is "nothing," the ports are not a decision. They are a habit.

## Trade-off matrix row

| Style or decision | Optimizes | Costs | Use when | Avoid when | Failure mode |
| --- | --- | --- | --- | --- | --- |
| **Hexagonal / ports and adapters** | Testability without I/O; multiple drivers; replaceable infrastructure; delayed decisions; framework independence; explicit contracts | Mapping tax; indirection and ceremony; leaky ports; transaction ambiguity; fake drift; one giant hexagon; composition-root sprawl | Multiple drivers; volatile infrastructure; rich domain; long-lived system; testability is a real constraint; you can enforce the dependency rule | Thin CRUD; one adapter; prototype; short horizon; the real problem is module boundaries; the team will cargo-cult the folders | Ports mirror the database; ORM entities cross; anemic hexagon; one giant hexagon with a mud inside; fake drift; transaction per call |

This row is also collected in the [consolidated trade-off matrix](tradeoffs.md).

## Runnable examples

A 31-nuance catalog expands the rules in this note: [02b-hexagonal-nuances.md](02b-hexagonal-nuances.md). The runnable TypeScript lab is [02b-hexagonal-example](02b-hexagonal-example/README.md); each file contains the correct code, the anti-pattern, and a `node:test` proof.

```bash
node --test architecture/02b-hexagonal-example/run-all.test.ts
```

The end-to-end file walks a registration through a driving adapter, the use case, the domain, two driven ports, and their adapters, with the composition root as the only place that knows the concretes.

## Sources

- Cockburn, [*Hexagonal Architecture (Ports and Adapters)*](https://alistair.cockburn.us/hexagonal-architecture/) (2005) — the purpose statement, primary/secondary ports, and the arbitrary hexagon.
- Martin, [*The Clean Architecture*](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) (2012) and *Clean Architecture* (2017) — the Dependency Rule and the four-ring prescription.
- Palermo, [*The Onion Architecture*](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/) (2008) — the domain model at the core.
- Fowler, [*Patterns of Enterprise Application Architecture*](https://martinfowler.com/eaaCatalog/) (2002) and [*PresentationDomainDataLayering*](https://martinfowler.com/bliki/PresentationDomainDataLayering.html) (2015) — the layered baseline.
- Evans, [*Domain-Driven Design*](https://www.domainlanguage.com/ddd/) (2003) — bounded contexts and the domain model.
- Parnas, [*On the Criteria To Be Used in Decomposing Systems into Modules*](https://www.cs.colostate.edu/~france/CS314/Readings/Parnas-decomposition.pdf) (1972) — information hiding and decomposition by change.
- Seemann, [*Composition Root*](https://blog.ploeh.dk/2011/07/28/CompositionRoot/) (2011) — why `new` lives at the edge.
- Feathers, *Working Effectively with Legacy Code* (2004) and Meszaros, *xUnit Test Patterns* (2007) — seams, fakes, and contract tests.
- HappyCoders, [*Hexagonal Architecture: Robust Software With Interfaces Instead of Layers*](https://www.youtube.com/watch?v=KEuaRdBJGTY) — the goal framing, the layered-decay narrative, the mixing-console analogy, two-way mapping, adapter-side testing, module enforcement, and the honest module-cost caveat.
- Hyett, [*Hexagonal Architecture: What You Need To Know — Simple Explanation*](https://www.youtube.com/watch?v=bDWApqAUjEI) — a useful vocabulary introduction; its honeycomb section conflates the pattern with service decomposition, and its listed local-development and latency costs are microservice costs.
- [02 — Layered architecture](02-layered-architecture.md), [02a — Big ball of mud](02a-big-ball-of-mud.md), and [01a — Modular monolith](01a-modular-monolith.md) — the boundary and decomposition context this note assumes.

## Next

- [02b — Hexagonal nuances](02b-hexagonal-nuances.md) — the 31-nuance catalog, with the rule, the anti-pattern, and a proof for each.
- [Hexagonal lab](02b-hexagonal-example/README.md) — the runnable registration slice and the 30 TypeScript files.
- [02 — Layered architecture](02-layered-architecture.md) — the style hexagonal inverts, and the dependency leak it leaves behind.
- [02a — Big ball of mud](02a-big-ball-of-mud.md) — why a hexagon with no internal boundary is still a mud.
- [01a — Modular monolith](01a-modular-monolith.md) — the decomposition that should sit around the hexagon.
- [01c — Outbox pattern](01c-outbox-pattern.md) — how to make the order-plus-notification step reliable.
- [01e — External calls inside a transaction](01e-external-calls-inside-transactions.md) — the anti-pattern the `placeOrder` sketch must avoid.
- [Composition root](../fundamentals/oop/design-patterns/06-composition-root/composition-root.md) — the existing mini-hexagon this note builds on.
- [Trade-offs](tradeoffs.md) — the consolidated matrix.