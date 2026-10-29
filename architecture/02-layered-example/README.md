# Layered architecture — 42 nuances, plus an end-to-end slice

*One file per nuance from the layered-architecture inventory. Each file contains the correct code, the anti-pattern it avoids, and a short `node:test` proof. Start with [`00-end-to-end.ts`](nuances/00-end-to-end.ts) to see the whole chain before the individual rules.*

This is the runnable companion to [02 — Layered architecture](../02-layered-architecture.md). The goal is to make the nuances concrete: every file is small enough to read in one sitting and runnable without a framework, a container, or a database server.

## Run

```bash
# Everything (the slice + 42 nuances, one process)
node --test architecture/02-layered-example/run-all.test.ts

# Or one file at a time
node --test architecture/02-layered-example/nuances/00-end-to-end.ts
node --test architecture/02-layered-example/nuances/18-transaction-boundary.ts

# Or the whole directory through your shell's glob
node --test architecture/02-layered-example/nuances/*.ts
```

Each file also runs on its own with `node path/to/file.ts`; the tests execute and print their results.

Type-check the lab without the rest of the repository:

```bash
npx tsc --noEmit \
  --target esnext --module nodenext --moduleResolution nodenext \
  --strict --skipLibCheck --types node \
  --allowImportingTsExtensions --verbatimModuleSyntax --erasableSyntaxOnly \
  architecture/02-layered-example/_shared.ts \
  architecture/02-layered-example/nuances/*.ts
```

## The shape of every file

```text
// NN — Name
// Scenario: the concrete situation.
// (a) correct: the code that keeps the boundary.
// (b) anti-pattern: the shortcut that erodes it.
// (c) test: a short node:test proof, including the anti-pattern's failure.
```

The anti-pattern is not a strawman. Each one is a shortcut a real codebase makes: a controller that computes a discount, a repository that commits, a cache that never invalidates, a shared `utils` module that imports persistence.

## Index

### 0. Read this first

| # | Walkthrough | File | What the test proves |
| --- | --- | --- | --- |
| 00 | One request, end to end | [`00-end-to-end.ts`](nuances/00-end-to-end.ts) | Controller → use case → application service → domain service → port → adapter → aggregate, plus the cost of the use-case contract. |

### A. Structure and responsibilities

| # | Nuance | File | What the test proves |
| --- | --- | --- | --- |
| 1 | Four canonical layers | [`01-four-canonical-layers.ts`](nuances/01-four-canonical-layers.ts) | Presentation, business, persistence, and database each have one job. |
| 2 | Downward dependency rule | [`02-downward-dependency.ts`](nuances/02-downward-dependency.ts) | A repository calling a service creates an upward edge. |
| 3 | Strict vs. relaxed layers | [`03-strict-vs-relaxed-layers.ts`](nuances/03-strict-vs-relaxed-layers.ts) | A relaxed read is safe; a relaxed write bypasses audit. |
| 4 | Layer skipping | [`04-layer-skipping.ts`](nuances/04-layer-skipping.ts) | Skipping the service is acceptable for reads, not writes. |
| 5 | Fat controller | [`05-fat-controller.ts`](nuances/05-fat-controller.ts) | A duplicated discount rule goes stale when the policy changes. |
| 6 | Sinkhole | [`06-sinkhole.ts`](nuances/06-sinkhole.ts) | A pass-through service adds no validation or audit. |
| 7 | Anemic vs. rich domain | [`07-anemic-vs-rich.ts`](nuances/07-anemic-vs-rich.ts) | The anemic model accepts a negative total. |
| 8 | Application vs. domain service | [`08-application-vs-domain-service.ts`](nuances/08-application-vs-domain-service.ts) | The application service composes swappable domain services. |
| 9 | Where validation lives | [`09-validation-placement.ts`](nuances/09-validation-placement.ts) | Shape, invariant, and uniqueness are rejected at different layers. |
| 10 | Where error handling lives | [`10-error-handling.ts`](nuances/10-error-handling.ts) | Domain errors map to 400/404 only at the edge. |

### B. Models and data transformation

| # | Nuance | File | What the test proves |
| --- | --- | --- | --- |
| 11 | Entity vs. DTO vs. ViewModel vs. domain | [`11-model-shapes.ts`](nuances/11-model-shapes.ts) | One leaky shape exposes internals and the wrong units. |
| 12 | Mapping between layers | [`12-mapping.ts`](nuances/12-mapping.ts) | A cast leaks a string date and cents into the domain. |
| 13 | Read models / projections | [`13-read-models.ts`](nuances/13-read-models.ts) | A projection needs one query; an aggregate report needs N+1. |
| 14 | Repository interface vs. implementation | [`14-repository-interface.ts`](nuances/14-repository-interface.ts) | The service works with either adapter; the bad service cannot swap. |
| 15 | Pagination, filtering, sorting | [`15-pagination-filtering-sorting.ts`](nuances/15-pagination-filtering-sorting.ts) | The repository applies paging; the anti-pattern loads every row. |
| 16 | N+1 queries | [`16-n-plus-one.ts`](nuances/16-n-plus-one.ts) | A batch query uses 2 queries; the loop uses 1 + N. |
| 17 | Batch operations | [`17-batch-operations.ts`](nuances/17-batch-operations.ts) | A failure rolls back the batch; per-row commits leave a partial write. |

### C. Transactions and consistency

| # | Nuance | File | What the test proves |
| --- | --- | --- | --- |
| 18 | Transaction boundary at the service | [`18-transaction-boundary.ts`](nuances/18-transaction-boundary.ts) | A failed transfer rolls back both sides; per-call commits leave a debit. |
| 19 | Repository is transaction-agnostic | [`19-transaction-agnostic-repository.ts`](nuances/19-transaction-agnostic-repository.ts) | The repository rolls back with the service; a committing repo survives. |
| 20 | Callback-based unit of work | [`20-unit-of-work.ts`](nuances/20-unit-of-work.ts) | `transaction(work)` rolls back; manual begin/commit has no path. |
| 21 | Passing the tx handle | [`21-passing-tx-handle.ts`](nuances/21-passing-tx-handle.ts) | A default-connection write survives the caller's rollback. |
| 22 | Nested transactions | [`22-nested-transactions.ts`](nuances/22-nested-transactions.ts) | An inner BEGIN is ignored, so join the caller's transaction, use a savepoint, or take a second connection. |
| 23 | Isolation levels | [`23-isolation-levels.ts`](nuances/23-isolation-levels.ts) | Dirty read, non-repeatable read, phantom, and write skew under each level. |
| 24 | Optimistic vs. pessimistic locking | [`24-locking.ts`](nuances/24-locking.ts) | The second stale write conflicts; the second lock attempt is busy. |
| 25 | Idempotency | [`25-idempotency.ts`](nuances/25-idempotency.ts) | The same key returns one order; the naive retry creates two. |
| 26 | Distributed boundaries | [`26-distributed-boundaries.ts`](nuances/26-distributed-boundaries.ts) | A saga compensates; a dual write leaves the order pending. |
| 27 | Eventual consistency | [`27-eventual-consistency.ts`](nuances/27-eventual-consistency.ts) | The projection lags; reading the write model hides the lag. |

### D. Cross-cutting concerns

| # | Nuance | File | What the test proves |
| --- | --- | --- | --- |
| 28 | Logging placement | [`28-logging-placement.ts`](nuances/28-logging-placement.ts) | SQL stays out of presentation; HTTP stays out of persistence. |
| 29 | Authorization placement | [`29-authorization-placement.ts`](nuances/29-authorization-placement.ts) | The edge checks identity; ownership, status, and amount caps live where the order is loaded. |
| 30 | Caching | [`30-caching.ts`](nuances/30-caching.ts) | Service cache invalidates on write; repository cache serves stale data. |
| 31 | Configuration | [`31-configuration.ts`](nuances/31-configuration.ts) | Injected config is testable; `process.env` hides a default. |
| 32 | Dependency injection / wiring | [`32-dependency-injection.ts`](nuances/32-dependency-injection.ts) | The composition root can inject a spy; the self-wiring service cannot. |
| 33 | Shared utilities | [`33-shared-utilities.ts`](nuances/33-shared-utilities.ts) | A shared kernel is a leaf; a utils dumping ground creates forbidden edges. |
| 34 | Domain events | [`34-domain-events.ts`](nuances/34-domain-events.ts) | The outbox rolls back with the order; publishing early emits a phantom event. |

### E. Testing

| # | Nuance | File | What the test proves |
| --- | --- | --- | --- |
| 35 | Unit testing per layer | [`35-unit-testing-per-layer.ts`](nuances/35-unit-testing-per-layer.ts) | Service, controller, and domain tests need no database. |
| 36 | Integration testing at boundaries | [`36-integration-testing.ts`](nuances/36-integration-testing.ts) | A real SQLite constraint catches a duplicate; a mock does not. |
| 37 | Contract testing | [`37-contract-testing.ts`](nuances/37-contract-testing.ts) | Fake and HTTP adapters pass the same contract; a bad mock fails. |

### F. Evolution and alternatives

| # | Nuance | File | What the test proves |
| --- | --- | --- | --- |
| 38 | Logical layers vs. physical tiers | [`38-logical-vs-physical-tiers.ts`](nuances/38-logical-vs-physical-tiers.ts) | The same service code works in a monolith or a split deployment. |
| 39 | Modular monolith | [`39-modular-monolith.ts`](nuances/39-modular-monolith.ts) | Importing an internal module file is a boundary violation. |
| 40 | Migrating toward Clean/Hexagonal | [`40-migrating-to-hexagonal.ts`](nuances/40-migrating-to-hexagonal.ts) | A port can be swapped at the root; a vendor `new` inside the domain cannot. |
| 41 | When to add CQRS | [`41-cqrs.ts`](nuances/41-cqrs.ts) | The read query skips the aggregate; the report loads N+1. |
| 42 | Multi-tenancy | [`42-multi-tenancy.ts`](nuances/42-multi-tenancy.ts) | An optional tenant filter leaks another tenant's row. |

### G. Appendix

| # | Nuance | File | What the test proves |
| --- | --- | --- | --- |
| A | Vocabulary: object, class, value object, entity, model, aggregate | [`appendix-vocabulary.ts`](nuances/appendix-vocabulary.ts) | Value objects compare by value, entities by identity; the aggregate enforces its invariant. |

## What is real and what is modeled

- **Real:** all TypeScript types, `node:test` assertions, and the `node:sqlite` repository in #36.
- **Modeled:** the transaction manager (#22), isolation levels (#23), locking (#24), saga (#26), eventual consistency (#27), contract provider (#37), deployment shapes (#38), module graph (#39), and query counters (#41). These are small deterministic models that make the behavior visible without a database server or a network. The file headers say so.
- **Not production code:** error handling is simplified to `Error` messages; there is no Express/NestJS, ORM, or container. The point is the layer boundary, not the framework.

## How to use it

1. Read the matching section in [02 — Layered architecture](../02-layered-architecture.md).
2. Run the one file.
3. Change the anti-pattern to the correct code, or vice versa, and watch the test fail.
4. Add a nuance when a real code review finds a boundary you cannot name.
