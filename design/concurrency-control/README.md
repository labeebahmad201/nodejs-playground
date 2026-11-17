# Concurrency control

*Notes on controlling concurrent writers: prevention versus detection, what a transaction actually guarantees, and how the mechanism changes once the critical section spans more than one request.*

## Notes

- [01 — Optimistic vs. pessimistic locking (Vlad Mihalcea)](01-vlad-mihalcea-optimistic-vs-pessimistic-locking.md) — the article's lost-update diagrams, the long-conversation case, and a review of what it leaves out.
- [02 — What a transaction guarantees](02-what-a-transaction-guarantees.md) — atomic commit versus row ownership, the three collisions an implicit write lock does and does not cover, and how isolation levels change the answer.
- [03 — Concurrency control across requests](03-cross-request-concurrency-control.md) — why a lock cannot span two HTTP calls, the arithmetic of think time, and version tokens, reservations, and leases.
- [04 — SELECT ... FOR UPDATE in PostgreSQL](04-select-for-update.md) — the lock itself: clauses, conflict matrix, deadlocks, `SKIP LOCKED`, and the traps that make it useless or dangerous.

## Reading order

Start with **01** for the framing and the diagrams, **02** for what a transaction protects and where a lock is needed, and **03** for the case where the critical section crosses a request boundary. **04** is the reference for the lock syntax and behaviour once you know you need one.

## Assets

`img/` holds the four diagrams captured from the Vlad Mihalcea article. They are stored locally so the notes keep rendering if the article moves; attribution is in **01**.
