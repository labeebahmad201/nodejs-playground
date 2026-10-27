# 01g — Idempotency

*An operation is idempotent when applying it more than once has the same effect as applying it once. In a system that retries, idempotency is not an optimization; it is part of correctness.*

Idempotency is a property of an operation. The patterns that implement it — idempotency keys, unique constraints, inboxes, conditional updates — are design-level patterns with architectural consequences.

The running example is the order system. The concrete case is a payment capture or an event consumer that may see the same request twice.

## Why it matters here

At-least-once delivery is the practical default. The outbox relay can publish an event, crash before marking it published, and publish it again. A broker can redeliver. A consumer can process an event and crash before acknowledging it. A client can time out and retry a request that actually succeeded.

That means duplicates are normal:

```text
publish -> crash before mark -> publish again
deliver -> consumer crashes before ack -> deliver again
request -> timeout -> client retries -> same request twice
```

The goal is not to prevent every duplicate. The goal is to make the effect of a duplicate harmless.

> Duplicate delivery is expected. Duplicate processing is the bug.

## What idempotency is not

- **Not at-most-once delivery.** That is a delivery guarantee; idempotency is about the effect.
- **Not exactly-once delivery.** End-to-end exactly-once delivery is not realistic. At-least-once plus idempotent processing gives effectively-once behavior.
- **Not the same as deduplication.** Deduplication is one mechanism; idempotency is the property you want.
- **Not the same as an idempotent HTTP method.** `GET`, `PUT`, and `DELETE` are defined as idempotent in HTTP semantics. Your `POST` handler still needs to be made idempotent if it can be retried.
- **Not “the operation always succeeds.”** A repeated request can return the original result, a conflict, or a no-op. What matters is that it does not repeat the side effect.

## Three places it shows up

| Layer | Example | What idempotency means |
| --- | --- | --- |
| **HTTP request** | `POST /payments/{id}/capture` | The same request key does not capture twice |
| **Command handler** | `capturePayment(paymentId)` | Calling it twice leaves one capture |
| **Event consumer** | `PaymentCaptured` delivered twice | One receipt, one report row, one inventory effect |

These are different mechanisms, but the same question:

> If this runs twice, what happens?

## The main patterns

| Pattern | How it works | Use when |
| --- | --- | --- |
| **Idempotency key** | Client sends a stable key; server stores key, request hash, status, and result | An HTTP or command API can be retried |
| **Unique constraint** | A natural or event key is unique in the database; duplicate insert is rejected or ignored | You can name the business identity of the operation |
| **Upsert** | Insert or update by natural key | The same logical row can be written repeatedly |
| **Conditional update** | `update ... where status = 'PENDING'` | A state transition must happen only once |
| **State machine** | Only valid transitions are allowed; repeated commands become no-ops or conflicts | The operation changes a lifecycle state |
| **Consumer inbox / dedupe table** | Store processed event IDs; skip duplicates | A consumer receives at-least-once events |
| **Version / optimistic concurrency** | Reject stale writes with an expected version | Concurrent updates must not overwrite each other |
| **Outbox event ID** | The event has a stable ID; the consumer dedupes on it | Reliable publication plus duplicate delivery |

### Idempotency key

A typical table:

```sql
create table idempotency_keys (
  key text primary key,
  request_hash text not null,
  status text not null,
  response jsonb,
  created_at timestamptz not null default now()
);
```

The flow:

```text
1. Read the key.
2. If it exists with a different request hash, reject the request.
3. If it exists with a completed result, return the same result.
4. If it does not exist, insert it as IN_PROGRESS.
5. Do the work.
6. Store the result and mark COMPLETED in the same transaction as the result.
```

If step 5 calls an external provider, pass the same key to the provider. The provider’s idempotency and your local result cannot be committed atomically; use the provider’s key plus reconciliation. The local idempotency table prevents duplicate *requests*; the provider key prevents duplicate *charges*.

The key must be **stable across retries**. A key generated inside the handler on every attempt is useless. The client should generate it once per logical operation and reuse it on retry.

Key design matters:

- scope it to the operation and the user or account;
- store a hash of the request to catch key reuse with a different payload;
- store the response so a retry returns the same answer;
- define what “in progress” means: return `409 Conflict` or `202 Accepted`, not a second execution;
- expire keys eventually, but keep them longer than the retry window.

### Conditional update and state machine

For the payment capture:

```sql
update payments
   set status = 'CAPTURED'
 where id = $1
   and status = 'PENDING';
```

If `changes = 0`, the payment is already captured, already failed, or missing. Read the current state and return the appropriate result. Do not increment a balance or call the provider again.

A state machine makes the semantics explicit:

```text
PENDING -> CAPTURED
PENDING -> FAILED
CAPTURED -> REFUNDED
```

A repeated `capture` on `CAPTURED` is a no-op or returns the original result. A `capture` on `REFUNDED` is a conflict. The same operation has different outcomes depending on state, and that is fine. Idempotency means the *side effect* is not repeated.

### Consumer inbox

```sql
create table notifications.inbox (
  event_id uuid primary key,
  received_at timestamptz not null default now()
);
```

```ts
const inserted = await db.query(
  `insert into notifications.inbox (event_id)
   values ($1)
   on conflict (event_id) do nothing
   returning event_id`,
  [event.id],
);

if (inserted.rowCount === 0) {
  return; // already processed
}
```

For database-only side effects, insert the inbox row and perform the side effect in the same transaction. For external side effects, you need more care.

### External side effects

You cannot atomically send an email and commit a database row. You cannot make an email unsend itself. Options:

- use the provider’s idempotency key if it supports one;
- record a notification log with a unique `(event_id, channel)` constraint;
- accept a rare duplicate and make the message harmless;
- reconcile.

For payments, use the payment provider’s idempotency key. For email, a dedupe log plus a provider idempotency key is the best practical answer. “Exactly once” is not available end-to-end; **effectively once** is.

## Payment → Notification example

```text
Payment API:
  idempotency key = paymentId
  state = PENDING -> CAPTURED
  outbox event = PaymentCaptured (stable eventId)

Relay:
  publishes PaymentCaptured at least once

Notification consumer:
  insert eventId into inbox
  if duplicate, return
  send receipt with idempotencyKey = eventId
  record delivery
```

Two different keys, two different jobs:

- `paymentId` protects the **capture** operation from a duplicate request.
- `eventId` protects the **notification** from a duplicate event.

Do not reuse one key for both unless the identity is genuinely the same.

## Race conditions and crash windows

Idempotency is mostly about the windows between steps:

| Window | What can happen | Fix |
| --- | --- | --- |
| Two requests with the same key arrive together | Both check, both see nothing, both execute | Unique constraint; one wins, the other reads the result or waits |
| Side effect succeeds, result write fails | Retry repeats the side effect | Provider idempotency key; reconciliation; accept rare duplicate |
| Result write succeeds, response is lost | Client retries | Return the stored result; do not execute again |
| Event processed, ack fails | Redelivery | Inbox/dedupe key |
| Key expires too early | Retry looks like a new request | Retention longer than the retry window |
| Same key, different payload | A bug or an attack | Store and compare request hash; reject mismatch |

A check-then-act sequence without a unique constraint is not idempotency. It is a race.

## When to use it

Make an operation idempotent when:

- it can be retried by a client, gateway, or queue;
- it consumes at-least-once events;
- it calls an external provider that can time out;
- it can be double-submitted: double-click, refresh, mobile retry;
- it changes money, inventory, entitlements, or notifications;
- a crash between the side effect and the record would create ambiguity.

In the order system: capture payment, reserve inventory, create order, send receipt, update reporting.

## When not to bother

- Pure reads. `GET` is already safe and idempotent.
- Metrics, cache warmups, and other side effects where a duplicate is genuinely harmless.
- Cases where the dedupe state would cost more than the duplicate.

“Harmless” must be a real property, not an assumption. A duplicate analytics event is usually harmless. A duplicate charge is not.

## Testing checklist

- [ ] Send the same request twice; assert one side effect and the same response.
- [ ] Send the same key with a different payload; assert a conflict.
- [ ] Send concurrent duplicates; assert one winner and no double side effect.
- [ ] Crash after the side effect but before recording it; assert recovery is safe.
- [ ] Deliver the same event twice; assert one effect.
- [ ] Retry after a timeout; assert the provider does not double-charge.
- [ ] Expire a key; assert the documented behavior.
- [ ] Check that the key is stable across retries.
- [ ] Check that the key is scoped to the right user or account.
- [ ] Check that the dedupe store survives a restart and works across instances.

## Trade-off matrix row

| Style or decision | Optimizes | Costs | Use when | Avoid when | Failure mode |
| --- | --- | --- | --- | --- | --- |
| **Idempotency keys / idempotent consumer** | Safe retries; duplicate tolerance; crash recovery; at-least-once handling; external-call safety | Dedupe state; unique constraints; key design; retention; extra writes; provider support | Any retryable command, event consumer, or external side effect | Pure reads; duplicates that are genuinely harmless | Duplicate charges or emails; key collision or reuse; check-then-act race; lost dedupe state; side effect before the record |

This row is also collected in the [consolidated trade-off matrix](tradeoffs.md).

## Sources

- [RFC 9110: HTTP Semantics — idempotent methods](https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods).
- [IETF draft: The Idempotency-Key HTTP Header Field](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/).
- Richardson, [*Pattern: Idempotent consumer*](https://microservices.io/patterns/communication-style/idempotent-consumer.html), microservices.io.
- [Stripe: Idempotent requests](https://docs.stripe.com/api/idempotent_requests).
- [PostgreSQL: `INSERT ... ON CONFLICT`](https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT).
- [AWS Builders’ Library: Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/).
- Kleppmann, *Designing Data-Intensive Applications* (2017), ch. 11, for at-least-once delivery and idempotence.
- [Outbox pattern](01c-outbox-pattern.md) — why duplicates happen.
- [Outbox implementation](01d-outbox-implementation.md) — relay and consumer mechanics.

## Next

- [Outbox pattern](01c-outbox-pattern.md) — reliable publication and at-least-once delivery.
- [Outbox implementation](01d-outbox-implementation.md) — the consumer-side inbox and relay.
- [External calls inside a transaction](01e-external-calls-inside-transactions.md) — the anti-pattern that makes idempotency harder.
- [Trade-offs](tradeoffs.md) — the consolidated matrix.
