# Cross-aggregate transactions and rollback

*Separate transactions do not roll back together. If the first aggregate commits and the second fails, you either share one transaction or compensate. There is no third option where independent commits undo each other.*

## The short answer

Rollback is a property of a **transaction**, not a property of a use case.

- If both repository calls are in the **same transaction**, a failure rolls back both.
- If each repository call has its **own transaction**, the first commit is durable. A later failure cannot roll it back.
- If the first aggregate already committed, you do not roll it back. You retry, compensate, or move it to a cancelled state.

The question is therefore not "how do I roll back the first aggregate?" It is:

> **"Should these two writes have been in one transaction at all?"**

If the answer is yes, use one transaction and accept that you are modifying two aggregates together. If the answer is no, stop trying to roll back and design the workflow.

## Who owns the transaction?

This is where most of the confusion starts.

```ts
// Each repository opens and commits its own transaction.
await orderRepository.save(order);         // commits
await inventoryRepository.reserve(order);  // commits separately
```

Those are two transactions. If the second one fails, the order is already durable.

Versus:

```ts
// The application service owns one transaction and passes it down.
await db.transaction(async (tx) => {
  await orderRepository.save(order, tx);
  await inventoryRepository.reserve(order.id, tx);
});
```

Now both writes are in the same transaction. If `reserve` throws, the order insert rolls back too.

But notice what you just did: you modified **two aggregates in one transaction**. That is technically possible, especially in the same database, but it goes against the "one aggregate per transaction" guideline. The order and inventory now share locks, failure modes, and a commit boundary.

A repository should not silently decide this for you. The application service or unit of work owns the transaction; the repositories participate in it. If each repository opens its own transaction, you have separate commits whether you intended it or not.

The same applies to ORMs: if one `SaveChanges` / `flush` commits changes to several aggregates, that is a cross-aggregate transaction, even if the code never says "transaction".

## The three realistic setups

| Setup | Can you roll back the first aggregate? | What you actually get |
| --- | --- | --- |
| Same database, same transaction | Yes | Atomic commit/rollback, but a cross-aggregate transaction |
| Same database, separate transactions | No | Partial state; you must retry or compensate |
| Different services/databases | No | Saga/process manager, outbox, or 2PC |

### Same database, same transaction

The application service starts one transaction, both repositories use it, and there is one commit. If anything fails, the database rolls back everything.

This is the simplest answer when atomicity is genuinely required and both aggregates live in the same database. It is also the option that most directly violates the one-aggregate-per-transaction rule. Use it deliberately, not by accident.

### Same database, separate transactions

The first transaction commits. The second transaction fails. The first aggregate remains. You cannot undo it with a rollback; you need a business-level compensation or a retry.

### Different services/databases

There is no shared local transaction. You need a saga/process manager, an outbox, or a distributed transaction. A saga gives you eventual consistency and compensating actions, not atomicity.

## Foreign keys do not create atomicity

A foreign key from another table to the order root enforces referential integrity. It does not enlist the second write into the first transaction, and it does not make the two writes atomic.

- If the child table is **inside** the aggregate, it is part of the same repository save and the same transaction.
- If the child table is **outside** the aggregate, the FK may still be useful, but the consistency problem is separate.
- Across services, a database FK is usually not even possible; use IDs and events.

The FK answers "does the referenced row exist?" It does not answer "did the whole use case commit?"

## Example: placing an order and reserving stock

### Option A: one local transaction

```ts
await db.transaction(async (tx) => {
  await orderRepository.save(order, tx);
  await inventoryRepository.reserve(order.id, tx);
});
```

If stock reservation fails, the order is rolled back. Clean rollback, but now order and inventory are coupled in one transaction. If they are truly separate aggregates, this is a deliberate exception — and it may be a sign the boundary is wrong.

### Option B: separate transactions with compensation

```ts
await orderRepository.save(order);          // committed as Pending
await inventoryRepository.reserve(order.id); // may fail
```

If reservation fails, the order still exists. You cannot roll it back. You do one of these:

- retry the reservation;
- cancel the order as a business action;
- leave the order in `Pending` and let a process manager decide.

The cleanest version is to make the first aggregate **provisional**:

```text
Order: Pending -> Confirmed   (stock reserved)
Order: Pending -> Cancelled   (stock rejected)
```

Now "rollback" becomes a business state transition, not a database rollback. That works across services and is auditable.

### Option C: outbox plus a saga/process manager

1. **Transaction 1:** create the order as `Pending` and write an `OrderCreated` event to the outbox in the same transaction.
2. A relay publishes the outbox event.
3. **Transaction 2:** inventory reserves stock.
4. On success, publish `StockReserved`; the order becomes `Confirmed`.
5. On failure, publish `StockRejected`; the order becomes `Cancelled`.

If order creation fails, no event is written, so there is nothing to compensate. If publishing fails, the outbox retries. If the consumer sees duplicates, it must be idempotent.

The outbox is not a rollback mechanism. It solves the **dual-write problem** between the database and the broker. It does not make the order and inventory writes atomic. It only guarantees that if the order commits, the event will eventually be published.

## Compensation is not rollback

A database rollback is invisible: the transaction never happened. A compensation is a **new business action**: cancel the order, release the reservation, refund the payment. It can fail, it can be delayed, and it may be visible to users.

Compensation needs:

- idempotency;
- retries;
- a state machine;
- monitoring and reconciliation;
- a defined answer for "what if compensation also fails?"

Order the steps to put irreversible actions last. Sending an email or charging a card is much harder to compensate than cancelling a pending row.

## What about two-phase commit?

Two-phase commit (2PC) can give atomic commit across multiple resources, but it is operationally expensive, can block, and is not supported everywhere. It also does not solve external side effects that cannot participate in the protocol.

For most business workflows, 2PC is not the default answer. It is a sign that either the boundary is wrong or the consistency requirement is stronger than the architecture can comfortably support. A saga is usually the better fit when temporary inconsistency is acceptable; a single local transaction is better when it is not and both aggregates share a database.

## How to choose

Ask two questions:

1. **Must these two changes be true at the same instant?**
   - Yes, same database: use one local transaction, and question whether the aggregate boundary is right.
   - Yes, different services: 2PC or redesign. A saga does not give you atomicity.
   - No: separate aggregates, outbox, events, compensation.

2. **What happens during the gap?**
   - If a pending order or temporary inconsistency is acceptable, separate aggregates are fine.
   - If it is not acceptable, keep the invariant inside one aggregate or one transaction.

## Rules of thumb

- **Rollback is a transaction property; consistency across aggregates is a workflow property.**
- If you find yourself trying to roll back aggregate A because aggregate B failed, stop and ask whether the invariant really spans both.
- If it does, merge the smallest set or use one local transaction deliberately.
- If it does not, stop trying to roll back. Design provisional states, outbox, retries, and compensation.
- The worst outcome is pretending you have atomicity when you actually have two independent commits.

## References

- Vaughn Vernon, [*Effective Aggregate Design Part II: Making Aggregates Work Together*](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_2.pdf) — one aggregate per transaction, reference by identity, and eventual consistency across aggregates.
- Martin Fowler, [*DDD_Aggregate*](https://martinfowler.com/bliki/DDD_Aggregate.html) — aggregates are loaded and saved as a unit; transactions should not cross aggregate boundaries.
- Microsoft Learn, [*Use Tactical DDD to Design Microservices*](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-domain-driven-design) — small aggregates, transactional invariants, and eventual consistency across boundaries.
- Chris Richardson, [*Saga pattern*](https://microservices.io/patterns/data/saga.html) — a sequence of local transactions with compensating actions; not atomicity.
- Chris Richardson, [*Transactional outbox pattern*](https://microservices.io/patterns/data/transactional-outbox.html) — commit the business state and the event in one local transaction, then publish later.
- Microsoft Learn, [*Compensating Transaction pattern*](https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction) — undo work by applying compensating operations when rollback is not possible.
- Hector Garcia-Molina and Kenneth Salem, [*Sagas*](https://dl.acm.org/doi/10.1145/38713.38742) (1987) — the original long-lived transaction paper.
- Martin Fowler, [*Two-Phase Commit*](https://martinfowler.com/articles/patterns-of-distributed-systems/two-phase-commit.html) — the protocol and its costs.

## See also

- [God aggregates and transaction boundaries](god-aggregates-and-transaction-boundaries.md)
- [Aggregate root IDs and foreign keys](aggregate-root-ids-and-foreign-keys.md)
- [Repositories do not live in aggregates](repositories-do-not-live-in-aggregates.md)
- [Outbox pattern](../../architecture/01c-outbox-pattern.md)
- [Outbox implementation](../../architecture/01d-outbox-implementation.md)
