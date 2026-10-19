# Strategy pattern

*Define a family of algorithms, encapsulate each one, and make them interchangeable. The client
stays stable while the algorithm varies independently of it — the composition-based answer to
behavior that would otherwise be a growing conditional, a config flag, or a subclass per
variation.*

## The problem it solves

It is the same problem as the one in the [OCP note](../32-solid/03-ocp): behavior arrives as
variants, and the variant is picked at runtime. The first version usually looks like this:

```ts
class ShippingCost {
  calculate(order: Order): number {
    switch (order.method) {
      case "standard": return base + order.weight * 0.5;
      case "express":  return base * 2 + order.weight * 1.5;
      // every new shipping method edits this method... and re-runs its tests
    }
  }
}
```

Each new *way* of computing the cost edits this method. It is a choke point for a whole family of
algorithms — the same "closed against extension" problem, one level down.

## The pattern

Three roles (GoF): the **Context** stays stable and delegates; the **Strategy** is the interface
that names the algorithm contract; the **ConcreteStrategy** is one class per algorithm.

```ts
interface ShippingPolicy {
  cost(order: Order): number;
}

class StandardShipping implements ShippingPolicy {
  cost(order: Order): number { return base + order.weight * 0.5; }
}

class ExpressShipping implements ShippingPolicy {
  cost(order: Order): number { return base * 2 + order.weight * 1.5; }
}

class ShippingCost {
  constructor(private policy: ShippingPolicy) {}
  calculate(order: Order): number { return this.policy.cost(order); }
}
```

Adding a method is a new class; `ShippingCost` and every caller are untouched. The policy is
chosen somewhere — constructor injection, a factory reading `order.method`, a DI container — but
the *choice point* is one place instead of every branch.

The canonical teaching example is *Head First Design Patterns* Ch. 1: ducks that hold a
`FlyBehavior` and a `QuackBehavior`. A rubber duck is not a new subclass of `Duck`; it is a duck
with a different flying strategy (`FlyNoWay`).

## What it buys

- **Closed against new algorithms** — one new class, nothing existing edited.
- **Swappable per instance or at runtime** — impossible with a subclass, trivial with a field.
- **Independent axes compose** — 2 shipping speeds × 3 weight bands is 2 + 3 pieces, not 6 classes.
- **Testable in isolation** — the context is tested with a fake policy; each policy is tested
  without a context.
- **Explicit dependencies** — the algorithm's collaborators are in its constructor signature
  instead of being hidden inside a `switch`.

| Requirement changes | Subclass per variation | Strategy |
| --- | --- | --- |
| A new algorithm appears | new subclass, type recompiled | new class, context untouched |
| Same kind, different algorithm per instance | not expressible | constructor parameter |
| Change algorithm at runtime | no | setter, or a per-call policy |
| Two axes vary independently | classes multiply | pieces add |

## When it's warranted

- several variants exist **and more arrive as data** ("which way" is chosen at runtime);
- **multiple independent axes** of variation;
- the algorithm has state or dependencies of its own;
- the choice is configuration — per tenant, per request, per environment;
- it must be replaceable in a test.

## When it's overkill

- one algorithm, or two variants fixed at compile time → a plain function (or the conditional) is
  clearer;
- the variation is a *kind of thing* → that is subtype polymorphism, not Strategy
  ([Strategy vs subtype polymorphism](../34-strategy-vs-subtype-polymorphism));
- a single `switch` on one axis, rarely touched → see
  [When a switch is fine](../32-solid/03-ocp#when-a-switch-is-fine);
- in a language with first-class functions, a function *is* the strategy — the pattern is the OO
  encoding of "pass the behavior in."

## Not the only shape on the shelf

| Pattern | What varies | Relationship | Who chooses |
| --- | --- | --- | --- |
| Strategy | an algorithm | has-a, injected | the caller or configuration |
| Template Method | the steps of an algorithm | is-a, inheritance | the base class skeleton |
| State | behavior by internal state | has-a | the object's own transitions |
| Subtype polymorphism | the kind of thing | is-a | construction |

The structure of State and Strategy is identical — a context holding an interface. The difference
is *who* swaps it: an outside configuration (Strategy) or the object's own lifecycle (State). If
the object changes its own behavior when it transitions, you have written a state machine.

## Nuance

- **Structure cannot tell you which you have.** Identical class diagrams for Strategy, State, and
  plain delegation. The intent lives in the naming and in who acts on the strategy.
- **The interface must sit on the axis that actually varies.** An `IOrderService` with exactly one
  implementation is not Strategy — it is indirection. Strategy pays when the second
  implementation is real, not speculative; it is a bet that the *how* will keep changing.
- **The choice point is part of the design.** Somebody must map `order.method` to a concrete
  policy. Keep that in one factory, not scattered through the context — otherwise the conditional
  was only moved, not closed.
- **It collapses in dynamic languages.** Peter Norvig (*Design Patterns in Dynamic Languages*)
  argues most GoF patterns are "invisible or simpler" where functions are first-class; Strategy
  reduces to passing a function in.
- **Not a licence for one interface per class.** The pattern is about a family of interchangeable
  algorithms, not about wrapping every collaborator in an interface.
- **It is one application of a broader rule.** Composition beats inheritance because it binds an
  object you own instead of a type you *are* — [Inheritance vs
  composition](../36-inheritance-vs-composition).

## One-line summary

**Strategy moves a family of interchangeable algorithms out of the client and behind one
interface, so new ways of doing the same job arrive as new classes while the client stays
untouched — reach for it when the *how* genuinely varies (at runtime, per instance, by
configuration), and use a plain function, a subtype, or the conditional when it does not.**

## References

- Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides — *Design Patterns* (1994) — the
  Strategy pattern (Context / Strategy / ConcreteStrategy)
- Eric Freeman, Elisabeth Robson — *Head First Design Patterns* (2004) Ch. 1 — SimUDuck:
  `FlyBehavior` / `QuackBehavior`
- Peter Norvig — *Design Patterns in Dynamic Languages* (first presented 1996, online 1998) —
  <https://norvig.com/design-patterns/>
- This repo — [Strategy vs subtype polymorphism](../34-strategy-vs-subtype-polymorphism),
  [Open/Closed Principle](../32-solid/03-ocp), and Martin Fowler — *Refactoring* (2nd ed.) —
  *Replace Conditional with Polymorphism*
