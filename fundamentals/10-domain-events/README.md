# Domain events

*A **domain event** is a record that something meaningful **happened** in the domain — named in the
past tense, immutable, and published so other parts of the system can react without the domain
knowing about them.*

Part of the language-agnostic [`fundamentals/`](../) track. Complements `07-aggregates`.

## Definition

A **domain event** is an immutable record of a fact that occurred. It says what happened and when,
in the language of the business. It's *value-like* — no business identity — but a distinct building
block from a value object (see [`21-value-entity-identity`](../21-value-entity-identity/)).

```ts
class OrderPlaced {                     // past tense = it already happened
  readonly occurredAt: Date;
  constructor(
    readonly orderId: OrderId,
    readonly customerId: CustomerId,
    readonly total: Money,
    occurredAt: Date,
  ) {
    this.occurredAt = occurredAt;        // time passed in — deterministic/testable
    Object.freeze(this);                 // events are immutable
  }
}
```

The aggregate records events as it changes; something at the edge publishes them:

```ts
class Order {
  private events: DomainEvent[] = [];

  submit(): void {
    if (this.lines.length === 0) throw new Error("empty order");
    this.status = "submitted";
    this.events.push(new OrderPlaced(this.id, this.customerId, this.total, this.now));
  }

  pullEvents(): DomainEvent[] {
    const out = this.events;
    this.events = [];
    return out;                          // application service publishes, then saves
  }
}
```

## Properties

| Property | Meaning |
| --- | --- |
| **Past tense** | `OrderPlaced`, not `PlaceOrder` (that's a *command*) |
| **Immutable** | a fact can't change once it happened |
| **Named in the domain language** | business meaning, not technical action |
| **Carry what happened** | and enough data for handlers, without leaking the aggregate |
| **Published, not called** | the producer doesn't know the consumers |

## Domain event vs command vs event (integration)

| Term | Tense | Intent | Example |
| --- | --- | --- | --- |
| **Command** | imperative | a request to do something (may be rejected) | `PlaceOrder` |
| **Domain event** | past | a fact inside the model (already true) | `OrderPlaced` |
| **Integration event** | past | a fact published outside the service/boundary | `order.placed` (on a queue) |

Commands can fail; events have already happened.

## Why use them

- **Decoupling.** The aggregate doesn't know who reacts — email, inventory, analytics. Add a
  listener without touching the producer.
- **Cross-aggregate consistency.** Some rules can't live in a single aggregate's transaction; they
  are handled **eventually** by reacting to events (`07-aggregates`).
- **Audit & history.** Events are a factual log of what the system did.
- **Enabling event sourcing.** An event log can itself be the source of truth (a bigger step; not
  required to get value here).

## Guidance

- **Publish after the change is committed** (or via an outbox) so you don't announce facts that get
  rolled back.
- **Pass a `now` (clock) in** when creating the event — keeps it testable
  (`fundamentals/01-pure-functions`).
- **Keep events small and self-contained.** Enough for handlers; don't hand out live entity
  references.
- **Emit at the aggregate root.** Events come from the consistency boundary that changed.
- **Be aware you've adopted eventual consistency.** A reaction to an event happens *later* — design
  for that (idempotent handlers, retries).

## Pitfalls

- **Leaking domain objects.** Putting live entities in an event defeats decoupling and
  serialization.
- **Events as commands.** Naming a "will happen" thing as an event, or expecting a rejection,
  confuses the model.
- **Publish-before-commit.** Emitting an event then failing to persist is a classic inconsistency
  bug (use transactional outbox).
- **Handlers that mutate the producer.** Reactions should be independent consumers.
- **Overusing events** for everything when a direct call would be simpler.

## One-line summary

**A domain event is an immutable, past-tense record of something that happened in the domain,
published by the aggregate so other parts of the system can react later without the domain knowing
about them — a tool for decoupling and cross-aggregate consistency, at the cost of eventual
consistency.**

## References

- Martin Fowler — *DomainEvent* — <https://martinfowler.com/bliki/DomainEvent.html>
- Eric Evans — *Domain-Driven Design* (2003); see also Vaughn Vernon, *Implementing Domain-Driven Design*
- Related: `07-aggregates`, `06-collaborators`, `05-entities`
