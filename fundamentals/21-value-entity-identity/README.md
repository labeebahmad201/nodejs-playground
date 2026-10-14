# Value, entity & identity — what's what

*A **value object** is a description with no identity; an **entity** is a thing you track over time,
which *has* identity; and **identity** is the handle that makes it "the same thing" as its attributes
change. Getting this split right decides how your whole model behaves — and when to reach for each.*

Part of the language-agnostic [`fundamentals/`](../) track. The foundational split behind
`04-value-objects` and `05-entities`.

## The picture that makes it click

Two **$5 bills** are interchangeable — hand me either one, it's the same thing. Two **bank accounts**
that each hold $5 are **not** interchangeable: account 123 and account 456, and moving money from the
wrong one is a catastrophe. What separates them isn't their contents (both $5) — it's their **account
number**. And that number stays the same whether the balance is $5 or $5,000.

- **$5** → a **value**: defined only by its attributes, no identity, interchangeable.
- **the account** → an **entity**: attributes change, it stays "the same account."
- **the account number** → the **identity**: the handle that survives all those changes.

"**Domain object**" just means *any object in your domain model*. Its two main kinds are **value
objects** and **entities**, separated by **identity**.

## 1. Value object — defined by its attributes

No identity. Two of them with the same attributes are equal, and you can swap them freely. Immutable:
to "change" one you *replace* it.

```ts
class Money {                                   // value object
  constructor(readonly amount: number, readonly currency: string) {}
  equals(o: Money) { return this.amount === o.amount && this.currency === o.currency; }
}

new Money(5, "USD").equals(new Money(5, "USD")); // true — interchangeable
```

Examples: `Money`, `Email`, `Address`, `DateRange`, `Color`, `Coordinates`, `Percentage`, `PhoneNumber`.

## 2. Entity — a domain object with identity

A thing you *track over time*. Its attributes change (a customer changes name and address) but it's
still the same entity, because its **identity** doesn't change. Equality is by identity, never by
attributes.

```ts
class Order {                                   // entity
  private status: "draft" | "placed" = "draft";
  private lines: OrderLine[] = [];

  constructor(readonly id: OrderId) {}          // identity, fixed at creation
  place() { this.status = "placed"; }

  equals(other: Order) { return this.id.equals(other.id); }  // by identity
}
```

Examples: `Customer`, `Order`, `Product`, `Invoice`, `Account`, `User`, `Subscription`.

## 3. Identity — the handle that survives change

Identity is what makes something "the same thing" across days, edits, and state changes. It's usually
carried by a value object so you don't pass raw strings around:

```ts
class OrderId {                                 // identity (itself a value object)
  constructor(readonly value: string) {}        // e.g. a UUID
  equals(o: OrderId) { return this.value === o.value; }
}
```

- **Natural** — meaningful in the domain: `ISBN` (book), `VIN` (car), `IBAN` (account), email (user),
  ISO country code.
- **Surrogate** — a generated key with no meaning: `UUID`, auto-increment `OrderId`.

## Side by side

| | Value object | Entity | Identity |
| --- | --- | --- | --- |
| **What it is** | a description | a thing with a life story | the handle that survives change |
| **Has identity?** | no | yes | — |
| **Equality by** | attributes | identity | its own value |
| **Can change?** | no (replace it) | yes (attributes mutate) | no |
| **Example** | `Money`, `Email`, `Address` | `Customer`, `Order`, `Account` | `OrderId`, `ISBN`, `VIN` |

## When to use each

### Reach for a **value object** when…

- The concept is **fully described by its data** — money, an email, a date range, coordinates.
- You want to **kill primitive obsession**: wrap a raw `string`/`number` so it can carry validation
  and a name (`Email`, `Percentage`).
- **Equality should be by content** (dedup, comparison, cache keys).
- You want **immutability and safe sharing** — a small, self-contained concept passed around freely.
- It lives **inside** other things (entities, events) rather than having a life of its own.

### Reach for an **entity** when…

- It has a **lifecycle** — created, changed, maybe archived over time (draft → placed → shipped).
- **Something else must refer to it** later (orders reference a customer; invoices reference an order).
- Two instances with **identical attributes must stay distinct** (two orders with the same items are
  still two orders).
- You must **store and reload it** by a stable reference.
- You need a **history / audit of that specific instance**.

### Reach for **identity** when…

- The entity must be referred to **uniquely across time and systems**.
- It is **persisted and fetched** (you need a key).
- Other things point at it (**foreign keys, references in events**).
- Then choose the *kind*:
  - **Natural** when the domain already has a **stable, unique, meaningful** key (`ISBN`, `VIN`).
  - **Surrogate** when there's **no such key, or the natural key can change** (emails change — don't
    key a user by email).
- Always **wrap the raw id in a value object** (`OrderId`), never pass a bare `string`.

## How to decide

1. **"If I change all its attributes, is it still the same thing?"** No → value object. Yes → entity.
2. **"Does anything else need to refer to it later?"** Yes → it needs **identity**.
3. **"Are two identical instances interchangeable?"** Yes → value; No → entity.

## Pitfalls

- **Primitive obsession.** Raw strings/numbers for emails, money, ids — no validation, no meaning.
- **Entity explosion.** Giving everything identity makes the whole model mutable, id-heavy, and
  testable only with repositories. Most concepts are values.
- **Mutable value objects.** If it can change in place, it isn't a value — make a new one.
- **Equality by attributes for entities.** Two distinct orders would wrongly compare equal.
- **Mutable natural keys as identity.** Keying a user by email breaks the moment they change it.

## One-line summary

**A value object is a description (no identity, equal by content, immutable); an entity is a thing
tracked over time (equal by identity, mutable); identity is the stable handle that makes it the same
thing across change — use values for concepts you'd freely copy, entities plus an identity for things
that live, change, and get referenced.**

## References

- Eric Evans — *Domain-Driven Design* (2003) — entities & value objects
- Martin Fowler — *ValueObject* — <https://martinfowler.com/bliki/ValueObject.html>
- Vaughn Vernon — *Implementing Domain-Driven Design* — identity strategies
- Related: `04-value-objects`, `05-entities`, `10-domain-events`, `07-aggregates`
