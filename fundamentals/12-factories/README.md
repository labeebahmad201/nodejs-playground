# Factories

*A **factory** encapsulates object creation when building an object is more than a simple
constructor call — when it must enforce invariants, choose an implementation, or assemble several
objects. It's the "how do I make one?" boundary, kept out of the code that just wants to **use**
one.*

Part of the language-agnostic [`fundamentals/`](../) track. Complements `04-value-objects`,
`05-entities`, and `07-aggregates`.

## The problem it solves

`new Order(...)` is fine until creation gets non-trivial:

- The object must satisfy **invariants** before it exists (rehydrating from the DB vs creating
  fresh).
- The constructor would need to **choose an implementation** (`new PostgresRepo` vs `new MongoRepo`).
- Building one object requires **several steps** or **assembling** a cluster (an aggregate).
- The caller doesn't need to know the **concrete type** at all.

A factory moves that complexity to one named place.

```ts
class OrderFactory {
  createNew(customerId: CustomerId, now: Date): Order {
    const order = Order.draft(new OrderId(crypto.randomUUID()), customerId, now);
    return order;                        // draft invariants enforced by Order itself
  }

  reconstitute(id: OrderId, rows: OrderRow[]): Order {
    // rebuilding from storage is a *different* path than creating new
    return Order.fromPersistence(id, rows);
  }
}
```

The point: creation has **two distinct meanings** — making something *new* and rebuilding something
*existing* — and a factory keeps them explicit instead of overloading one constructor.

## Where it's worth it

- **Complex construction** — many steps, several collaborators, validation that spans objects.
- **Invariant-safe creation** — the factory guarantees the object is valid before it's returned.
- **Choosing an implementation** — return an interface; hide which concrete class was chosen.
- **Aggregate assembly** — build a whole aggregate (root + internals) in one correct step.
- **Testability** — a factory is a seam you can substitute in tests.

## Where it's overkill

- **Plain value objects** — `new Money(5, "USD")` needs no factory; the constructor *is* the factory.
- **Simple data holders** — DTOs (`11-data-transfer-objects`) are constructed inline.
- **One implementation, trivial creation** — adding a factory just adds a layer to read.

Constructors aren't the enemy. A factory earns its place only when creation itself is a real
concern.

## Common shapes

| Kind | What it does |
| --- | --- |
| **Simple / static factory method** | `Money.usd(5)` — a named, readable constructor |
| **Factory method** | a method that decides *which* subclass/implementation to create |
| **Abstract factory** | a family of related creators selected together (e.g. per-database) |
| **Builder** | assembles a complex object step by step, then `.build()` |
| **DI container** | a factory engine for the whole object graph (the composition root) |

```ts
// Factory method: pick an implementation behind an interface.
function createRepository(env: Env): OrderRepository {
  return env.DB === "postgres"
    ? new PostgresOrderRepository(new Pool(env.DB_URL))
    : new InMemoryOrderRepository();
}

// Static factory method: readable, intention-revealing construction.
class Money {
  private constructor(readonly amount: number, readonly currency: string) {}
  static usd(amount: number) { return new Money(amount, "USD"); }
}
```

## Factories vs the composition root

| | Factory | Composition root (`02-inversion-of-control`) |
| --- | --- | --- |
| Scope | creates a specific kind of object | assembles the whole app's graph |
| Location | usually in the domain/application | the entry point |
| Focus | one type's creation rules | cross-cutting wiring of everything |

A DI container *is* a factory for the whole application, but it doesn't remove the need for domain
factories that enforce business invariants at creation.

## Guidance

- **Separate "new" from "reconstitute."** Creation and loading-from-storage have different rules;
  don't cram both into one constructor.
- **Return the abstraction.** A factory that chooses an implementation should return the interface.
- **Keep factories free of business logic.** Their job is construction and wiring, not decisions
  about what to build (that belongs in the domain).
- **Let the object validate.** Don't duplicate domain invariants in the factory — delegate to the
  object's constructor or the aggregate root.
- **Prefer the simplest thing.** Named static factory > builder > abstract factory; escalate only
  when the complexity is real.

## Pitfalls

- **Factories everywhere.** If every class has a factory, you've added indirection without benefit.
- **Logic in the factory.** "Decide the order's discount while creating it" is domain logic, not
  construction.
- **Bypassing invariants.** A factory that hands out half-built objects defeats its purpose.
- **Confusing factory with composition root.** Creating one object ≠ wiring the application.

## One-line summary

**A factory encapsulates object creation when construction is non-trivial — enforcing invariants,
choosing an implementation behind an interface, or assembling a cluster — giving creation one
explicit name; but for simple values and data, the constructor is enough and a factory is just extra
layer.**

## References

- Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides — *Design Patterns* (GoF), "Creational Patterns"
- Martin Fowler — *Inversion of Control Containers and the Dependency Injection pattern* — <https://martinfowler.com/articles/injection.html>
- Eric Evans — *Domain-Driven Design* (2003), "Factories"
- Related: `04-value-objects`, `07-aggregates`, `02-inversion-of-control`
