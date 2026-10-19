# Inheritance vs composition

*Inheritance is a statement about what something **is**; composition is a statement about what
something **holds**. Code reuse comes free with inheritance when the is-a relationship is real —
and becomes the trap when it isn't: a subclass receives the parent's API, the parent's
implementation, and a promise to be substitutable, with no way to take only part of that.*

## What inheritance actually hands over

Three things at once, and you cannot decline any of them:

1. **The parent's API.** Being a subtype *means* being usable everywhere the parent is. There is no
   "I'll inherit but not implement `get(i)`."
2. **The parent's implementation.** `protected` members and overridable hooks become part of your
   class. You are coupled to *how* the parent works, not just to what it promises.
3. **A promise.** That everywhere the parent was accepted, you behave correctly — the
   substitutability obligation.

GoF names the first two **white-box reuse**: the subclass can see inside the parent. Composition is
**black-box reuse** — only the interface is visible.

## The trap: behavior you never read

Joshua Bloch's canonical example (*Effective Java*, Item 18) is a set that counts its insertions.
The same trap in TypeScript:

```ts
class List<T> {
  push(item: T): void { /* ... */ }
  pushAll(items: T[]): void { for (const i of items) this.push(i); } // ← calls its own push
}

class CountingList<T> extends List<T> {
  private count = 0;
  override push(item: T): void { this.count++; super.push(item); }
}

new CountingList<number>().pushAll([1, 2, 3]); // count is 3 from one call — not 1
```

The class was extended to **reuse** `List`'s code. What was actually inherited is a call graph:
`pushAll` is not self-contained, it is implemented in terms of `push`, and the override silently
changed what that means. Nothing in the signatures says so. This is the **fragile base class**
problem — and it is invisible from the outside.

## Composition

The same capability without a type claim:

```ts
class CountingList<T> {
  private inner = new List<T>();
  private count = 0;

  push(item: T): void { this.count++; this.inner.push(item); }

  pushAll(items: T[]): void { this.inner.pushAll(items); } // semantics chosen here, on purpose
}
```

`CountingList` no longer *is* a `List`; it *has* one. Now "does `pushAll` count as one insertion or
`n`?" is a decision the class owner makes and can test, instead of an accident of the parent's
internal structure.

## What composition actually controls

Composition is not a shopping cart of behaviors — the collaborator arrives whole. What you control
is different in kind:

| | Inheritance | Composition |
| --- | --- | --- |
| What's bound | the **types** — `B` is-a `A`, for every consumer | an **object you own** |
| Exposure | the entire parent API, fixed | you choose what to forward; a *narrower* interface is possible |
| Visibility into internals | yes (protected, overridable) | no — only its interface |
| Number of collaborators | one parent | as many as needed |
| When | compile-time, whole-class | per instance, swappable |

The distinction is **identity versus ownership**: inheritance tells everyone what your object *is*;
composition is a private arrangement about what your object *holds*. A `Stack` that *is* a `List`
inherits `get(i)` and `remove(0)`, so callers can break the stack invariant. A `Stack` that *has* a
`List` exposes `push`/`pop` and nothing else.

## The discriminating question

Not "is there code to share?" but:

> Can every `B` be used wherever an `A` is expected — forever?

- **Yes** → inheritance is the cheap, correct answer, and the reused code is a dividend.
- **Only if you fake the `A`** → the relationship is false. Delegate: hold the collaborator and
  expose the narrower contract.

Reuse is a consequence of a real is-a relationship, never the reason to claim one.

## The costs have names

- **Fragile base class** — Mikhajlov & Sekerinski, ECOOP 1998: parent changes break subclasses in
  ways neither side sees.
- **Yo-yo problem** — Taenzer, Ganti & Podar, 1989: deep hierarchies force readers to bounce up and
  down the tree to follow one call.
- **Substitutability** — Liskov, *Data Abstraction and Hierarchy* (1987); formalized by Liskov &
  Wing (1994). This is the enforcement arm of the promise above, and the next letter of the SOLID
  track.

## Nuance

- **Composition is not free.** You write the forwarding glue; inheritance is genuinely less typing
  when the is-a holds. Some languages shrink the gap (`by` in Kotlin, traits, default methods),
  but the glue never fully disappears.
- **Interface inheritance is a different animal.** Implementing an interface makes a promise with
  no implementation attached — that is the *good* half of inheritance, and GoF separates "class
  inheritance" from "interface inheritance" for exactly this reason. Extending a **concrete class**
  is the risky one.
- **"Extends is evil" is the polemic; the is-a test is the useful version.** Allen Holub's 2003
  article makes the case loudly; the decision rule above makes it repeatably.
- **The other trap is chasing reuse itself.** Forcing a common ancestor so three siblings can share
  a block is how the wrong abstraction is born — "duplication is far cheaper than the wrong
  abstraction" (Sandi Metz, *The Wrong Abstraction*, 2016). Shared code has non-inheritance homes:
  free functions, traits/mixins, interfaces plus a collaborator.
- **This is the general case of the Strategy discussion.** Composition chosen specifically for
  behavior that varies at runtime *is* the [Strategy pattern](../35-strategy-pattern); subtype
  hierarchies versus injection is [Strategy vs subtype polymorphism](../34-strategy-vs-subtype-polymorphism).
  This note is the principle underneath both.

## One-line summary

**Inheritance binds types, hands over the parent's API and implementation, and promises
substitutability — all-or-nothing; composition binds an object you own and lets you expose a
narrower contract, so choose by the is-a test ("usable as the parent everywhere, forever?"), not by
where the reusable code lives.**

## References

- Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides — *Design Patterns* (1994), Ch. 1 —
  "Favor object composition over class inheritance"; white-box vs black-box reuse
- Joshua Bloch — *Effective Java* (3rd ed.), Item 18 — "Favor composition over inheritance" (the
  instrumented-set example)
- Allen Holub — *Why extends is evil* (JavaWorld, 2003)
- Sandi Metz — *The Wrong Abstraction* (2016)
- Leonid Mikhajlov, Emil Sekerinski — *A Study of the Fragile Base Class Problem* (ECOOP 1998)
- David Taenzer, Murthy Ganti, Shyh-Wei Podar — *Object-Oriented Software Reuse: The Yo-Yo Problem*
  (1989)
- Barbara Liskov — *Data Abstraction and Hierarchy* (1987); Barbara Liskov, Jeannette Wing —
  *A Behavioral Notion of Subtyping* (1994)
- This repo — [Two reasons for inheritance](../38-two-reasons-for-inheritance), [Strategy
  pattern](../35-strategy-pattern), [Strategy vs subtype
  polymorphism](../34-strategy-vs-subtype-polymorphism), and the [SOLID overview](../32-solid)
