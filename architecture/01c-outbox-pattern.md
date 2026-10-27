# 01c — Outbox pattern

> **Mental model:** commit the business state and an outbox row in the same local transaction; publish the event later; assume duplicates; make consumers idempotent.

The outbox is a design-level pattern with architectural consequences. It is not an architecture style. It explains how a module reliably communicates, not how the whole system is deployed.

## The one-line answer

If the business state and the event must both exist, write both to the same database in one transaction, then publish the event later.

## Why

A use case often wants to do two things:

1. commit the business state;
2. tell the rest of the system that it changed.

Those are two writes to two systems. Without a shared transaction, one can succeed while the other fails.

For `PaymentCaptured`:

| Failure | Result |
| --- | --- |
| Payment commits, then the process crashes before publishing | Customer paid; no receipt, no reporting event, no reconciliation signal |
| Payment commits, then the broker is down | The event is lost unless something retries it |
| Event is published, then the payment transaction rolls back | A downstream action for a payment that never existed |
| Synchronous notification call fails after payment commits | Payment is already done; you cannot cleanly “fail the whole thing” |

This is the **dual-write problem**. The outbox fixes it by making the event record a database write in the same local transaction as the business state:

```text
begin transaction
  write payment state
  write outbox row: PaymentCaptured
commit

later: relay publishes PaymentCaptured
```

## What it guarantees

- **Local atomicity** — business state and outbox row commit or roll back together.
- **Durability** — if the transaction commits, the event record survives a crash.
- **At-least-once publication** — a running relay retries until the event is published, or moves it to a dead-letter path.
- **Decoupling** — the producer does not need the consumer to be available at commit time.
- **Audit and replay** — the outbox records what was intended to be published.
- **An extraction seam** — the relay can publish in-process now and to a broker later without changing the producer.

## What it does not guarantee

- **Exactly-once delivery** — duplicates are normal.
- **Ordering by default** — retries, partitions, or multiple relays can reorder events.
- **Consumer success** — the producer only records the event.
- **Business atomicity across modules** — Payment and Notification are not one transaction.
- **Immediate delivery** — there is lag.
- **Schema compatibility** — event contracts still need versioning.
- **Atomicity with external providers** — an email or payment provider is not in your database transaction.

The most important sentence:

> The outbox makes the **business state and the event record** atomic. It does not make the **producer and consumer** atomic.

## At-least-once means duplicates are normal

If the relay retries, duplicates are expected. Idempotency is not optional.

Duplicate delivery is expected. **Duplicate processing is the bug.**

The consumer must make processing idempotent:

> Applying the same event more than once has the same effect as applying it once.

Common ways to do that:

- a unique constraint on `event_id`;
- a consumer-side inbox table;
- an idempotency key on an external API call;
- a conditional update such as `update ... where status = 'PENDING'`;
- a version number or optimistic concurrency check.

The practical target is **at-least-once delivery plus idempotent processing**. End-to-end exactly-once delivery is not realistic. See [01g — Idempotency](01g-idempotency.md).

## When to use it

Use an outbox when:

- the event is a business fact that must survive a crash;
- the side effect must not fail the primary operation;
- you need reliable integration between modules or services;
- you need audit, replay, or reconciliation;
- eventual consistency is acceptable;
- you want to decouple producer availability from consumer availability;
- you are crossing a process or network boundary.

Good order-system examples:

- `OrderPlaced` → Inventory reservation and Notifications;
- `PaymentCaptured` → receipt, reporting, reconciliation;
- `OrderCancelled` → release inventory, notify customer.

Use it for integration events, not every internal domain event. An in-process domain event that nobody needs to survive a crash does not need an outbox.

## When not to use it

Do not use an outbox for:

- a query where the caller needs the answer now;
- a command whose failure should fail the caller and belongs in the same consistency boundary;
- a truly best-effort side effect where occasional loss is acceptable;
- a simple in-process notification where durability does not matter;
- a huge event payload; use a claim check instead;
- a multi-step business process needing compensation; use a saga;
- a requirement for end-to-end exactly-once delivery; use idempotency instead.

## Cost

The outbox is not free. It adds:

- a table and migration;
- a relay process or worker;
- retries, backoff, and dead-letter handling;
- idempotent consumers;
- monitoring and alerting;
- retention and cleanup;
- eventual consistency in the UX;
- event schema versioning;
- an owner for the relay.

The cost is usually worth it when the event matters. It is overkill for a best-effort cache warmup.

## In the order system

```text
Payment transaction:
  write payment
  write outbox: PaymentCaptured

payments-outbox-worker:
  claim PaymentCaptured
  publish
  mark published

Notification:
  dedupe by event_id
  send receipt
```

The outbox lives in the Payments schema. Notification consumes the event, never the outbox. The relay is a courier, not an owner.

## Trade-off matrix row

| Style or decision | Optimizes | Costs | Use when | Avoid when | Failure mode |
| --- | --- | --- | --- | --- | --- |
| **Transactional outbox** | Reliable publication; local atomicity of state and event; failure isolation; audit/replay; extraction seam | Extra table and relay; eventual consistency; duplicate handling; monitoring; cleanup | Events must survive crashes; side effects must not fail the primary operation; you need reliable integration | Best-effort side effects; immediate queries; same-boundary commands; huge payloads; no idempotent consumer | Relay lag; outbox bloat; duplicate processing; marking published too early; missing idempotency; poison messages |

This row is also collected in the [consolidated trade-off matrix](tradeoffs.md).

## Related

- [01d — Outbox implementation](01d-outbox-implementation.md) — table schema, relay mechanics, ownership, ordering, monitoring, and the full Payment → Notification walkthrough.
- [Runnable outbox example](01c-outbox-example/main.ts) — the transaction boundaries in code.
- [01e — External calls inside a transaction](01e-external-calls-inside-transactions.md) — the anti-pattern this pattern helps avoid.
- [01g — Idempotency](01g-idempotency.md) — why at-least-once delivery makes idempotent consumers mandatory.

## Sources

- Richardson, [*Pattern: Transactional outbox*](https://microservices.io/patterns/data/transactional-outbox.html), microservices.io.
- Richardson, [*Pattern: Idempotent consumer*](https://microservices.io/patterns/communication-style/idempotent-consumer.html), microservices.io.
- Kleppmann, *Designing Data-Intensive Applications* (2017), ch. 11, for at-least-once delivery and idempotence.
- Jovanović, [*Implementing the Transactional Outbox Pattern from Scratch*](https://www.youtube.com/watch?v=RjO2AH8JmV8) (video).

## Next

- [01d — Outbox implementation](01d-outbox-implementation.md) — the build details.
- [01a — Modular monolith](01a-modular-monolith.md) — data ownership and module boundaries.
- [Roadmap](../roadmap.md) — Day 5 for events, Day 6 for resilience.
