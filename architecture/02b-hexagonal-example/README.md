# Hexagonal architecture — 31 nuances, plus an end-to-end slice

*One file per nuance from the hexagonal-architecture inventory. Each file contains the correct code, the anti-pattern it avoids, and a short `node:test` proof. Start with [`00-end-to-end.ts`](nuances/00-end-to-end.ts) to see one registration through every role before the individual rules.*

This is the runnable companion to [02b — Hexagonal architecture](../02b-hexagonal-architecture.md) and the [31-nuance catalog](../02b-hexagonal-nuances.md). The goal is to make the boundary concrete: every file is small enough to read in one sitting and runnable without a framework, a container, or a database server.

## Run

```bash
# Everything (the slice + 31 nuances, one process)
node --test architecture/02b-hexagonal-example/run-all.test.ts

# Or one file at a time
node --test architecture/02b-hexagonal-example/nuances/00-end-to-end.ts
node --test architecture/02b-hexagonal-example/nuances/17-two-way-mapping.ts

# Or the whole directory through your shell's glob
node --test architecture/02b-hexagonal-example/nuances/*.ts
```

Each file also runs on its own with `node path/to/file.ts`; the tests execute and print their results.

Type-check the lab without the rest of the repository:

```bash
npx tsc --noEmit \
  --target esnext --module nodenext --moduleResolution nodenext \
  --strict --skipLibCheck --types node \
  --allowImportingTsExtensions --verbatimModuleSyntax --erasableSyntaxOnly \
  architecture/02b-hexagonal-example/_shared.ts \
  architecture/02b-hexagonal-example/nuances/*.ts
```

## The shape of every file

```text
// NN — Name
// Scenario: the concrete situation.
// (a) correct: the code that keeps the boundary.
// (b) anti-pattern: the shortcut that erodes it.
// (c) test: a short node:test proof, including the anti-pattern's failure.
```

The anti-pattern is not a strawman. Each one is a shortcut a real codebase makes: a repository that returns the ORM row, a core that reads the system clock, a fake that is more permissive than the database, six modules for six classes.

## Index

### 0. Read this first

| # | Walkthrough | File | What the test proves |
| --- | --- | --- | --- |
| 00 | One registration, end to end | [`00-end-to-end.ts`](nuances/00-end-to-end.ts) | HTTP driver → use case → domain → users port + notifier port → adapters, plus a second driver and the composition root. |

### A. The rule and the shape

| # | Nuance | File | What the test proves |
| --- | --- | --- | --- |
| 1 | Inside vs. outside | [`01-inside-outside.ts`](nuances/01-inside-outside.ts) | The import graph exposes a costume hexagon that the folder names hide. |
| 2 | Driving vs. driven ports | [`02-driving-vs-driven.ts`](nuances/02-driving-vs-driven.ts) | Two drivers call one use case; a driver-shaped core cannot accept the CLI. |
| 3 | A port is not an interface | [`03-port-is-not-an-interface.ts`](nuances/03-port-is-not-an-interface.ts) | A concrete use case is still a port when the edge injects it. |
| 4 | Call vs. dependency direction | [`04-call-vs-dependency-direction.ts`](nuances/04-call-vs-dependency-direction.ts) | The core calls outward but imports only inward; `new` in the core breaks the substitution. |
| 5 | What crosses the port | [`05-what-crosses-the-port.ts`](nuances/05-what-crosses-the-port.ts) | A domain object crosses; a row-shaped port leaks `created_at` into the core. |

### B. Port design

| # | Nuance | File | What the test proves |
| --- | --- | --- | --- |
| 6 | Name the port for the need | [`06-name-the-port-for-the-need.ts`](nuances/06-name-the-port-for-the-need.ts) | A screen filter changes the read port, not the domain contract. |
| 7 | Domain port vs. read port | [`07-domain-port-vs-read-port.ts`](nuances/07-domain-port-vs-read-port.ts) | A summary query makes zero aggregate loads; the loop makes one per row. |
| 8 | Do not mirror the vendor | [`08-dont-mirror-the-vendor.ts`](nuances/08-dont-mirror-the-vendor.ts) | Swapping the notifier edits no use case; a queue cannot satisfy an SMTP-shaped port. |
| 9 | The error contract | [`09-error-contract.ts`](nuances/09-error-contract.ts) | Two adapters produce the port's `DuplicateEmail`; an untranslated vendor error escapes. |
| 10 | Port granularity | [`10-port-granularity.ts`](nuances/10-port-granularity.ts) | A narrow fake implements two methods; a god port grows with every table. |
| 11 | The input port's shape | [`11-input-port-shape.ts`](nuances/11-input-port-shape.ts) | Shape errors are 400, invariants are 422, and the request-shaped core needs HTTP headers. |

### C. Consistency and effects

| # | Nuance | File | What the test proves |
| --- | --- | --- | --- |
| 12 | The composition root | [`12-composition-root.ts`](nuances/12-composition-root.ts) | The rooted core does no I/O; the self-wiring core always opens a connection. |
| 13 | Who owns the transaction | [`13-transaction-ownership.ts`](nuances/13-transaction-ownership.ts) | The unit of work rolls back both writes; a committing repository leaves a partial write. |
| 14 | External calls outside the transaction | [`14-external-call-outside-transaction.ts`](nuances/14-external-call-outside-transaction.ts) | The outbox keeps the write and the notification consistent; the inline send survives the rollback. |
| 15 | Idempotency at the port | [`15-idempotency-at-the-port.ts`](nuances/15-idempotency-at-the-port.ts) | The keyed port returns one user; the naive port creates two. |
| 16 | Time and identity are driven ports | [`16-clock-and-id-ports.ts`](nuances/16-clock-and-id-ports.ts) | Fixed ports produce an exact id and instant; ambient time cannot be asserted. |

### D. Mapping

| # | Nuance | File | What the test proves |
| --- | --- | --- | --- |
| 17 | Two-way mapping | [`17-two-way-mapping.ts`](nuances/17-two-way-mapping.ts) | The mapper hides `created_at` and validates; the shared row class does neither. |
| 18 | Mapping loss | [`18-mapping-loss.ts`](nuances/18-mapping-loss.ts) | An explicit mapper round-trips; JSON loses the `Date` and absent fields. |
| 19 | The persistence model must not escape | [`19-persistence-model-leak.ts`](nuances/19-persistence-model-leak.ts) | The mapped object works after close; the entity's lazy field throws. |
| 20 | Map once, at the boundary | [`20-mapper-placement.ts`](nuances/20-mapper-placement.ts) | One mapping keeps the nickname; an intermediate shape drops it. |

### E. Testing

| # | Nuance | File | What the test proves |
| --- | --- | --- | --- |
| 21 | Test the core with fakes | [`21-core-test-with-fakes.ts`](nuances/21-core-test-with-fakes.ts) | The fake test records the call with no I/O; the real adapter performs I/O. |
| 22 | Fake fidelity | [`22-fake-fidelity.ts`](nuances/22-fake-fidelity.ts) | The faithful fake and SQLite both reject the duplicate; the permissive fake accepts it. |
| 23 | Test the adapters in isolation | [`23-adapter-test-in-isolation.ts`](nuances/23-adapter-test-in-isolation.ts) | The controller is tested with a spy; the repository against the real engine. |
| 24 | One contract suite, every provider | [`24-contract-suite.ts`](nuances/24-contract-suite.ts) | Memory and SQLite pass the same six assertions; a permissive adapter fails. |

### F. Enforcement and evolution

| # | Nuance | File | What the test proves |
| --- | --- | --- | --- |
| 25 | The module is the enforcement | [`25-module-enforcement.ts`](nuances/25-module-enforcement.ts) | The real graph passes the allowed edges; the costume graph fails. |
| 26 | One giant hexagon | [`26-one-giant-hexagon.ts`](nuances/26-one-giant-hexagon.ts) | The facade invoices a placed order; the internal class invoices a draft. |
| 27 | Migrating incrementally | [`27-migrating-incrementally.ts`](nuances/27-migrating-incrementally.ts) | The adapter produces one record; the double write produces two. |
| 28 | When to remove a port | [`28-when-to-remove-a-port.ts`](nuances/28-when-to-remove-a-port.ts) | Removing the unused audit port changes no test; the users port stays. |
| 29 | The cost of the module split | [`29-cost-of-module-split.ts`](nuances/29-cost-of-module-split.ts) | Six modules for six classes costs more; at 300 classes the fixed cost is small. |
| 30 | The framework belongs at the edge | [`30-framework-at-the-edge.ts`](nuances/30-framework-at-the-edge.ts) | The plain core runs with a hand-built instance; the coupled core needs the router. |
| 31 | Where the services live | [`31-where-the-services-live.ts`](nuances/31-where-the-services-live.ts) | The aggregate and policy are pure; the application service uses ports; the anemic and coupled versions fail. |

### G. Appendix

| # | Nuance | File | What the test proves |
| --- | --- | --- | --- |
| A | Vocabulary: port, adapter, use case, DTO, mapper | [`appendix-vocabulary.ts`](nuances/appendix-vocabulary.ts) | Value objects compare by value, entities by identity; a DTO has no invariant. |

## What is real and what is modeled

- **Real:** all TypeScript types, `node:test` assertions, and the `node:sqlite` adapters in #22–#24.
- **Modeled:** the transaction manager (#13), the external-call timeline (#14), the persistence session (#19), the module graph (#25), the migration (#27), and the cost arithmetic (#29). These are small deterministic models that make the behavior visible without a database server or a network. The file headers say so.
- **Not production code:** error handling is simplified to `Error` classes; there is no Express/NestJS, ORM, or container. The point is the boundary, not the framework.

## How to use it

1. Read the matching section in [02b — Hexagonal architecture](../02b-hexagonal-architecture.md).
2. Run the one file.
3. Change the anti-pattern to the correct code, or vice versa, and watch the test fail.
4. Add a nuance when a real code review finds a boundary you cannot name.
