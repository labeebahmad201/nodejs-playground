# God aggregates and transaction boundaries

*An aggregate is not "the related stuff." It is the smallest set of objects that must stay consistent in one transaction. Make it too big and unrelated work competes for the same lock; make it too small and a real invariant falls outside the transaction that must enforce it.*

## The short version

| | Too large — the God aggregate | Right-sized | Too small |
| --- | --- | --- | --- |
| Boundary chosen by | "These things are related" | "These things must be consistent at commit" | "These things are separate concepts" |
| Transaction scope | Wide; unrelated work serializes | One invariant, one transaction | Real invariant spans aggregates |
| Loading | Whole object graph | Only what the use case needs | Multiple aggregates loaded and coordinated |
| Concurrency | High contention on one root | Independent writes | Coordination and eventual consistency |
| Failure mode | Slow, lock-heavy, hard to change | Focused and testable | Invalid intermediate states or sagas for basic rules |

The design question is not **"what is related?"** It is:

> **"What must be true at every commit, and what can be briefly inconsistent?"**

## What an aggregate really is

An aggregate is three things at once:

- a **consistency boundary** — the invariants inside must always hold;
- a **transaction boundary** — one transaction changes one aggregate instance;
- a **unit of load and save** — the repository loads and stores the whole aggregate.

Vaughn Vernon puts the consistency point directly:

> A properly designed Aggregate is one that can be modified in any way required by the business with its invariants completely consistent within a single transaction.

Martin Fowler puts the transaction point directly:

> Transactions should not cross aggregate boundaries.

That combination is why aggregate size matters. The boundary is not free: every object inside it is loaded, locked, versioned, and saved together.

## The God aggregate

A God aggregate is one root that owns too much of the model. It usually starts with a reasonable sentence: "An order has a customer, lines, payment, shipment, and invoice." Then the object graph becomes this:

```ts
class Order {
  customer: Customer;
  lines: OrderLine[];
  payment: Payment;
  shipment: Shipment;
  invoice: Invoice;
  // ...
}
```

Now every order operation loads and locks the customer, payment, shipment, and invoice too. A change to the shipping address contends with a payment retry. A reporting query pulls the whole graph. A schema change to invoices touches the order aggregate. The transaction is wide, and most of the data in it is unrelated to the invariant being protected.

The problem is not that the objects are related. The problem is that **"related" is not the same as "must be consistent in the same transaction."**

### Symptoms

- Loading one root pulls hundreds of rows or several tables.
- Two unrelated use cases conflict on the same version or lock.
- One transaction updates many aggregates' worth of data.
- The root has navigation properties to other aggregate roots.
- Nobody can name the single invariant the aggregate protects.
- Every new feature adds another collection to the same root.
- The repository is huge because the aggregate is huge.

## The other failure: over-splitting

Small is not automatically correct. If you split a true invariant across aggregates, you lose atomic consistency.

For example, if an order total must always equal the sum of its lines, and the total lives in one aggregate while the lines live in another, there is a window where the two disagree. You now need events, retries, reconciliation, and a policy for what happens in the gap.

That may be acceptable for a shipment status. It is usually not acceptable for money or for a rule the business says must never be violated.

Over-splitting shows up as:

- a saga or distributed transaction for a basic invariant;
- events whose only job is to keep two pieces of the same rule in sync;
- repeated cross-aggregate validation before every write;
- domain experts saying "those two must never disagree";
- eventual consistency gaps the business cannot tolerate.

The fix is not "make everything one aggregate." It is to find the **smallest boundary that still contains the invariant**.

## The test: true invariant plus one transaction

Before adding something to an aggregate, ask:

1. **What invariant does this protect?** Name it in business language.
2. **Must it hold at every commit?** Or can it be briefly inconsistent?
3. **Must these two changes be atomic?** If one succeeds and the other fails, is the business broken?
4. **Do they have independent lifecycles?** Can one exist or change without the other?
5. **Are they deleted together?** If deleting the root must delete the part, that is a clue they belong together.
6. **Is it only convenient to load them together?** That is a read-model concern, not an aggregate boundary.

If the answer to "must be atomic" is no, the data belongs outside the aggregate. If the answer is yes, it belongs inside — or the boundary is wrong.

## Example: a right-sized Order

Keep the order lines inside the order because the total rule must hold atomically:

```ts
class Order {
  constructor(
    readonly id: OrderId,
    readonly customerId: CustomerId,
    private lines: OrderLine[],
    private status: OrderStatus,
    private readonly maxTotal: number,
  ) {}

  addLine(line: OrderLine): void {
    if (this.status !== "draft") throw new Error("order is not editable");
    this.lines.push(line);
    this.assertTotal();
  }

  private assertTotal(): void {
    const total = this.lines.reduce((sum, line) => sum + line.total, 0);
    if (total > this.maxTotal) throw new Error("order total exceeded");
  }
}
```

Keep the other concepts outside, referenced by ID:

```ts
class Payment {
  constructor(
    readonly id: PaymentId,
    readonly orderId: OrderId,
  ) {}
}

class Shipment {
  constructor(
    readonly id: ShipmentId,
    readonly orderId: OrderId,
  ) {}
}

class Invoice {
  constructor(
    readonly id: InvoiceId,
    readonly orderId: OrderId,
  ) {}
}
```

The order does not hold `Customer`, `Payment`, `Shipment`, or `Invoice` objects. It holds `customerId`; the other aggregates hold `orderId`. The order lines stay inside because the total rule needs them in the same transaction.

The shipping address is a useful nuance: if the order must preserve the address **as it was at order time**, that is a value object snapshot inside `Order`. It is not a live reference to the customer profile. The customer can change their address later without changing historical orders.

## What belongs inside, and what belongs outside

For an e-commerce order:

| Concept | Must be consistent with `Order` in the same transaction? | Where it belongs |
| --- | --- | --- |
| Order lines and total | Yes — the total must match the lines | Inside `Order` |
| Order status transitions | Yes — status rules are invariants | Inside `Order` |
| Shipping address snapshot | Yes, if the order must preserve the address at order time | Value object inside `Order` |
| Customer profile | No — the name or address can change independently | Separate `Customer` aggregate |
| Product catalog | No — product details are reference data | Separate `Product` aggregate |
| Inventory count | No — inventory changes independently | Separate `Inventory` aggregate |
| Payment | No — payment is processed asynchronously | Separate `Payment` aggregate |
| Shipment | No — shipment has its own lifecycle | Separate `Shipment` aggregate |
| Invoice | No — invoice is its own document with its own lines | Separate `Invoice` aggregate |

The table is not universal. If the business truly requires payment and order to commit together, that is a different invariant and may justify a different boundary. The point is to make the decision from the rule, not from the object graph.

## How to shrink a God aggregate

1. **List the true invariants.** Write them as business rules, not class names.
2. **Find the smallest set that protects each rule.** Start with the root and add only what the rule needs.
3. **Move independent concepts out.** Customer, product, inventory, payment, shipment, and invoice usually become their own aggregates.
4. **Replace object references with IDs.** `customerId`, `orderId`, not `customer`, `order`.
5. **Use domain events or a process manager for cross-aggregate workflows.** One aggregate commits; the next reacts.
6. **Use a read model for screens and reports.** If a view needs the whole graph, project it; do not force the write model to be the read model.
7. **Merge only under proof.** If a real invariant spans two candidate aggregates, either they are one aggregate, the boundary is wrong, or the rule can be eventual.

## How to fix over-splitting

1. **Find the rule that keeps breaking.** If two aggregates must agree immediately, they probably belong together.
2. **Merge the smallest set.** Do not merge the whole domain; merge only what the invariant needs.
3. **Move the invariant to one root.** The root should be able to say "no" without loading the world.
4. **If the rule truly spans aggregates, design the gap.** Use events, reconciliation, and idempotency. Make the temporary inconsistency explicit.
5. **Do not use a distributed transaction as a default.** It is usually a sign that the boundary is wrong or the consistency requirement is not truly immediate.

## One aggregate per transaction

Vernon's rule of thumb is that a properly designed bounded context modifies **one aggregate instance per transaction**. It is a rule of thumb, not a law of physics, but it is a strong default because it keeps locks small and failures local.

If a use case forces you to modify two aggregates atomically, there are three possibilities:

- they are really one aggregate;
- the boundary is wrong;
- the second change should be eventually consistent.

Pick deliberately. Do not drift into a two-aggregate transaction because it was convenient.

## Summary

- An aggregate is a consistency boundary, not a bag of related objects.
- A God aggregate makes unrelated work share one transaction, one lock, and one load.
- Over-splitting moves a real invariant outside the transaction that must enforce it.
- Keep only the data that must be consistent at commit.
- Reference other aggregates by ID; use events and read models for the rest.
- Start small and grow only when a true invariant forces it.

## References

- Vaughn Vernon, [*Effective Aggregate Design Part I: Modeling a Single Aggregate*](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf) — true invariants, small aggregates, one aggregate per transaction.
- Vaughn Vernon, [*Effective Aggregate Design Part II: Making Aggregates Work Together*](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_2.pdf) — reference other aggregates by identity; eventual consistency outside the boundary.
- Microsoft Learn, [*Use Tactical DDD to Design Microservices*](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-domain-driven-design) — "Design small aggregates. Include only the data that must remain consistent within a single transaction."
- Martin Fowler, [*DDD_Aggregate*](https://martinfowler.com/bliki/DDD_Aggregate.html) — aggregates are loaded and saved as a unit; transactions should not cross aggregate boundaries.
- Eric Evans, *Domain-Driven Design* (2003), chapter 6, "The Lifecycle of a Domain Object."

## See also

- [Aggregate root IDs and foreign keys](aggregate-root-ids-and-foreign-keys.md)
- [Repositories do not live in aggregates](repositories-do-not-live-in-aggregates.md)
- [Aggregates](../../fundamentals/07-aggregates/README.md)
- [What actually fails in a layered CRUD app](what-fails-in-a-layered-crud-app.md)
