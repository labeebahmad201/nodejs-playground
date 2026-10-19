# Strategy vs subtype polymorphism

*Two ways of varying behavior behind an interface can look identical in code but answer different
questions: **subtype polymorphism varies what the object is** (its kind is the thing that
changes), while **Strategy varies how the same object behaves** (one stable type, an algorithm
injected into it). Pick the wrong one and you get class explosions — or a context nobody can
configure.*

This is language-agnostic — it's about the shape of the variation, not the syntax. The examples
lean on TypeScript because that's what this repo is built on.

## The same shape in code

Both look like "an interface plus a family of implementations." First, subtype polymorphism —
each kind of thing is its own type:

```ts
abstract class Shape {
  abstract getArea(): number;
}

class Circle extends Shape {
  constructor(private radius: number) { super(); }
  getArea(): number { return Math.PI * this.radius ** 2; }
}

class Square extends Shape {
  constructor(private side: number) { super(); }
  getArea(): number { return this.side * this.side; }
}
```

Then Strategy — one stable type holding a swappable algorithm:

```ts
interface AreaFormula {
  area(data: ShapeData): number;
}

class Shape {
  constructor(private data: ShapeData, private formula: AreaFormula) {}
  getArea(): number { return this.formula.area(this.data); }
}
```

You cannot tell which idea you're looking at from the syntax — both are an interface and a set of
implementations. The difference is intent: identity versus behavior, **is-a** versus **has-a**.

## What actually differs

| | Subtype polymorphism (`Shape`) | Strategy |
| --- | --- | --- |
| Variation is in | what it *is* — the kind | how it *behaves* — the algorithm |
| Relationship | **is-a** (subtyping) | **has-a** (composition, injected) |
| Chosen | at construction; part of identity | at construction, often swappable at runtime |
| Same kind, different behavior? | no — a `Circle` is a `Circle` | yes — two `Shape`s, different `AreaFormula` |
| Multiple axes vary | class explosion (2 shapes × 3 styles = 6 classes) | compose independently (2 + 3 = 5 pieces) |
| Role in [OCP](../32-solid/03-ocp) | a way to satisfy the principle | another way to satisfy the principle |

- **Subtype polymorphism** answers "what kinds of things exist?" The behavior is baked into the
  type's identity and fixed when the object is constructed.
- **Strategy** answers "which way of doing this job?" One context type stays stable while the
  algorithm varies independently of it — and can be swapped per instance, or at runtime.

## Strategy's intent

GoF, *Design Patterns* (1994) — the intent, verbatim:

> Define a family of algorithms, encapsulate each one, and make them interchangeable. Strategy
> lets the algorithm vary independently from clients that use it.

The keywords are **algorithms** and **clients**: the client doesn't change, the algorithm does.
In the Shape example above, there is no stable client being configured — the object itself is
what varies. That's the tell.

## Both satisfy OCP

Neither is a rival to the Open/Closed Principle — both are ways to *implement* it: an abstraction
plus a family of implementations, so new behavior is added rather than edited
(see the [OCP note](../32-solid/03-ocp)). The same problem can be solved either way:

- **Subtype version:** adding a `Triangle` is one new class; `Shape` and every consumer are
  untouched.
- **Strategy version:** adding a new `AreaFormula` is one new class; the `Shape` context and every
  consumer are untouched.

The difference is what you can *do* afterward: with Strategy, the behavior is configurable per
instance and changeable at runtime. Subclassing bakes the algorithm into the type; Strategy lets
the algorithm vary independently of the type that uses it — the composition-based alternative to
varying behavior by subclassing.

## Which to choose

Ask **which axis is changing**, not "interface or pattern?":

- new **kinds of things** arriving → subtype polymorphism (a new `Triangle` class);
- new **ways of doing the same job** → Strategy (a new shipping rule, payment method, compression
  codec);
- **multiple axes** varying independently → Strategy, because composition multiplies the pieces
  while inheritance multiplies the classes (2 shapes × 3 styles is six classes; 2 + 3 is five
  small pieces).

The pattern itself — its three roles, when it is warranted and when it is ceremony — is in
[Strategy pattern](../35-strategy-pattern).

## Nuance

- **Structure can't tell you which you have.** A one-method interface implemented by several
  classes is pedagogically "subtype polymorphism" and practically often Strategy. The intent is
  in the semantics: does the variation make a new *kind*, or a new *way*?
- **Strategy is not a language feature; subtyping is.** You can hand-roll Strategy in a language
  without inheritance (a plain function, a closure, a lookup table) — which is why "just add a
  class" and "inject a function" can be the same design decision wearing different syntax.
- **A subtype hierarchy is a bet, like any closure.** It closes along "kinds of things." If kinds
  are actually fixed forever while new *operations* keep arriving, the hierarchy is the wrong
  closure even though it satisfies OCP along the type axis — the same "which axis is stable?"
  question as everywhere else in the SOLID track.
- **Names matter more here than usual.** `Circle`/`Square` say "kind." If your class names are
  `ShippingByWeight` / `ShippingByDistance`, you've written Strategy — and calling it a type
  hierarchy just makes the next reader hunt for the context it configures.

## One-line summary

**Subtype polymorphism varies what an object *is* (is-a, decided at construction; new kinds are
new classes), while Strategy varies how a stable object *behaves* (has-a, injected and often
swappable) — choose by the axis of change: new kinds → subtypes, new ways of doing the same job →
Strategy, and multiple independent axes → composition, because it multiplies pieces instead of
classes.**

## References

- Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides — *Design Patterns* (1994) — the
  Strategy pattern
- This repo — [Strategy pattern](../35-strategy-pattern) — the pattern itself: structure,
  trade-offs and its neighbours
- This repo — [Open/Closed Principle](../32-solid/03-ocp) — the principle both approaches satisfy
- Martin Fowler — *Refactoring* (2nd ed.) — *Replace Conditional with Polymorphism* (the
  refactoring that introduces either form)
- Wikipedia — *Strategy pattern* —
  <https://en.wikipedia.org/wiki/Strategy_pattern>
