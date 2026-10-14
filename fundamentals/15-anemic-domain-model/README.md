# Anemic domain model (anemic entities)

*An **anemic domain model** is a model whose objects hold data but no behavior — pure getter/setter
bags — while all the logic lives in separate "service" classes. It looks object-oriented but is
really procedural code wearing objects as structs. It's the most common accidental anti-pattern in
domain modelling.*

Part of the language-agnostic [`fundamentals/`](../) track. The remedy builds on `05-entities`,
`04-value-objects`, and `09-domain-services`.

## Definition

A domain model is **anemic** when:

- its **entities/value objects are data-only** — fields with getters and setters, little or no logic;
- the **rules live elsewhere** — in `XxxService`, `XxxManager`, `XxxHelper` classes; and
- the entities are therefore **always one setter-call away from an invalid state**.

The term was coined by Martin Fowler (2003). "Anemic" = lacking the behavior (the "blood") that
should be in the model.

## What it looks like

```ts
// Anemic: a struct with accessors. No rules; anyone can do anything.
class Order {
  id!: string;
  status!: string;
  lines: OrderLine[] = [];
  total!: number;
}

class OrderService {
  submit(order: Order) {
    if (order.lines.length === 0) throw new Error("empty order"); // rule lives here...
    order.status = "submitted";                                   // ...far from the data
    order.total = order.lines.reduce((s, l) => s + l.price * l.qty, 0);
  }
  addLine(order: Order, line: OrderLine) { /* ...more rules here... */ }
}
```

Nothing stops code from bypassing the rules:

```ts
order.status = "submitted"; // no lines, no total — an invalid state, and the compiler is fine
order.total = -999;         // just data
```

## Why it's a problem

- **Invariants are unenforced.** The data can be in states the business says are impossible. Logic
  validates *some* paths; nothing guards the fields.
- **Behavior is scattered.** The rules for one concept live in services, controllers, and mappers —
  hard to find, easy to duplicate, easy to let diverge.
- **It's procedural in disguise.** You get the indirection of objects without the safety of
  encapsulation — "the worst of both worlds".
- **Knowledge is disconnected from data.** Readers must hunt elsewhere to learn the rules; the entity
  lies about what it guarantees.
- **Testing requires the services** and their collaborators, instead of just the object.

## Rich vs anemic

```ts
// Rich: the entity owns its data *and* its rules.
class Order {
  private lines: OrderLine[] = [];
  private status: OrderStatus = "draft";

  constructor(readonly id: OrderId) {}

  addLine(sku: Sku, price: Money, qty: number): void {
    if (this.status !== "draft") throw new Error("not editable");
    this.lines.push(new OrderLine(sku, price, qty)); // invariants guarded here
  }

  submit(): void {
    if (this.lines.length === 0) throw new Error("empty order");
    this.status = "submitted";
  }

  get total(): Money {
    return this.lines.reduce((s, l) => s.add(l.lineTotal), Money.usd(0)); // derived, not stored
  }
}
```

Now it's **impossible** to construct an invalid `Order` through the public API — the object can't
"leak" a bad state. `OrderService`, if it exists at all, only *coordinates* (load, invoke, save).

| | Anemic | Rich (proper domain model) |
| --- | --- | --- |
| Data & behavior | separated | together |
| Invariants | enforced elsewhere, bypassable | enforced by the object |
| Fields | public / setters | private, mutated by methods |
| Logic location | services/controllers | on the entity/value object |
| Testing | service + collaborators | the object alone |

## How to spot it

- Entities are **mostly getters/setters**; methods just assign.
- Public **setters** on domain objects.
- `UserService`, `AccountManager`, `OrderHelper` classes full of business rules.
- Validation logic duplicated in controllers and services.
- The phrase "the service does the business logic" as a design *goal*.
- Entities that are also ORM models with every field exposed.

## How to fix it

1. **Move behavior onto the objects** that own the data — `order.submit()` instead of
   `orderService.submit(order)`.
2. **Make fields private**; replace setters with **intention-revealing methods**
   (`rename`, `deactivate`, `addLine`).
3. **Enforce invariants in the constructor and methods** so invalid states are unrepresentable.
4. **Derive values** rather than storing them (`total` as a getter) to remove a source of drift.
5. **Keep services thin** — application services orchestrate; **domain services** (`09-domain-services`)
   handle only rules that genuinely span objects; nothing holds an entity's own rules.
6. **Model values** with value objects (`04-value-objects`) so primitives don't wander loose.

## The honest caveat

Fowler himself notes the anemic model is **not always an anti-pattern**. For a simple CRUD app with
little behavior, a **transaction script** — procedural logic in services, data in dumb structs — is a
perfectly reasonable, even preferable, design. The problem is the *hybrid*: an anemic model **plus**
domain-model ceremony, where you pay the cost of a model that gives you none of the safety. Choose
deliberately:

- **Simple app, mostly CRUD** → transaction script is fine; don't pretend to a rich domain.
- **Complex, changing business rules** → put the behavior on the model; keep it rich.

## One-line summary

**An anemic domain model is a fake object model — data bags with getters/setters and all the rules
scattered into service classes — which leaves invariants unenforced and behavior disconnected from
data; fix it by moving behavior onto the entities and value objects (or, for genuinely simple CRUD,
drop the model pretences and use a transaction script).**

## References

- Martin Fowler — *AnemicDomainModel* — <https://martinfowler.com/bliki/AnemicDomainModel.html>
- Martin Fowler — *Transaction Script* (PoEAA) — <https://martinfowler.com/eaaCatalog/transactionScript.html>
- Martin Fowler — *Domain Model* (PoEAA) — <https://martinfowler.com/eaaCatalog/domainModel.html>
- Eric Evans — *Domain-Driven Design* (2003)
- Related: `05-entities`, `04-value-objects`, `09-domain-services`, `13-frameworks-and-business-logic`
