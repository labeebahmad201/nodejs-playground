# 01e — External calls inside a transaction

*An anti-pattern: holding a database transaction open while waiting on HTTP, email, a broker, a cache, or any other I/O the database cannot roll back.*

The rule is simple:

> **If the database cannot roll it back, it does not belong inside the transaction.**

This is not mainly a performance rule. It is a correctness rule. An external call inside a transaction gives you the *appearance* of atomicity without the guarantee.

## What it looks like

```ts
await db.transaction(async (tx) => {
  await tx.updatePayment(paymentId, { status: "CAPTURED" });

  // BAD: the database cannot roll this back.
  const result = await paymentProvider.capture({
    idempotencyKey: paymentId,
    amount,
  });

  await tx.insertOutbox({
    type: "PaymentCaptured",
    paymentId,
    providerReference: result.providerReference,
  });
});
```

The transaction may be open for 5 ms of database work and 500 ms of provider latency. The database sees a 505 ms transaction. The connection, locks, and snapshots are held for the whole time.

## Why it is tempting

- It looks atomic: “if the provider call fails, the transaction rolls back.”
- It keeps the code in one place.
- It avoids designing a state machine.
- It feels safe because the happy path works in development.
- It seems to reduce the number of steps.

The problem is that the rollback only covers the database. It does not cover the provider call.

## What goes wrong

### 1. False atomicity

If the provider call succeeds and the database commit fails, the customer may be charged while your local state says otherwise.

If the provider call times out, you do not know whether it succeeded. The database rollback does not answer that question.

If the provider call fails after the database write, the rollback undoes the local write but cannot undo a charge that actually happened.

You still need idempotency and reconciliation. The long transaction did not remove that work; it only made the failure window harder to see.

### 2. Locks and connections are held longer

A database transaction holds resources for its whole duration. Holding it across a network call means:

- row locks or predicate locks are held longer;
- the connection is checked out longer;
- the transaction snapshot lives longer;
- other transactions may wait;
- the connection pool can be exhausted by slow external calls.

The transaction duration is now the external call’s latency, including its p99. One slow provider can stall unrelated requests.

### 3. Throughput drops

If a connection is held for 500 ms instead of 5 ms, each connection serves far fewer requests per second. A small pool can saturate quickly, and unrelated endpoints that need the same pool start timing out.

### 4. Timeouts create ambiguity

The database may abort the transaction while the external call is still running. The provider may still complete. Now your local state and the external state disagree, and you have no durable record of the intent.

### 5. Retries can duplicate side effects

If the transaction is retried, the external call may run again. Without an idempotency key, that can mean a double charge, duplicate email, or duplicate shipment.

### 6. Deadlocks and lock waits get worse

Long transactions increase the window for lock conflicts. A transaction that should have been a few milliseconds can become a contention point for unrelated work.

### 7. Cascading failure

When one provider slows down, transactions pile up, connections run out, and other endpoints fail. The external provider’s outage becomes your database outage.

### 8. Observability gets muddy

Transaction duration now includes external latency. It is harder to tell whether the database is slow or the provider is slow. Traces show an external span inside a database transaction, which is the signature of this anti-pattern.

## The correct shape

Persist intent first, make the external call outside the transaction, then record the result and the event in a new local transaction.

```ts
// 1. Local transaction: persist the intent.
await db.transaction(async (tx) => {
  await tx.insertPayment({ id: paymentId, status: "PENDING", amount });
});

// 2. External call: no database transaction is open.
const result = await paymentProvider.capture({
  idempotencyKey: paymentId,
  amount,
});

// 3. Local transaction: record the result and the outbox event.
await db.transaction(async (tx) => {
  await tx.markCaptured(paymentId, result.providerReference);
  await tx.insertOutbox({
    type: "PaymentCaptured",
    paymentId,
    amount,
  });
});
```

The state machine is the correctness mechanism:

```text
PENDING -> provider call -> CAPTURED
   |                         |
   +---- provider failure ---> FAILED
   +---- crash/retry --------> reconcile with the idempotency key
```

If the process crashes after the provider succeeds but before step 3, the payment stays `PENDING`. A retry uses the same idempotency key, asks the provider what happened, and completes or fails the local state. That is a deliberate recovery path, not a rollback fantasy.

## What the outbox does and does not solve

The outbox solves **event publication**:

- payment state and the event record commit together;
- a relay publishes later;
- Notification can fail without failing payment.

The outbox does **not** solve the external provider call:

- the provider is not in your database transaction;
- a successful charge is not rolled back by a database rollback;
- a timeout still creates ambiguity.

For external providers, use:

- an idempotency key;
- a durable state (`PENDING` before the call);
- reconciliation for stuck or ambiguous states;
- compensation or refund when the business state cannot be completed.

See [01g — Idempotency](01g-idempotency.md) for keys, dedupe, and retry-safe command design.

For events, use the [outbox pattern](01c-outbox-pattern.md).

## What about a read-only external call?

Still prefer to do it outside the transaction.

A read-only external call cannot create a side effect, but it still holds a connection and extends the transaction. Do the read first, then open the transaction to use the result. If the data can change between the read and the write, decide explicitly whether staleness is acceptable or re-check inside the transaction using local data.

## How to detect it

In code review:

- search for `fetch`, `axios`, `stripe`, `sendEmail`, `publish`, `cache.get`, or any `await` on an external client inside `db.transaction`;
- look for transactions that call another module or service;
- look for transaction blocks that contain logging, file I/O, or sleeps.

In production:

- transaction duration p99;
- connection pool wait time;
- lock wait time;
- database timeout rate;
- traces where an external span is nested inside a database transaction;
- `idle in transaction` sessions.

A useful review question:

> What in this transaction can the database roll back?

If the answer is “not all of it,” the transaction is too large.

## When is it acceptable?

Almost never for network I/O. The exceptions are narrow:

- the call is local, in-process, and does no network or disk I/O;
- the work is bounded and cannot block;
- you can prove the latency;
- there is no external side effect.

Even then, keep the transaction short. A transaction is a database consistency boundary, not a general-purpose critical section.

Two-phase commit is not the usual escape hatch. Most HTTP APIs and cloud providers do not participate in XA, and 2PC has its own operational costs. The practical answer is a state machine, idempotency, reconciliation, and compensation.

## Checklist

- [ ] Does the transaction contain any network call?
- [ ] Does it contain any email, broker, cache, file, or third-party API call?
- [ ] If the external call succeeds and the commit fails, what happens?
- [ ] If the external call times out, how do we find out what happened?
- [ ] Is there an idempotency key?
- [ ] Is there a durable state before the call?
- [ ] Is there a reconciliation path?
- [ ] Is the transaction duration dominated by database work or by external latency?
- [ ] Does a slow provider exhaust the connection pool?
- [ ] Are we relying on a rollback that cannot cover the external effect?

## Anti-pattern summary

| Anti-pattern | What it seems to optimize | Costs | Use when | Avoid when | Failure mode |
| --- | --- | --- | --- | --- | --- |
| **External call inside a transaction** | Short-term code simplicity; the illusion of atomicity | Long-held locks and connections; pool exhaustion; timeouts; duplicate side effects; false atomicity; cascading failure | Almost never for network I/O | Any external HTTP, email, broker, cache, file, or third-party call | Provider succeeds but DB rolls back; DB commits but provider fails; pool saturation; retries duplicate the side effect; ambiguous state |

## Sources

- [PostgreSQL: `idle_in_transaction_session_timeout`](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-IDLE-IN-TRANSACTION-SESSION-TIMEOUT) — why idle transactions are dangerous.
- [HikariCP: About Pool Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing) — connection pool behavior under long checkouts.
- [AWS Builders’ Library: Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) — retry and timeout failure modes.
- [Stripe: Idempotent requests](https://docs.stripe.com/api/idempotent_requests) — idempotency keys for external effects.
- Nygard, [*Release It!*](https://pragprog.com/titles/mnee2/release-it-second-edition/), 2nd ed. (2018) — cascading failure and stability patterns.
- Richardson, [*Pattern: Transactional outbox*](https://microservices.io/patterns/data/transactional-outbox.html) — reliable event publication.
- Kleppmann, *Designing Data-Intensive Applications* (2017), ch. 11 — at-least-once delivery and idempotence.

## Next

- [01c — Outbox pattern](01c-outbox-pattern.md) — the reliable event publication pattern.
- [01d — Outbox implementation](01d-outbox-implementation.md) — relay, idempotency, and ownership.
- [Runnable outbox example](01c-outbox-example/main.ts) — see the transaction boundaries in code.
- [Trade-offs](tradeoffs.md) — the consolidated matrix.
