# Entities

*An **entity** is an object defined by a stable **identity** that runs continuously through time,
independent of its attributes. Two users with the same name are still two different users; the
thing that makes them "them" is the id, not the data.*

Part of the language-agnostic [`fundamentals/`](../) track. Contrast with `04-value-objects`; see
also `07-aggregates`.

## Definition

An **entity** (a.k.a. *reference object*) is a domain object with a **lifecycle** and a **stable
identity**. Its attributes change over time; the identity does not. Equality is by identity, not by
data.

```ts
class User {
  private name: string;
  private email: EmailAddress;
  private active = true;

  constructor(
    readonly id: UserId,        // identity — set once, never changes
    name: string,
    email: EmailAddress,
  ) {
    this.name = name;
    this.email = email;
  }

  rename(name: string): void {
    if (name.trim() === "") throw new Error("name required");
    this.name = name;           // attributes change...
  }

  deactivate(): void {
    this.active = false;
  }

  equals(other: User): boolean {
    return this.id.equals(other.id); // ...but equality is by id
  }
}
```

`User #42` stays `User #42` after a rename, an email change, or a deactivation. That continuity is
the whole point.

## Key traits

| Trait | Meaning |
| --- | --- |
| **Identity** | a stable id (or natural key) that never changes |
| **Lifecycle** | created, changed, and eventually deleted over time |
| **Mutable** | attributes change through *meaningful operations*, not raw setters |
| **Equality by id** | same id ⇒ same entity, regardless of current data |
| **Behavior-rich** | methods express domain rules (`deactivate`, `rename`) |

## Where identity comes from

- **Surrogate id** — a generated `UUID`/auto-increment key. Most common; stable and simple.
- **Natural id** — e.g. a national ID or an ISBN, when it genuinely is unique and permanent.
- **Composite id** — a combination (`(tenantId, orderNumber)`) in multi-tenant systems.

Pick the id early and treat it as immutable; it's the one thing that must never change.

## Entities vs value objects

| | Entity | Value object (`04-value-objects`) |
| --- | --- | --- |
| Equality | by **identity** | by **attributes** |
| Identity | yes, stable id | none |
| Mutability | mutable over lifecycle | immutable |
| "Same thing?" | same id | same data |
| Example | `User #42`, `Order #9001` | `Money(5,"USD")`, `DateRange` |
| Stored/loaded | by id, usually a repository | inline, with its owner |

The test: **does an identical copy still have to be distinguished from the original?** If yes, it's
an entity.

## Guidance

- **Protect invariants.** Expose intention-revealing methods (`rename`, `deactivate`), not setters.
  An entity should never be able to enter an invalid state.
- **Give it behavior, not just data.** The logic that operates on the entity's own data belongs on
  the entity.
- **Compare by id.** Override equality (or use a typed `UserId`) so two loaded copies compare equal.
- **Keep value objects inside.** An entity's attributes are usually value objects (`EmailAddress`,
  `Money`) — wrap primitives.
- **Don't hold live references to other aggregate roots.** Reference them by id (see `07-aggregates`).

## Pitfall: the anemic domain model

An **anemic entity** is a data bag with getters/setters and no behavior — all the logic lives in
separate "service" classes. It looks object-oriented but is procedural in disguise, and it lets
invalid states exist because nothing guards the fields.

```ts
// Anemic: anyone can set anything, invariants unprotected.
user.name = "";                 // no rule
user.email = "not-an-email";    // no rule

// Rich: the entity owns its rules.
user.rename("Ada");             // validated
```

If your entity is all getters/setters, the behavior belongs back on the entity. (Some teams
deliberately do this — "anemic" — for simpler CRUD apps; know it's a tradeoff.)

## One-line summary

**An entity is a domain object with a stable identity and a lifecycle whose attributes change over
time but whose "who it is" never does — it's mutable through intention-revealing, invariant-
protecting methods, and it's equal to another entity exactly when their identities match.**

## References

- Martin Fowler — *EvansClassification* (entity vs value object) — <https://martinfowler.com/bliki/EvansClassification.html>
- Martin Fowler — *AnemicDomainModel* — <https://martinfowler.com/bliki/AnemicDomainModel.html>
- Eric Evans — *Domain-Driven Design* (2003), ch. 5 "A Model Expressed in Software"
- Related: `04-value-objects`, `07-aggregates`, `08-repositories`
