# 01d — Outbox implementation

*Reference for building the pattern. Read this after the [outbox core note](01c-outbox-pattern.md).*

The core note answers what the outbox is and when to use it. This note covers how to build it: ownership, table shape, relay mechanics, idempotency, ordering, and operations.

## Ownership

The ownership rule:

> The module that owns the transaction that produces the fact owns the outbox row and the event contract. The relay has delivery authority only.

For Payments:

- `payments.outbox` lives in the Payments schema;
- Payments writes the row in the same transaction as the payment state;
- the Payments-owned relay reads and marks the row;
- Notification consumes the event, never the outbox;
- no other module reads `payments.outbox`.

A producer-owned worker is the clean default:

```text
src/
  modules/
    payments/
      infrastructure/
        outbox-repository.ts
        outbox-relay.ts
      schema.sql
  workers/
    payments-outbox-worker.ts
```

A platform-owned central relay is possible, but it needs:

- table-scoped database permissions;
- no domain-table access;
- no payload rewriting;
- its own on-call and SLO;
- an explicit exception to strict schema ownership.

See the [modular monolith note](01a-modular-monolith.md) for the broader data-ownership model.

## Table shape

A practical outbox table:

```sql
create table payments.outbox (
  id uuid primary key,
  aggregate_id uuid not null,
  event_type text not null,
  event_version int not null default 1,
  payload jsonb not null,
  occurred_at timestamptz not null default now(),
  published_at timestamptz,
  attempts int not null default 0,
  next_attempt_at timestamptz,
  last_error text,
  claimed_at timestamptz,
  claimed_by text
);

create index payments_outbox_pending_idx
  on payments.outbox (next_attempt_at, occurred_at)
  where published_at is null;
```

Why the columns matter:

- `id` — stable event identity for dedupe;
- `aggregate_id` — partition key and ordering;
- `event_type`, `event_version` — event contract;
- `payload` — the event body; keep it small;
- `occurred_at` — when the fact happened, not when it was published;
- `published_at` — null means pending;
- `attempts`, `next_attempt_at`, `last_error` — retry state;
- `claimed_at`, `claimed_by` — lease-based claiming for multiple relay instances.

Keep the table from growing forever:

- archive or delete published rows after a retention window;
- partition by time if volume is high;
- keep enough history for audit and replay;
- do not put large blobs in the payload; use a claim-check reference instead.

## Relay mechanics

A relay does three things:

1. claim a batch of pending rows;
2. publish them;
3. mark them published, or record the failure.

```ts
const batch = await outbox.claimBatch({ limit: 100, leaseMs: 30_000 });

for (const row of batch) {
  try {
    await publisher.publish(row);
    await outbox.markPublished(row.id);
  } catch (error) {
    await outbox.markFailed(row.id, error);
  }
}
```

Rules:

- **Publish, then mark.** If you mark first and the publish fails, the event is lost.
- **Use at-least-once semantics.** If the process crashes after publish and before mark, the event is published again.
- **Claim with `for update skip locked` or a lease.** Do not let two relay instances publish the same row concurrently.
- **Retry with backoff.** Use `attempts`, `next_attempt_at`, and a maximum attempt count.
- **Have a dead-letter path.** A poison message must not block the queue forever.
- **Monitor lag.** The oldest unpublished row is a leading indicator of trouble.
- **Do not hold a database transaction open across a network call if you can avoid it.** Claim in a short transaction, publish outside it, then mark. See [01e — External calls inside a transaction](01e-external-calls-inside-transactions.md).
- **Do not rewrite the payload in the relay.** It is a courier, not a business process.

A relay can publish to:

- an in-process handler now;
- a database-backed queue;
- a broker such as Kafka, SQS, RabbitMQ, or NATS;
- a CDC pipeline.

The transport can change. The event contract should not.

## Idempotency in practice

Duplicate delivery is expected. The consumer must make processing idempotent. See [01g — Idempotency](01g-idempotency.md) for the full treatment.

### Consumer-side inbox

A consumer-owned inbox or dedupe table:

```sql
create table notifications.inbox (
  event_id uuid primary key,
  received_at timestamptz not null default now()
);
```

Before doing the work:

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

For database-only side effects, insert the inbox row and perform the side effect in the same transaction.

For external side effects, it is harder. You cannot atomically send an email and commit a database row. Options:

- use the provider’s idempotency key if it supports one;
- record `notification_log` with a unique `(event_id, channel)` constraint;
- accept a rare duplicate and make the message harmless;
- reconcile.

### Other idempotency techniques

- **Unique constraint** on a natural key or event ID.
- **Conditional update**: `update ... where status = 'PENDING'`.
- **Idempotency key** on an external API call.
- **Upsert** instead of insert.
- **Version number** or optimistic concurrency check.
- **Deduplication window** for messages that are only relevant for a short time.

The key is to make the effect idempotent, not merely to hope the duplicate never happens.

## Ordering

The outbox does not guarantee global ordering. If ordering matters:

- publish with a partition key such as `aggregate_id`;
- include a per-aggregate sequence number or version;
- have the consumer reject stale versions;
- keep a single relay per partition if you need strict order.

For the order system, `PaymentCaptured` and `PaymentRefunded` for the same payment should preserve per-payment order. Use `paymentId` as the partition key and a version or sequence number. Do not assume global order across all payments.

## Monitoring and retention

Monitor at least:

- **Outbox lag** — age of the oldest unpublished row.
- **Publish failures** — retries, dead-letters, and the last error.
- **Consumer lag** — published events not yet processed.
- **Duplicate rate** — dedupe hits; a sudden rise can mean relay problems.
- **Payload size** — outbox bloat is often payload bloat.

Retain published rows long enough for audit and replay. Archive rather than delete immediately if compliance requires it.

## Variants

| Variant | How it works | Trade-off |
| --- | --- | --- |
| **Polling relay** | Worker polls the outbox table | Simple; adds query load |
| **`SKIP LOCKED` relay** | Multiple workers claim rows safely | Better throughput; needs a database that supports it |
| **Lease-based relay** | Rows are claimed with `claimed_at` / `claimed_by` | Works with more databases; needs lease expiry |
| **CDC connector** | Debezium or similar reads the outbox/log | No polling; more operational complexity |
| **Database queue** | Outbox rows are also a queue | Fewer moving parts; database-specific |
| **In-process dispatcher** | Relay calls handlers directly | Simple for a monolith; no broker |

## Payment → Notification walkthrough

```text
1. API handler receives POST /payments/:id/capture.
2. Payments creates or loads the payment in a local transaction.
3. Payments calls the payment provider. This is outside any DB transaction.
4. Payments records CAPTURED and writes PaymentCaptured to the outbox
   in one local transaction.
5. The relay claims the outbox row.
6. The relay publishes PaymentCaptured outside the DB transaction.
7. Notification dedupes by event_id.
8. Notification calls the email provider. This is outside any DB transaction.
9. Notification records the delivery.
```

The important boundaries:

- no external API call inside a database transaction;
- no consumer writes to the producer’s outbox;
- the relay publishes before marking published;
- the consumer owns its inbox or delivery log.

Later, when Notification becomes a separate service, the worker publishes to a broker. Payment does not change. Notification still owns its inbox and delivery log. The outbox stays in the Payments schema.

## Checklist

Before adding an outbox, answer:

- [ ] Is this event a business fact that must not be lost?
- [ ] Is eventual consistency acceptable?
- [ ] Can the outbox row be written in the same local transaction as the state?
- [ ] Who owns the outbox table and the event contract?
- [ ] Who runs the relay, and who is paged when it lags?
- [ ] Is the consumer idempotent?
- [ ] Do we need per-aggregate ordering? If so, what is the partition key?
- [ ] What happens after repeated publish failures?
- [ ] How long do we retain published rows?
- [ ] Is the payload small and free of unnecessary PII?
- [ ] What would make us remove the outbox or change the transport?

## Sources

- Richardson, [*Pattern: Transactional outbox*](https://microservices.io/patterns/data/transactional-outbox.html), microservices.io.
- Richardson, [*Pattern: Idempotent consumer*](https://microservices.io/patterns/communication-style/idempotent-consumer.html), microservices.io.
- [Debezium outbox event router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html).
- [PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED`](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE).
- AWS Prescriptive Guidance, [*Transactional outbox pattern*](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).
- Jovanović, [*Implementing the Transactional Outbox Pattern from Scratch*](https://www.youtube.com/watch?v=RjO2AH8JmV8) (video).
- Kleppmann, *Designing Data-Intensive Applications* (2017), ch. 11, for at-least-once delivery and idempotence.
- Nygard, [*Release It!*](https://pragprog.com/titles/mnee2/release-it-second-edition/), 2nd ed. (2018), for stability and failure handling.

## Next

- [Outbox core note](01c-outbox-pattern.md) — the short mental model and decision rule.
- [Runnable outbox example](01c-outbox-example/main.ts) — where the API calls and transactions are.
- [Modular monolith](01a-modular-monolith.md) — data ownership and module boundaries.
