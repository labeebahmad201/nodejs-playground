# Design

Notes on modeling and design decisions that sit above the code.

- [Domain-Driven Design](domain-driven-design-ddd/README.md) — domains, subdomains, bounded contexts, aggregates, and the language of the model.
- [Event Storming](event-storming/README.md) — short, focused notes on applying Event Storming: what to capture, what to defer, and how the board turns into boundaries and ownership.
- [Concurrency control](concurrency-control/README.md) — optimistic and pessimistic control, what a transaction guarantees, and concurrency across request boundaries.
  - [01 — Optimistic vs. pessimistic locking — Vlad Mihalcea](concurrency-control/01-vlad-mihalcea-optimistic-vs-pessimistic-locking.md) — the lost-update diagrams, the long-conversation case, and a review of what the article leaves out.
  - [02 — What a transaction guarantees](concurrency-control/02-what-a-transaction-guarantees.md) — a transaction protects the commit, not the rows; locks and isolation are what protect the rows.
  - [03 — Concurrency control across requests](concurrency-control/03-cross-request-concurrency-control.md) — pessimistic control stops at the request boundary; version tokens and leases are what cross it.
  - [04 — SELECT ... FOR UPDATE in PostgreSQL](concurrency-control/04-select-for-update.md) — the lock itself: modes, conflict matrix, deadlocks, `SKIP LOCKED`, and the traps.
