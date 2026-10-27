# 01a — Modular monolith

*A modular monolith is one deployable application made of modules with explicit public contracts, private internals, and clear data ownership.*

The running example is the [order system](../fundamentals/oop/design-patterns/06-composition-root/main.ts). It is the default design in the [capstone](../roadmap.md), and it is the baseline you should have to argue your way out of.

This note expands the modular monolith row in the [Day 1 trade-off vocabulary](01-tradeoff-vocabulary.md). It is reference material for Day 3, not a substitute for drawing the module map yourself.

## The definition

A **monolith** is a system with one deployment unit. That is all the word means. It says nothing about quality. A monolith can be a well-structured set of modules or a big ball of mud.

A **modular monolith** is a monolith with explicit boundaries:

- the code is organized by **business capability**, not by technical layer;
- each module has a **public contract** and **private internals**;
- each module owns its **data**; a **schema per module** is the usual way to enforce it;
- modules communicate through contracts, not by reaching into each other's tables or internals;
- the whole thing is still **built, tested, and deployed as one unit**.

Shopify describes its own version this way: all the code powers a single application, but there are strictly enforced boundaries between domains. Each component exposes a public API and takes exclusive ownership of its data ([Westeinde, 2019](https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity)).

A modular monolith is usually one deployable. A web process and a background worker can run from the same codebase; if you deploy them separately, count that as more than one deployment unit and accept the extra operational cost. The defining property is the **boundary discipline**, not the number of operating-system processes.

## What it is not

| It is not | Why |
| --- | --- |
| **A layered monolith** | A layered monolith organizes the whole app by technical layer: controllers, services, repositories. A modular monolith organizes by business capability; each module may use layers internally. |
| **A big ball of mud** | A big ball of mud has no enforced boundaries. A modular monolith is defined by its boundaries. |
| **Microservices in one process** | Microservices buy independent deployment and pay for it with network calls and distributed consistency. A modular monolith deliberately does not pay that price. |
| **One folder per layer** | `controllers/`, `services/`, `repositories/` is not a module map. It is a technical taxonomy. |
| **A shared database with a shared schema** | One database server is fine. One undivided schema is not. Shared tables are hidden coupling. |
| **A temporary mess you will fix later** | "We will modularize when we need to" usually means "we will extract services from a big ball of mud." That is the expensive path. |

The important distinction is the **primary axis of decomposition**. A layered monolith decomposes by *what the code does technically*. A modular monolith decomposes by *what the business does*. You can still have layers inside a module. In fact, you probably should; that is Day 2's topic.

## Why it is the default

A modular monolith keeps the costs that are real and defers the costs that are speculative:

- **Local calls.** A function call is faster and easier to debug than a network call. It does not time out, retry, or serialize.
- **Local transactions.** A module can use one ACID transaction for its own invariants. You do not need a saga to keep one module's data consistent.
- **One deployment pipeline.** One build, one test suite, one release, one rollback. This is a real advantage for a small or medium team.
- **One runtime to observe.** One set of logs, metrics, traces, and alerts, at least at the start.
- **Cheap refactoring.** Moving code between modules is a code change, not a cross-service migration.
- **Boundaries before distribution.** You can learn where the seams belong while the cost of being wrong is low.

Martin Fowler's [Monolith First](https://martinfowler.com/bliki/MonolithFirst.html) argument is not that monoliths are always better. It is that microservices only work well with stable boundaries, and stable boundaries are hard to find at the beginning. Almost all successful microservice stories he heard had started with a monolith that grew too big and was broken up. Almost all greenfield microservice systems he heard about had ended in serious trouble.

Fowler also names the [Microservice Premium](https://martinfowler.com/bliki/MicroservicePremium.html): the operational and coordination cost of a suite of services. You should pay it only when the forces justify it.

Shopify is a useful counterweight to the idea that a monolith is automatically a failure. It is one of the largest Rails codebases in existence, worked on by more than a thousand developers. It chose a modular monolith over microservices because it wanted modularity without multiplying deployment units. Its componentization effort reorganized code by real-world concepts, defined public APIs, gave each component exclusive data ownership, and built tooling to detect boundary violations.

That is the point: **a modular monolith is not the absence of architecture. It is architecture with a different deployment boundary.**

## The module

A module is a **unit of change and ownership**, not a folder. It should be nameable as a business capability and describable without saying "controller," "service," or "repository."

A useful module has:

- a **business responsibility** — what it does for the business;
- a **public contract** — the commands, queries, events, and types other modules may use;
- **private internals** — domain model, persistence, adapters, helpers;
- **data ownership** — the tables or schema it is allowed to write;
- **tests** — unit tests for its domain, integration tests for its schema, contract tests at its boundary;
- an **owner** — a team or a person who can say yes or no.

### Order system module map

| Module | Responsibility | Owns | Public contract | Publishes | Consumes |
| --- | --- | --- | --- | --- | --- |
| **Orders** | Capture and track the order lifecycle | `orders`, `order_lines`, `order_status` | `placeOrder`, `cancelOrder`, `getOrder` | `OrderPlaced`, `OrderCancelled` | `PaymentCaptured`, `InventoryReserved` |
| **Payments** | Authorize, capture, and refund payments | `payments`, `payment_attempts`, `refunds` | `authorize`, `capture`, `refund` | `PaymentCaptured`, `PaymentFailed` | `OrderPlaced` |
| **Inventory** | Track stock and reservations | `stock_items`, `reservations` | `reserve`, `release`, `available` | `InventoryReserved`, `InventoryRejected` | `OrderPlaced`, `OrderCancelled` |
| **Notifications** | Send customer and operations messages | `notification_log`, `templates`, `preferences` | `sendOrderConfirmation` | `NotificationSent`, `NotificationFailed` | `OrderPlaced`, `PaymentCaptured` |
| **Reporting** | Answer business questions without loading checkout | `order_facts`, `daily_sales`, projections | `salesByDay`, `ordersByStatus` | — | `OrderPlaced`, `PaymentCaptured`, `InventoryReserved` |

A tiny **shared kernel** is allowed: `Money`, `OrderId`, `CustomerId`, and other stable value types. Keep it small and stable. A shared kernel is not a dumping ground for "common" code. The larger it gets, the more the modules are coupled.

### The boundary tests

Ask these before you accept a module boundary:

1. Can I change this module's internals without touching another module?
2. Can I describe what it does without naming a technical layer?
3. Does it own the data it writes?
4. Can another module use it without importing its internals or reading its tables?
5. Can I test it without starting the whole application?
6. Is there a team or person who owns it?
7. If I had to extract it, is there a clean seam?

If the answer to several is no, you have a folder, not a module.

### Module vs. bounded context

A **module** is a code and ownership boundary. A **bounded context** is a model boundary: a place where a particular word has a particular meaning. "Order" in the Orders context may mean a customer's purchase; "order" in the Reporting context may mean a row in a sales fact table. They are not the same model.

Modules and bounded contexts often align, but not always. One bounded context may contain several modules, and one module may serve more than one context. Day 3 covers context maps and ubiquitous language. For now, the practical rule is: **do not share a domain model across modules just because the words look the same.**

## Module boundaries are not layers

A typical layered monolith looks like this:

```text
src/
  controllers/
  services/
  repositories/
  models/
```

Every feature is spread across every folder. To change one feature, you touch all of them. The code is organized by technical role, so the business boundary is invisible.

A modular monolith looks like this:

```text
src/
  modules/
    orders/
      domain/
      application/
      infrastructure/
      index.ts          # public contract
      schema.sql        # owned schema
    payments/
      domain/
      application/
      infrastructure/
      index.ts
      schema.sql
    inventory/
    notifications/
    reporting/
  shared/
    money.ts
    ids.ts
  composition-root.ts
```

The layers still exist, but they are **inside** a module. The top-level axis is the business capability. That is the difference.

This shape also sets up Day 2: each module can use a hexagonal or clean structure internally, with its domain isolated from its adapters. The module boundary and the dependency direction are separate decisions.

## Data ownership

The hard part of a modular monolith is not the folder structure. It is the data.

The default pattern is **one database server, one schema per module**:

- PostgreSQL: `orders`, `payments`, `inventory`, `notifications`, `reporting` schemas.
- MySQL: separate databases on the same server.
- SQLite: separate files, or a strict table-prefix convention if you must share a file.

Each module owns its schema and its migrations. Other modules do not:

- read its tables directly;
- join across its schema;
- add foreign keys into it;
- share its ORM entities;
- run migrations against it.

A **shared database is fine. A shared schema is not.** The database server is infrastructure. The schema is a boundary.

### Cross-module data access

When module A needs data from module B, it has three legitimate options:

1. **Call B's public contract.** Best for a synchronous query or command where A needs the answer now.
2. **Consume an event from B and keep a local read model.** Best for reporting, notifications, and other eventually consistent views.
3. **Ask B to push a purpose-built projection.** Best when the consumer needs a stable, query-shaped view rather than the domain model.

What it must not do is reach into B's tables. That is not an integration; it is a hidden dependency that will break when B changes its schema.

If two modules keep needing the same table, one of three things is true:

- the boundary is wrong;
- the table is really a shared kernel;
- you have not built the read model that the consumer actually needs.

### Reporting is a special case

Reporting is the usual reason teams break data ownership. The answer is not "let the reporting team query the operational database." That couples reporting to every schema and puts analytical load on checkout.

Use a read model:

- Reporting consumes domain events and builds its own tables;
- or Reporting reads from a replica with a published, stable view;
- or a separate analytics store is fed by change data capture or events.

The operational modules stay free to change. Reporting gets a model designed for questions, not for transactions.

### Foreign keys across modules

A foreign key across module schemas is tempting because the database can enforce integrity. It also couples the schemas: you cannot extract one module without dealing with the constraint, and migrations become coordinated.

Default: **no cross-module foreign keys.** If you keep one, treat it as a deliberate architectural coupling, record it in an ADR, and know it is a seam you will have to cut later.

## Transactions and consistency

Inside a module, use a local ACID transaction. That is one of the main reasons to choose a modular monolith.

Across modules, you have a real trade-off:

| Approach | Use when | Cost |
| --- | --- | --- |
| **Keep the invariant in one module** | The data really belongs together | You may need to redraw the boundary |
| **One transaction across module schemas** | The invariant truly cannot be eventual, and the modules will always share a database | Schema and migration coupling; extraction becomes harder |
| **Outbox plus events plus compensation** | The invariant can be eventual, or the side effect must survive a crash | Eventual consistency, idempotency, replay, and observability work |

A single ACID transaction across module schemas is technically local because it is one database. Architecturally, it is still a coupling: the modules must share a database and coordinate migrations. Use it sparingly, for invariants that genuinely cannot be eventual, and write down that you did.

Do not hold a database transaction open across a network call. If Payments calls a payment provider, commit the local state first, then call the provider, then record the result. The provider is not participating in your transaction, and pretending it is will create locks and inconsistent state.

### Order flow example

A pragmatic order flow inside the modular monolith:

```text
1. Orders validates the request and writes the order in its local transaction.
2. Orders calls Inventory through its public contract to reserve stock.
   - If the reservation must be immediate, this is an in-process call.
   - If it can be eventual, Orders publishes OrderPlaced and Inventory reacts.
3. Orders calls Payments through its public contract to authorize.
   - The external provider call happens outside the database transaction.
4. Orders marks the order confirmed and writes an outbox row.
5. The outbox publisher emits OrderConfirmed.
6. Notifications consumes OrderConfirmed and sends the email.
7. Reporting consumes the events and updates its read model.
```

The exact sequence depends on the business invariant. The point is to make the consistency boundary explicit, not to make everything asynchronous because microservices are "event-driven."

Two details that matter:

- If payment fails after stock is reserved, the order flow must release the reservation or otherwise compensate. That is a business policy, not an implementation detail.
- External calls need idempotency keys and a reconciliation path. A successful call to the payment provider is not rolled back by a local database transaction.

## Integration inside the monolith

In-process calls are cheap. Use them when they are the simplest thing that satisfies the force:

- a synchronous query that needs the current answer;
- a command whose result the caller must know before continuing;
- a low-latency path where a queue would add delay without buying decoupling.

Use events when they buy something concrete:

- multiple consumers need the same fact;
- the producer should not know the consumers;
- the side effect can be eventual;
- the side effect must survive a crash and be retried;
- you need an audit trail of what happened.

Do not use an event bus for everything. It hides control flow, makes debugging harder, and turns a local call into an eventual consistency problem. "We might need microservices later" is not a force. A clean module contract is what makes later extraction possible; an event bus is not a substitute for a boundary.

### Contracts

A module's public contract should use stable types:

- commands and queries;
- result types;
- events;
- identifiers and value objects.

Do not export the module's domain entities or persistence models. If another module needs a different shape, it should get a DTO or a read model, not your internal entity. Sharing an entity is sharing a schema by another name.

## Enforcement

Boundaries that are not enforced are suggestions. The first rule is simple:

> A module may import another module only through its public entry point.

In TypeScript, that means:

```ts
// allowed
import { placeOrder } from "../orders/index.ts";

// forbidden
import { OrderTable } from "../orders/infrastructure/order-table.ts";
```

A convention plus code review is a start. It is not enough at scale. Use tooling:

| Ecosystem | Tools |
| --- | --- |
| TypeScript / JavaScript | `dependency-cruiser`, ESLint `no-restricted-imports`, [Nx module boundaries](https://nx.dev/features/enforce-module-boundaries), package workspaces |
| Java / Kotlin | [ArchUnit](https://www.archunit.org/), [Spring Modulith](https://docs.spring.io/spring-modulith/reference/fundamentals.html) |
| Ruby | [Packwerk](https://github.com/Shopify/packwerk), Shopify's Wedge |
| .NET | `internal`, project references, architecture tests |

Also enforce the data boundary:

- each module owns its migrations;
- CI checks for cross-schema queries;
- no cross-module ORM associations;
- reporting uses a read model or a replica, not operational tables.

And make the boundary observable:

- logs and metrics tagged by module;
- traces that show cross-module calls;
- outbox lag and dead-letter queues;
- an ownership map that says who to call when a module is unhealthy.

## Failure modes

| Failure mode | What it looks like | Fix |
| --- | --- | --- |
| **Big ball of mud** | Everything imports everything; no one can say what a module owns | Draw the module map; define public entry points; add architecture tests |
| **Shared schema** | Modules join each other's tables or share ORM entities | Schema per module; contracts and read models; remove cross-schema joins |
| **Transaction creep** | One transaction touches four modules; migrations must ship together | Keep true invariants in one module; use outbox/saga for the rest; record deliberate exceptions |
| **Deploy coupling** | Every change waits for the whole app's release train | Accept it, or extract only when independent deployment is a measured force |
| **God module** | One module knows about orders, payments, inventory, and notifications | Split by business capability and data ownership; move orchestration to a thin process layer |
| **Cyclic dependencies** | Orders calls Payments, Payments calls Orders | Invert one direction with an event or a port; move shared policy to a third module |
| **Reporting on operational tables** | Analytics queries slow checkout and break on schema changes | Read model, replica, or analytics store fed by events/CDC |
| **Boundary erosion** | Shortcuts under deadline; "just this once" | CI checks, code review, ADRs, and an owner who says no |
| **Microservice envy** | Event bus, sagas, and network-style complexity inside one process | Use in-process calls and local transactions; extract only when the forces justify it |
| **Shared domain model** | Two modules pass the same `Order` entity around | Contract DTOs, separate persistence models, map at the boundary |

The characteristic failure mode of a modular monolith is **boundary erosion**. It does not fail because it is a monolith. It fails because the modules were never really modules.

## When to extract a service

Do not extract a service because the code is messy. Modularize first. Extraction from a big ball of mud produces a distributed big ball of mud.

Extract when a **concrete force** makes independent deployment worth the operational cost:

- **Independent deployment cadence.** One module needs to ship many times a day while the rest ships weekly.
- **Independent scaling.** One workload has a different scaling curve: reporting, media processing, checkout bursts.
- **Ownership and team autonomy.** A team can own a service end to end, including on-call and data.
- **Failure isolation.** A failure in one capability must not take down another, and async workers plus bulkheads inside the monolith are not enough.
- **Compliance or data residency.** Payments, PII, or regulated data must live in a separate trust boundary.
- **Different runtime or language.** The capability needs a runtime the monolith cannot reasonably host.
- **A measured release bottleneck.** The monolith's deploy train is the constraint, and you can show the cost.

Preconditions for extraction:

- a clean module boundary with a public contract;
- data ownership, with no cross-module joins;
- contract tests and observability;
- CI/CD, on-call, and a platform capability;
- a plan for the data migration and the transitional period.

Patterns for the move:

- [Strangler fig](https://martinfowler.com/bliki/StranglerFigApplication.html): route traffic gradually from the old path to the new service.
- **Branch by abstraction**: put an interface in front of the old implementation, then swap it.
- **Anti-corruption layer**: translate between the old and new models instead of sharing them.
- **Outbox / CDC**: publish changes reliably while both sides run.
- **Dual writes with reconciliation**: use only as a transitional tool; dual writes are not a consistency strategy.

Extract the module with the cleanest seam and the strongest force, not the loudest argument.

## Order system: the default design

For the capstone, the starting design is:

- one deployable modular monolith;
- modules: Orders, Payments, Inventory, Notifications, Reporting;
- one database, one schema per module;
- in-process contracts between modules;
- outbox for reliable integration events;
- event-driven notifications and inventory where eventual consistency is acceptable;
- CQRS only for reporting;
- no microservices yet.

What would change it:

- Payments needs a separate compliance boundary;
- Notifications has a scaling or failure-isolation profile that the monolith cannot contain;
- Reporting load cannot be isolated with a read model or replica;
- a team can own a service end to end and the release bottleneck is measured, not imagined.

Those are the triggers to write down in the capstone ADRs.

## Decision checklist

Before choosing a modular monolith, answer these:

- [ ] Can I name the modules as business capabilities, not layers?

- [ ] Does each module own its data and schema?

- [ ] Is there a public contract, and are the internals private?

- [ ] Can I enforce imports in CI?

- [ ] Do I have a real force for independent deployment or scaling?

- [ ] Can cross-module consistency be local, or does it need an outbox/saga?

- [ ] Do I know what would justify extracting a module?

- [ ] Can I observe and operate the modules separately even though they deploy together?

If the last answer is no, fix that before extracting anything. A service you cannot observe is just a remote failure.

## Trade-off matrix row

| Style or decision | Optimizes | Costs | Use when | Avoid when | Failure mode |
| --- | --- | --- | --- | --- | --- |
| **Modular monolith** | Simple deployment; local transactions; fast change; easy debugging; low operational overhead | Shared runtime; coarse scaling; one deploy train; boundaries erode without discipline | Small or medium teams; unclear boundaries; strong consistency; early product; you want to learn the seams before distributing | Independent scaling or deployment is mandatory; teams already block each other on releases; a module needs a separate compliance or failure boundary | Big ball of mud; boundary erosion; shared schema; transaction creep; one deploy blocks everyone |

This row is also collected in the [consolidated trade-off matrix](tradeoffs.md).

## Sources

- Fowler, [*Monolith First*](https://martinfowler.com/bliki/MonolithFirst.html) (2015).
- Fowler, [*Microservice Premium*](https://martinfowler.com/bliki/MicroservicePremium.html) (2015).
- Fowler, [*Microservice Trade-Offs*](https://martinfowler.com/articles/microservice-trade-offs.html) (2015).
- Newman, [*Monolith to Microservices*](https://samnewman.io/books/monolith-to-microservices/) (2019).
- Grzybek, [*Modular Monolith: A Primer*](https://www.kamilgrzybek.com/blog/posts/modular-monolith-primer).
- Westeinde, [*Deconstructing the Monolith: Designing Software that Maximizes Developer Productivity*](https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity), Shopify Engineering (2019).
- Shopify Engineering, [*Under Deconstruction: The State of Shopify's Monolith*](https://shopify.engineering/shopify-monolith).
- Evans, [*Domain-Driven Design*](https://www.domainlanguage.com/ddd/) (2003), for bounded contexts and ubiquitous language.
- Parnas, [*On the Criteria To Be Used in Decomposing Systems into Modules*](https://www.cs.colostate.edu/~france/CS314/Readings/Parnas-decomposition.pdf) (1972), for information hiding.
- Ford, Richards, Sadalage & Dehghani, *Software Architecture: The Hard Parts* (2021), for granularity, data ownership, and distributed workflows.
- [Spring Modulith reference](https://docs.spring.io/spring-modulith/reference/fundamentals.html) and [ArchUnit](https://www.archunit.org/), as examples of enforceable module boundaries.
- [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) and [Nx module boundaries](https://nx.dev/features/enforce-module-boundaries), for TypeScript.
- [Packwerk](https://github.com/Shopify/packwerk), Shopify's Ruby tool for package boundaries.
- [Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html), microservices.io.
- [Strangler fig application](https://martinfowler.com/bliki/StranglerFigApplication.html), Fowler.

## Next

- [C4 model](01b-c4-model.md) — how to draw the context, container, and component views of this design.
- [Outbox pattern](01c-outbox-pattern.md) — reliable event publication across module boundaries.
- [Day 1 trade-off vocabulary](01-tradeoff-vocabulary.md) — the 12 questions and the trade-off matrix.
- [Roadmap](../roadmap.md) — Day 2 for the internal module structure, Day 3 for DDD boundaries, Day 4 for extraction.