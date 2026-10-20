# Interface Segregation Principle (ISP)

*The I in SOLID. The rule of thumb is deliberately blunt: many small interfaces are better than a few very large ones — "too many is better than too few." What counts as small depends on the system, because the unit is a role, not a method count. Split a large interface into the capabilities an object can have, let each object implement the ones it actually has, and let each client depend only on the capability it uses. That favors composition over inheritance and decoupling over coupling: a tree can consume energy without pretending to move or sleep.*

## The rule of thumb

Robert C. Martin's formal statement:

> Clients should not be forced to depend upon interfaces that they do not use.

Christopher Okhravi's restatement is the one this note follows:

> It's better to have many small interfaces rather than a few very large interfaces. ... Too many is better than too few.

Both say the same thing from opposite ends. The formal version is about the client: it should not be forced to depend on methods it does not call. The rule of thumb is about the design: when in doubt, split rather than bundle.

**"Small" is relative.** Okhravi is explicit that the principle depends on context and requirements: "in two different systems small might mean different things." Two methods can be one cohesive role; twelve methods can be a monolith. The question is not "how few methods can I put in this interface?" but "which methods belong to the same role?"

## The animal example: one large interface

The classic example is an `Animal` with three behaviors:

```ts
interface Animal {
  eat(): void;
  move(): void;
  sleep(): void;
}
```

Every animal must implement all three. That looks harmless — most animals do eat, move, and sleep — but the interface has already made a decision for every implementer and every client:

- A client that only feeds animals still depends on `move` and `sleep`. A change to either one can reach it.
- An object that only eats cannot be an `Animal` without faking the other two methods.
- A new kind of object that does not fit the animal hierarchy has to fake its way in, or start a parallel hierarchy.

Okhravi's description of the problem:

> We should not stick the sleep method, the signature of the sleep method, the signature of the eat method and the signature of the move method into the animal interface because we are then constructing a large monolithic animal when we could in fact instead be creating interfaces for smaller roles and then give all the necessary roles to an animal instance.

## The alternative: capabilities

```ts
interface CanEat {
  eat(): void;
}

interface CanMove {
  move(): void;
}

interface CanSleep {
  sleep(): void;
}

class Dog implements CanEat, CanMove, CanSleep {
  eat(): void { /* ... */ }
  move(): void { /* ... */ }
  sleep(): void { /* ... */ }
}
```

The dog is no longer "an `Animal`"; it is an object that can eat, move, and sleep. A client that needs only eating takes `CanEat` and cannot call `move` or `sleep` by accident. A class that can only eat implements only `CanEat`.

This is the move the principle is named for: **segregate the interface into the capabilities an object can have**, then compose the capabilities each object needs. In the video's words, "any particular animal implements the interfaces can move, can sleep and can eat" — it does not have to implement an `Animal` interface at all.

## Why it works: composition and decoupling

> By creating small interfaces and separating out different roles and responsibilities we are favoring composition over inheritance and we are favoring decoupling over coupling.

That is the whole benefit, stated twice. **Composition**: an object is assembled from the capabilities it has, instead of inheriting a bundle and rewriting the parts that do not fit. **Decoupling**: a client depends on the one capability it uses, instead of on every capability that happens to live on the same class.

The tree makes the first half concrete. A tree consumes energy and produces waste — it eats, in the loose sense — but it cannot move and it does not sleep. Under the monolithic `Animal`, it has two bad options: implement `move` and `sleep` with throws or empty bodies, or stay outside the hierarchy and duplicate the eating contract elsewhere. With `CanEat`, it simply implements `CanEat`:

```ts
class Tree implements CanEat {
  eat(): void { /* consumes energy, produces waste */ }
}
```

Okhravi: "Trees can't move, trees can't sleep, but trees do have some kind of metabolism." The payoff is not just fewer fake methods. It is that new kinds of objects are assembled from existing roles instead of being forced into a class tree: "it's much easier to design new objects without having to make entirely new classes."

The same shape appears outside object hierarchies. Okhravi compares it to microservices: one giant monolithic application versus a set of small responsibilities composed into the system you need. The unit changed from "the whole app" to "the service that does one thing"; here it changes from "the whole animal" to "the capability the object has."

|  | One large `Animal` | Small capabilities |
| --- | --- | --- |
| Adding a tree | new hierarchy, or fake `move`/`sleep` | `class Tree implements CanEat` |
| Client that only eats | depends on `move` and `sleep` too | depends on `CanEat` |
| Implementer | must supply every method | supplies only its capabilities |
| Reuse | tied to the animal hierarchy | capabilities compose across kinds |

## Cohesion: many small, not many arbitrary

The rule of thumb is easy to over-apply. "Too many is better than too few" is a bias against monoliths, not a target number.

- **A role can contain several methods.** If a set of operations is always needed together and changes together, it is one capability. Splitting it across five interfaces forces every client to import the whole set anyway — that is fragmentation, not segregation.
- **The animal example lands on one method per interface because eat, move, and sleep are independent.** In another system, "eat" might mean `consume()`, `digest()`, and `excrete()`; that is still one role, and it belongs together.
- **Repeated capabilities are shared, not copied.** If `Dog` and `Tree` both need to eat, they both implement `CanEat`. The repetition is the signal that the capability is reusable; creating `DogEat` and `TreeEat` would duplicate the contract and hide the shared role.
- **Cohesion is the test.** Methods that serve the same role, change for the same reason, and are used together belong in one interface. Methods that serve different clients do not.

### Do not keep the large interface "as well"

A tempting compromise is to add the small interfaces and leave the large one in place. That gives you the worst of both:

```ts
interface Animal {
  eat(): void;
  move(): void;
  sleep(): void;
}

interface CanEat {
  eat(): void; // the same signature, declared again
}
```

The implementation is shared, but the **contract is duplicated**. The two declarations must be kept in sync, and nothing forces them to agree. The large type is also still a legal dependency, so clients keep reaching for it and the coupling never actually goes away.

If compatibility forces an aggregate, compose it from the small interfaces rather than redeclaring their methods:

```ts
interface Animal extends CanEat, CanMove, CanSleep {}
```

Each method is declared once. Use the aggregate at the wiring or public boundary if you must; the clients still take the narrow capability they need.

## ISP and the other principles

| Question | Principle |
| --- | --- |
| Who can force this module to change? | [SRP](../01-srp) |
| How do I add behavior without editing tested code? | [OCP](../03-ocp) |
| Can this subtype stand in for the base type? | [LSP](../04-lsp) |
| What does this client actually depend on? | **ISP** |
| Which direction should the dependency point? | DIP (see [IoC](../../02-inversion-of-control)) |

- **ISP vs SRP.** Both draw boundaries, on different axes. SRP asks how many *reasons to change* a module has, usually mapped to actors; ISP asks what a *client's dependency surface* looks like. A class can have exactly one reason to change and still hand a client a wide interface.
- **ISP and OCP.** A small capability is a stable extension point: adding `CanFly` does not force `Dog` or `CanEat` to change. A large interface turns every addition into a change that touches every implementer and every client.
- **ISP and LSP.** A large interface forces implementers to fake capabilities they do not have — `Tree.move()` throwing is an LSP violation waiting for a caller. Segregating the interface removes the fake method. It does not remove the behavioral obligation for the capabilities that remain: ISP is about the **width** of the contract, LSP about the **behavior** of what the client sees.
- **ISP and DIP.** DIP says depend on abstractions, not concretions. ISP says the abstraction should be the *client's* role, not the implementer's entire surface. Together: narrow, client-owned capabilities.
- **ISP and composition.** "Favor composition over inheritance" is the same advice from the other side ([two reasons for inheritance](../../38-two-reasons-for-inheritance)). Small roles are composable; a monolithic base class is not.

## Where it came from

Martin introduced the principle in the 1996 C++ Report article as "**clients should not be forced to depend upon interfaces that they do not use.**" The explanation and examples here follow Okhravi's *Code Walks 023*, including the animal/tree example and the "too many is better than too few" restatement.

The principle is easy to state and easy to underestimate — the video opens by noting exactly that. Its value shows up when the next kind of object arrives: if it can be assembled from capabilities that already exist, the design paid for itself; if it forces a new hierarchy or a set of fake methods, the interface was too wide.

## One-line summary

**Prefer many small role interfaces to a few large ones — "too many is better than too few" — so each object implements only the capabilities it has and each client depends only on the capability it uses; the unit is a cohesive role, not a method count.**

## References

- Christopher Okhravi — *Interface Segregation Principle (SOLID) | Code Walks 023* — <https://www.youtube.com/watch?v=xahwVmf8itI>
- Robert C. Martin — *The Interface Segregation Principle*, C++ Report (June 1996) — <https://www.cs.utexas.edu/\~downing/papers/ISP-1996.pdf>
- This repo — [Single Responsibility](../01-srp), [Open/Closed](../03-ocp), [Liskov Substitution](../04-lsp), [Inversion of Control](../../02-inversion-of-control), [Two reasons for inheritance](../../38-two-reasons-for-inheritance)