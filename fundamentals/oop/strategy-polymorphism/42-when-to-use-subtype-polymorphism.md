# When to use subtype polymorphism

*Subtype polymorphism is for **behavior** that varies, not for **data** that varies. If the variants
differ only in their values, one class and an instance per variant are simpler and more flexible
than a subclass per variant. If they differ in what they **do** — different operators, different
statements, different collaborators — the alternative is a conditional, and subtype polymorphism
replaces it. This is Christopher Okhravi's rule, and it is the same choice behind Fowler's two
refactorings that move in opposite directions: Replace Conditional with Polymorphism, and Remove
Subclass.*

## Two kinds of variation

| What varies | What it looks like | What to use |
| --- | --- | --- |
| **data** | the same method, reading different values: a name, a damage number, a gender code | one class; one instance per value |
| **behavior** | a different operation: `-=` versus `=`, another formula, an extra field | subtype polymorphism — or Strategy |

Subtype polymorphism is dynamic dispatch through a supertype: the caller holds a `Move`, and the
object decides which `use` runs. It still varies *what the object is* — a `Heal` is a different
kind of move from an `Attack`. The point is that the kind earns its existence by behaving
differently. If it only carries different data, it is not a kind; it is a row.

The distinction is not "does the class have a method?" A data class can have methods. The question
is whether the method's **body** changes between variants, or only the values it reads.

## Data variation: one class, many objects

Okhravi's first example is a battle system. `Thunderbolt` and `Scratch` are attacks with different
names and different damage. The first diagram models that as an interface with `name` and `damage`
properties. The second adds a `use(target)` method; the bodies still differ only in the number:

```ts
interface Attack {
  use(target: Player): void;
}

class Thunderbolt implements Attack {
  use(target: Player): void { target.health -= 50; }
}

class Scratch implements Attack {
  use(target: Player): void { target.health -= 25; }
}
```

The method is there, but the only difference is the number. The operation is still subtraction; only
the operand changes. That is data.

The one-class version does the same job:

```ts
class Attack {
  constructor(
    readonly name: string,
    private damage: number,
  ) {}

  use(target: Player): void {
    target.health -= this.damage;
  }
}

const thunderbolt = new Attack("Thunderbolt", 50);
const scratch = new Attack("Scratch", 25);
```

The interface and its two implementations collapse into one class with two constructor arguments.
Adding a third attack is a new object — or a row from a database, a JSON file, a config — not a
new class. Okhravi: "Here we're modeling different attacks as classes when in fact the different
attacks should be objects."

The same move has a name in Fowler's catalog: **Remove Subclass**, also called *Replace Subclass
with Fields*. His example is a `Person` hierarchy whose subclasses differ only in a constant:

```ts
class Person {
  get genderCode(): string { return "X"; }
}

class Male extends Person {
  get genderCode(): string { return "M"; }
}

class Female extends Person {
  get genderCode(): string { return "F"; }
}
```

Replace the subclasses with a field:

```ts
class Person {
  constructor(private readonly _genderCode: string) {}

  get genderCode(): string { return this._genderCode; }
}
```

Refactoring Guru's description of the smell: "You have subclasses differing only in their
(constant-returning) methods." The benefit: "Creating subclasses is overkill if all you want to do
is to return different values in different methods."

Subclassing for a constant is the degenerate case in
[Two reasons for inheritance](38-two-reasons-for-inheritance.md): the subclass inherits a whole API
to change one value.

## Behavior variation: different operations

The third example widens the interface to `Move` and gives it two subtypes that do different
things:

```ts
interface Move {
  use(target: Player): void;
}

class Attack implements Move {
  constructor(private damage: number) {}

  use(target: Player): void {
    target.health -= this.damage;
  }
}

class Heal implements Move {
  use(target: Player): void {
    target.health = 100;
    target.armor = 100;
  }
}
```

`Attack` subtracts; `Heal` assigns, and it touches `armor`, which `Attack` never reads. The
difference is the operation, not the operand. Okhravi: "It's not just that the amount is varying,
it's that the thing we are doing to the thing varies." He calls the two branches "two different
operators, two different algorithms."

Without the hierarchy, the same variation has to live in a conditional:

```ts
type MoveData =
  | { kind: "attack"; damage: number }
  | { kind: "heal" };

function useMove(move: MoveData, target: Player): void {
  if (move.kind === "attack") {
    target.health -= move.damage;
  } else {
    target.health = 100;
    target.armor = 100;
  }
}
```

At two branches this is readable. At ten, one function holds ten unrelated algorithms, and the
reader has to hold all of them to understand one. The cost is also the next branch: `Buff` edits
`useMove`, and so does every other function that switches on `move.kind`. The module is open for
modification, not extension — the problem in [Open/Closed Principle](03-ocp).

With the interface, `Buff` is a new class:

```ts
class Buff implements Move {
  use(target: Player): void {
    target.attack += 10;
  }
}
```

The caller holds a `Move` and calls `move.use(target)`. The runtime picks the implementation — the
upcast and dynamic dispatch Okhravi ends on.

A classic example of **Replace Conditional with Polymorphism** is `Bird.getSpeed()`. Each branch
computes a different formula from different data:

```java
class Bird {
  double getSpeed() {
    switch (type) {
      case EUROPEAN:
        return getBaseSpeed();
      case AFRICAN:
        return getBaseSpeed() - getLoadFactor() * numberOfCoconuts;
      case NORWEGIAN_BLUE:
        return (isNailed) ? 0 : getBaseSpeed(voltage);
    }
    throw new RuntimeException("Should be unreachable");
  }
}
```

The refactoring moves each branch into a subclass — `European`, `African`, `NorwegianBlue` — and
the caller becomes `speed = bird.getSpeed();`. Refactoring Guru states the payoff: "If you need to
add a new execution variant, all you need to do is add a new subclass without touching the existing
code (Open/Closed Principle)."

## The test: try the single-class version

Before adding a hierarchy, write the version with one class:

1. Write one concrete class that takes the variant's values as constructor arguments. If the method
   body is the same for every variant, the variation is **data**. Keep the class.
2. If the method body needs an `if`/`switch` on a kind, the variation is **behavior**. Move each
   branch into a subtype — or into a Strategy, when the varying thing is an algorithm for a stable
   context ([Strategy vs subtype polymorphism](34-strategy-vs-subtype-polymorphism.md)).

The first version is mechanical. The second is the design decision: the branch is exactly what
polymorphism removes. A data class reads a different value; a behavior hierarchy performs a
different operation.

## When a conditional is fine

"Use polymorphism for behavior variation" does not mean every `if` is a design smell. A conditional
that encodes a business rule (`if (order.isPaid)`) or guards an edge is not dispatching on a kind,
and it will not grow a branch per variant. A single `switch` over a closed, small set can also be
clearer than a class hierarchy, especially when the compiler can check that it is exhaustive.

The costly shape is the **type switch that grows**: the same `kind` check repeated across functions,
edited for every new variant. That is where polymorphism pays for itself. Okhravi's "only time" is
a rule about which axis of change justifies a hierarchy, not a ban on conditionals.

## Not the same question as Strategy

This note answers the question before the one in
[Strategy vs subtype polymorphism](34-strategy-vs-subtype-polymorphism.md): **does behavior vary
at all?** If it does, that note asks whether the variation is a new kind (subtype) or a new
algorithm for a stable context (Strategy). Both replace a conditional; they differ in what is
varying.

`Attack` and `Heal` are kinds of moves, so they are subtypes. `StandardShipping` and
`ExpressShipping` are algorithms a checkout uses, so they are Strategies
([Strategy pattern](35-strategy-pattern.md)). Data-only subclasses are the case where the answer is
neither: there is no behavior to vary, so there is no subtype to choose.

Subtype polymorphism varies what the object *is* — that is 34's axis. This note adds the
condition: the kinds must behave differently; otherwise there is no reason to split them.

## One-line summary

**Use subtype polymorphism when the variants do different things; when they differ only in their
data, one class and many instances are simpler and more flexible — and a growing type switch is
the signal that behavior variation is asking for a hierarchy.**

## References

- Christopher Okhravi — *The Only Time You Should Use Polymorphism* (YouTube) —
  <https://www.youtube.com/watch?v=YaSMkzmc_sA>
- Martin Fowler — *Refactoring* — *Replace Conditional with Polymorphism* —
  <https://refactoring.com/catalog/replaceConditionalWithPolymorphism.html>
- Martin Fowler — *Refactoring* — *Remove Subclass* (Replace Subclass with Fields) —
  <https://refactoring.com/catalog/removeSubclass.html>
- Refactoring Guru — *Replace Conditional with Polymorphism* —
  <https://refactoring.guru/replace-conditional-with-polymorphism>
- Refactoring Guru — *Replace Subclass with Fields* —
  <https://refactoring.guru/replace-subclass-with-fields>
- This repo — [Open/Closed Principle](03-ocp)
- This repo — [Strategy vs subtype polymorphism](34-strategy-vs-subtype-polymorphism.md)
- This repo — [Strategy pattern](35-strategy-pattern.md)
- This repo — [Two reasons for inheritance](38-two-reasons-for-inheritance.md)
