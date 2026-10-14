# Value objects

*A value object is an immutable value defined entirely by its **attributes**, not by an identity.
Two `Money(5, "USD")` are the same because they hold the same data — there's no "which one" to
care about. You create them freely, share them safely, and compare them by value.*

Part of the language-agnostic [`fundamentals/`](../) track. Contrast with `05-entities`; see also
`03-value-objects-vs-collaborators`.

## Definition

A **value object** is a small, immutable object that represents a descriptive aspect of the
domain, defined by its attributes. It has **no identity** and **no lifecycle** — it isn't
"created" and then "changed," it's just a value.

```ts
class Money {
  constructor(
    readonly amount: number,
    readonly currency: string,
  ) {
    if (amount < 0) throw new Error("amount must be non-negative");
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) throw new Error("currency mismatch");
    return new Money(this.amount + other.amount, this.currency); // new value, never mutate
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
```

## Key traits

| Trait | Meaning |
| --- | --- |
| **No identity** | equality is by attributes, not by an id |
| **Immutable** | operations return a *new* instance; never mutate in place |
| **Side-effect free** | `Money.add` is pure — same input, same output |
| **Interchangeable** | any instance with equal state can stand in for another |
| **Self-validating** | illegal states are rejected at construction |
| **Freely constructible** | safe to `new` anywhere (see `03-value-objects-vs-collaborators`) |

## Common examples

`Money`, `DateRange`, `EmailAddress`, `PhoneNumber`, `Coordinate`, `Address`, `Color`, `Percentage`,
`OrderId`/`UserId` (typed ids), and any `(x, y)` / `(start, end)` pair.

Notice several of these **replace primitive obsession** — passing `string`/`number` around where a
typed value would prevent bugs:

```ts
// Primitive obsession: easy to swap the arguments by accident.
function schedule(start: string, end: string) {}

// Value objects: the compiler and the constructor have your back.
function schedule(range: DateRange) {}
```

## Guidance

- **Make it immutable.** All fields `readonly`/`final`, no setters. "Modifying" means returning a
  new value (`date.addDays(1)` → new `Date`).
- **Put equality and hashing on the value.** Two equal value objects must be `equals()`; in
  languages with value equality (records, `struct`s) you get this for free.
- **Validate on construction** so a value object can never hold an invalid state.
- **Give it behavior, not just getters.** `Money.multiply(n)` beats external arithmetic on raw
  fields.
- **No identity, no repository.** You don't load a `Money` by id; it's stored inline with whatever
  owns it.

## Entities vs value objects

The distinction that matters most (Evans):

| | Value object | Entity (`05-entities`) |
| --- | --- | --- |
| Equality | by attributes | by identity (id) |
| Identity | none | stable id |
| Mutability | immutable | mutable over its lifecycle |
| Example | `Money(5,"USD")` | `User #42` |

Rule of thumb: **if losing the object and creating an identical one changes nothing, it's a value
object; if two objects with the same data must still be distinguished, it's an entity.**

## Pitfalls

- **Mutable value objects** — if you can mutate a "value," you get shared-state bugs. Keep them frozen.
- **Using them where identity is required** — a bank account isn't a value object; accounts have identity.
- **Anemic values** — a `Money` with only getters forces arithmetic to leak everywhere. Put operations on it.
- **Over-wrapping** — don't invent a type for every `string`; do it where the concept is real.

## One-line summary

**A value object is an immutable, identity-less object defined and compared by its attributes — you
construct and share it freely, it never mutates, and it exists to replace loose primitives with a
named, self-validating concept.**

## References

- Martin Fowler — *ValueObject* — <https://martinfowler.com/bliki/ValueObject.html>
- Martin Fowler — *EvansClassification* (entity vs value object) — <https://martinfowler.com/bliki/EvansClassification.html>
- Eric Evans — *Domain-Driven Design* (2003), ch. 5 "A Model Expressed in Software"
- Related: `03-value-objects-vs-collaborators`, `05-entities`, `12-factories`
