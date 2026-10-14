# Aggregates

*An **aggregate** is a cluster of entities and value objects treated as a single unit for the sake
of consistency, accessed only through its **aggregate root**. The root is the gatekeeper: it
enforces the invariants that must always hold, and it's the unit you load, save, and reference from
the outside.*

Part of the language-agnostic [`fundamentals/`](../) track. Builds on `04-value-objects` and
`05-entities`.

## Definition

An **aggregate** is a boundary around a group of related objects that must stay consistent together.
One object in the cluster is the **aggregate root** — the only object outsiders may hold a reference
to. Everything inside is reached *through* the root.

```ts
class Order {                         // the aggregate root
  private lines: OrderLine[] = [];

  constructor(readonly id: OrderId, private status: OrderStatus = "draft") {}

  addLine(sku: Sku, price: Money, qty: number): void {
    if (this.status !== "draft") throw new Error("cannot modify a submitted order");
    this.lines.push(new OrderLine(sku, price, qty));
    this.assertInvariants();          // root enforces the rules
  }

  submit(): void {
    if (this.lines.length === 0) throw new Error("empty order");
    this.status = "submitted";
  }

  private assertInvariants(): void {
    if (this.lines.length > 100) throw new Error("too many lines");
  }

  get total(): Money {
    return this.lines.reduce((sum, l) => sum.add(l.lineTotal), new Money(0, "USD"));
  }
}

class OrderLine {                     // an entity *inside* the aggregate
  constructor(readonly sku: Sku, readonly price: Money, readonly qty: number) {}
  get lineTotal(): Money { return this.price.multiply(this.qty); }
}
```

`Order` is the root. `OrderLine` has no repository of its own and isn't referenced from elsewhere —
you always go through the `Order`.

## What it's for: a consistency boundary

An aggregate defines the boundary within which **invariants must hold at all times**. The root
guards them; the rest of the system can't reach in and break them.

> **Rule:** change through the root, save through the root, reference other aggregates **by id**.

## Key traits

| Trait | Meaning |
| --- | --- |
| **Root** | the single entry point / only externally referenceable object |
| **Boundary** | the set of objects that must change together consistently |
| **Invariants** | rules the root keeps true (e.g. "an order always has ≥1 line when submitted") |
| **Transactional unit** | you load and persist the whole aggregate in one transaction |
| **Id referencing** | other aggregates are referenced by id, not by object reference |

## Design guidance

- **Keep aggregates small.** Small boundaries mean fewer conflicts, better concurrency, smaller
  loads. Prefer many small aggregates over one giant object graph.
- **One root per aggregate.** Outsiders hold only the root's id.
- **Reference other aggregates by id.** `Order.customerId`, not `Order.customer` — avoids loading
  the whole world and keeps boundaries clean.
- **Enforce invariants in the root.** Rules that span multiple objects inside the aggregate live on
  the root's methods.
- **One repository per aggregate root** (see `08-repositories`) — not one per entity inside it.
- **Don't span aggregates in one invariant.** If a rule needs two aggregates to change atomically,
  that's usually a signal to redesign the boundary (or handle it with eventual consistency / domain
  events, `10-domain-events`).

## Why it matters

- **Consistency without a global lock.** You only need to lock/serialize one small cluster, not the
  whole model, which improves concurrency.
- **Clear transaction scope.** "Load the aggregate, change it, save it" is one atomic unit.
- **Protected invariants.** Because outsiders can't touch internals, illegal states can't be reached
  from outside the root.
- **Simpler persistence.** Repositories deal in aggregates, not in an unbounded web of entities.

## Pitfalls

- **Mega-aggregates.** Pulling everything into one cluster kills concurrency and bloats loads.
- **Reaching past the root.** `order.getLines().add(...)` bypasses the invariant guard — always
  mutate through the root.
- **Object references across aggregates.** `order.customer` (a loaded entity) drags a second
  aggregate into the boundary; use `customerId`.
- **One aggregate per table.** The boundary is about consistency, not how tables are laid out.

## One-line summary

**An aggregate is a consistency boundary: a cluster of entities and value objects whose invariants
are enforced by a single root that is the only way in — small, id-referenced, and loaded/saved as
one transactional unit.**

## References

- Martin Fowler — *DDD_Aggregate* — <https://martinfowler.com/bliki/DDD_Aggregate.html>
- Eric Evans — *Domain-Driven Design* (2003), ch. 6 "The Lifecycle of a Domain Object"
- Related: `05-entities`, `04-value-objects`, `08-repositories`, `10-domain-events`
