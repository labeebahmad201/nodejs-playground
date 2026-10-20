# Dependency Inversion Principle (DIP)

*The D in SOLID. Okhravi opens with the vocabulary, not the definition — and that is the right order: "dependency injection, dependency inversion, constructor injection, parameter injection — what does it all mean?" Dependency **inversion** is the principle: invert the dependencies, "in a way that might seem unnatural." Dependency **injection** is the specific act of doing it — passing a dependency in instead of creating it inside. The shortcut worth memorizing: never couple to a concretion; always couple to an abstraction. Pay, once, at the edge, where something is allowed to create concretes. The payoff: behavior you can swap at runtime, tests that run in isolation — and, the surprise, subtype hierarchies you often turn out not to need.*

## The principle, in plain words

Robert C. Martin's formal statement:

> A. High-level modules should not depend on low-level modules. Both should depend on abstractions. B. Abstractions should not depend on details. Details should depend on abstractions.

Okhravi's restatement:

> Dependency injection is about never coupling to a concretion but always coupling to an abstraction. ... Obviously that's an oversimplification, because at some point you have to create a concretion — but we'll return to that in the end.

The vocabulary, as the video untangles it:

| Term | What it is | One line |
| --- | --- | --- |
| Dependency inversion | the **principle** | invert the direction of the dependency, so policy and detail both meet at an abstraction |
| Dependency injection | the **act/technique** | pass the dependency in instead of creating it inside |
| Constructor injection | where | injecting through an object's constructor |
| Parameter injection | where | injecting through the parameter of any function |

These four are one staircase: the principle, the act, and the two places you normally perform the act. The smaller relation around it — how DIP relates to IoC and to containers — is untangled in [Inversion of Control](../../02-inversion-of-control): DI is about *who supplies* a dependency, DIP is about the *direction* the dependency points.

**High-level vs low-level.** <u>Martin's terms: high-level modules hold the </u>*<u>policy</u>*<u> — the decisions you would express in a spec; low-level modules hold the </u>*<u>mechanism</u>* — the detailed code that fulfills the policy. Naive object orientation has the policy `new` the mechanism. That is the dependency to invert.

## What it buys you

From the video:

- **Runtime flexibility.** "You want to be able to change your instances at runtime, and not only at compile time" — the wiring is data now, it does not have to be source code.
- **No-recompile extension.** "Even at compile time, you can change the behavior of your program without rewriting classes — instead by writing new classes and then injecting those" — that is the [Open/Closed Principle](../03-ocp) in motion. `Animal` is closed; new behavior is a new class it did not have to know about.
- **Flexibility, reuse, small classes.** "It increases the flexibility of our code, it increases reuse, it encourages small classes with limited responsibilities, and it makes it easy to exchange one instance for another in order to change particular behaviors" — small classes, limited responsibilities: same goal as the [SRP](../01-srp), reached from the dependency side.
- **Testability.** The video calls this "the second aspect," and it deserves more than a bullet — it gets its own section below.

## The example

### Object orientation 101

The classic shape — the behavior hardcoded in the subclass:

```ts
abstract class Animal {
  abstract speak(): void;
}

class Cat extends Animal {
  speak(): void {
    console.log("Meow");
  }
}

class Cow extends Animal {
  speak(): void {
    console.log("Moo");
  }
}
```

Okhravi is not sneering at this: "this is sort of object orientation 101, ... this is what you learn in class." It is perfectly fine — while "speaking" is one `console.log`. DIP earns its keep when it is not.

### A bigger system: the behavior becomes its own hierarchy

Suppose speaking is complex: dialects, purring, hissing. The natural refactor is to extract it into a hierarchy of its own, one behavior per animal:

```ts
class CatSpeakingBehavior {
  speak(): void {
    // three dialects of meow, purring, chirping at birds, 3 a.m. operas...
  }
}

class CowSpeakingBehavior {
  speak(): void {
    // grazing moo, let-me-out moo, and the 5 a.m. variant
  }
}

class Cat extends Animal {
  private readonly speaking = new CatSpeakingBehavior();

  speak(): void {
    this.speaking.speak();
  }
}
```

Extraction is good. The wiring is the problem.

### The violation

```ts
class Cat extends Animal {
  private readonly speaking = new CatSpeakingBehavior(); // <-- coupled to the concretion
}
```

Okhravi:

> If the cat instantiates the cat speaking behavior ... then we are breaking the dependency inversion principle, because the high-level module — i.e. the cat and the dog and the cow — is coupled to the low-level module, in this case the speaking modules.

In Martin's terms: the *policy* ("this animal speaks like a cat") now depends on the *mechanism*(the actual cat code). The hierarchy knows what it wants to have happen, and it also decides *how*it happens — one class holding both ends of a lengthening dependency chain.

The inversion says both sides should meet at an abstraction instead: "you should invert these dependencies such that both the high-level module and the low-level module should depend on abstractions ... not the concrete speaking behaviors, nor the concrete animals." Concretely, for the animal side: "the animal classes should not instantiate their own speaking behaviors, but rather ... receive a speaking behavior and then run the method speak on that speaking behavior."

## The fix: invert, then inject

```ts
interface SpeakingBehavior {
  speak(): void;
}

class Animal {
  constructor(private readonly speaking: SpeakingBehavior) {}

  speak(): void {
    this.speaking.speak();
  }
}

class CatSpeakingBehavior implements SpeakingBehavior {
  speak(): void { /* the complex cat code */ }
}

class CowSpeakingBehavior implements SpeakingBehavior {
  speak(): void { /* the complex cow code */ }
}

// the one line where `new` meets both an abstraction and a concretion:
const cat = new Animal(new CatSpeakingBehavior());
cat.speak(); // meow
```

`Animal` (the policy) depends only on `SpeakingBehavior` (the abstraction). `CatSpeakingBehavior` implements it. The abstraction absorbs the coupling from both sides: the animals point at it, the behaviors fulfill it. And the concrete animal class "only knows about the abstraction... it doesn't know about concrete speaking behaviors."

Doing the same thing through parameter injection instead — "performing dependency injection through the parameter of any function" — needs no constructor at all:

```ts
function speakOnce(behavior: SpeakingBehavior): void {
  behavior.speak();
}
```

*Adapted from the video in one place:* Okhravi's C# example uses the **parent classes** as the abstractions ("the parent class, i.e. animal, and the parent class, i.e. speaking behavior"). In TypeScript an `interface` is the idiomatic abstraction and plays exactly that role.

## The second aspect: unit tests

> Without dependency inversion, testability — or isolated unit testing — would be really tricky, because when you want to test in isolation, you want to test a class without integrating with other classes. In that case ... you inject a mock that you have full control over, which means that you can 1) test in complete isolation, and 2) because of that avoid unwanted things such as random numbers in your tests. Just imagine if your tests would pass 50% of the time but fail 50% of the time — totally tricky, and we want to avoid that.

That is a chain of three claims, and DIP is doing all the work in it:

- **Isolation needs a seam.** A unit test examines one class *without integrating with other classes*. If `Cat` does `new CatSpeakingBehavior()` internally, the real cat code is compiled into the test and there is no seam to intercept. Injection creates the seam: the class receives whatever satisfies the abstraction, and the abstraction is the seam.
- **The test takes the** `main` **seat.** The inversion moves wiring out to the edge — and in a unit test, the test *is* the edge. The same injection point ends up used twice: production wiring injects `CatSpeakingBehavior`; test wiring injects a mock the test has full control over.
- **Full control means determinism.** Because the test owns the injected dependency, it owns everything the class reaches — nothing random, timed, or network-shaped sneaks in. That is the "pass 50% of the time, fail 50% of the time" trap: a class that reads the clock or `Math.random()` *internally* cannot be made deterministic; a class that has clock or random *injected* can.

The video even spells out the dependency-reversal link inside the argument, almost in passing: "you use dependency injection — which is possible because you are designing according to dependency inversion — and inject an object that you have full control over." The injection is the act; the inversion is the thing that made an injection point exist at all.

So the same property that lets you swap behavior at runtime lets you swap the real dependency with a test double — production wiring and test wiring are both "someone in the `main` seat." Same `Animal` as above, tested without any real cat code:

```ts
function itDelegatesToItsBehavior(): void {
  let calls = 0;
  const counting: SpeakingBehavior = { speak: () => (calls += 1) };

  new Animal(counting).speak();

  if (calls !== 1) throw new Error("Animal must delegate to its SpeakingBehavior");
}
```

No mocking library, no subclass — the fake is just another implementation of the same abstraction production uses. The class cannot tell the difference, and that is the point. The division of labor is worth naming: DIP supplies the seam and the injection point, DI is the act of exploiting it in the test, and a mocking library only names the fake — it does not create the seam.

## The twist: you might not need the hierarchies at all

The most interesting part of the video:

> Often times you'll realize that actually you don't need subtypes. In many cases dependency injection is enough, and you don't need inheritance hierarchies — which is probably why people are saying composition over inheritance: you can compose what behaves as your subtype instead of actually constructing your subtype.

If animals do nothing *but* speak, the subclasses add nothing: "cat and dog and cow would all contain the same code, they would just have different names, which makes them completely redundant. So in that case we only need `Animal`."

With inheritance, the behavior arrived through an is-a edge:

```ts
class Cat extends Animal {
  speak(): void { /* the complex cat code */ }
}

const cat = new Cat();
```

With injection, that edge is gone — the object is *composed* of the parts it behaves as, and no subclass survives:

```ts
// the Cat / Cow / Dog subclasses are deleted:
const cat = new Animal(new CatSpeakingBehavior()); // behaves like a cat
const cow = new Animal(new CowSpeakingBehavior()); // behaves like a cow
const dog = new Animal(new DogSpeakingBehavior()); // behaves like a dog
```

The swap is exact when you say both designs out loud. Inheritance: "`Cat` **is an** `Animal`" — the relationship is written in the code, and `Cat` carries whatever the hierarchy decides to put in it. Composition: "this `Animal` **has a** `SpeakingBehavior`, and today it's the cat one" — the relationship is written at wiring time, in data. The speaking cat's identity no longer comes from `extends Cat`; it comes from what it was assembled out of. Same public surface, same `speak()` call — but composition is doing the job inheritance was doing, so the hierarchy could be deleted. That is also where the wrapper went: `class Cat` had only the wiring in it, and nothing else.

|  | OO 101 | Injected |
| --- | --- | --- |
| Who owns the behavior | the class, hardcoded | the behavior, injected |
| Add a new dialect | edit `Cat`'s code | write a new `SpeakingBehavior` |
| New kind of animal | new subclass | `new Animal(behavior)` |
| Tests | needs the real cat code | runs with a fake |

One honest guardrail: if animals *do* more than speak — a `Cat` with `purr()` — the subclasses still earn their place, and the decision becomes the real question of *when subtype polymorphism is worth it* ([two reasons for inheritance](../../38-two-reasons-for-inheritance), [when to use subtype polymorphism](../../42-when-to-use-subtype-polymorphism) — both notes are also Okhravi's).

## Deferring `new` — and the honest trade-off

Push the same move further and a pattern appears:

> You can always inject dependencies instead of instantiating them. ... That's ... why people say that the `new` keyword is dangerous. You should always be wary when you see the new keyword: is this really the correct place to couple to a concretion instead of an abstraction?

> You can always defer instantiating upward, backward, out of the system, right towards the `main` of your program.

"In some sense you could instantiate all of the players in the main of your system and then have no `new` keywords in the rest of your system." That is the answer to the earlier caveat — yes, at some point someone must create concretes: the edge does. `main` is allowed to `new`; everything below it should receive. The place that assembles the object graph is variously called the composition root or the main.

Okhravi also warns against taking this "to its extreme ... in absurdum" — "dependency injection into madness," a system where every constructor takes fifteen things so `main` controls everything:

> A little bit of dependency injection is better than no dependency injection. A little bit of inversion is better than no inversion — which you'll discover when you, for example, try to test your units in isolation, or when you try to quickly respond to new requirements without constantly having to change all of the code.

So the practical bar is not perfection: it is worth applying where it pays — the seams that change, and the boundaries you want to test. Stable leaves can keep their `new`.

## DIP, DI, IoC

- **DIP** says which *direction*: both policy and detail point at an abstraction.
- **DI** is the *act* of supplying the dependency from outside; constructor and parameter injection say *where*.
- **IoC** is the umbrella — the framework, not your code, controls part of the flow, including object creation. DI "into madness," where `main` wires everything, is exactly where hand-wiring stops scaling and a **DI container** (a tool, not a principle) takes over. Full untangling: [Inversion of Control](../../02-inversion-of-control).

## How it connects

| Question | Principle |
| --- | --- |
| Who can force this module to change? | [SRP](../01-srp) |
| How do I add behavior without editing tested code? | [OCP](../03-ocp) |
| Can this subtype stand in for the base type? | [LSP](../04-lsp) |
| What does this client actually depend on? | [ISP](../05-isp) |
| Which direction should the dependency point? | **DIP** |

- **DIP and ISP.** DIP says depend on an abstraction; [ISP](../05-isp) says the abstraction should be narrow and client-shaped — depend on the *role you use*, not the implementer's entire surface.
- **DIP and LSP.** Injection makes substitution possible; [LSP](../04-lsp) is about whether a substitute is *safe*. Swapping `CatSpeakingBehavior` for a fake only pays off if every implementation honors what `SpeakingBehavior` promises.
- **DIP and strategy.** An injected `SpeakingBehavior` *is* a strategy — the Strategy pattern, and its tension with subtype polymorphism, is covered in [Strategy vs Subtype Polymorphism](../../34-strategy-vs-subtype-polymorphism) and [Inheritance vs Composition](../../36-inheritance-vs-composition).

## Where it came from

Martin introduced the principle in the 1996 C++ Report article. The explanation and the animal example follow [Okhravi's Code Walks 004](https://www.youtube.com/watch?v=S9awxA1wNNY), including the vocabulary staircase (inversion → injection → where) and the "you might not need subtypes" turn. Source-code dependencies pointing *against* the flow of control — policy calling detail's interface, detail calling back into policy's — is how Martin frames the same move in *Clean Architecture* (ch. 11, "DIP").

## One-line summary

**High-level policy and low-level detail should meet at an abstraction, not at each other: never couple to a concretion — inject the dependency (constructor or parameter) and let** `main` **be the one place that creates concretes; the payoff is swappable behavior, isolated tests, and often no subtype hierarchy at all.**

## References

- Christopher Okhravi — *Dependency Inversion — how, what, why? (examples in C#) | Code Walks 004* — <https://www.youtube.com/watch?v=S9awxA1wNNY>
- Robert C. Martin — *The Dependency Inversion Principle*, C++ Report (May 1996) — <https://web.archive.org/web/20160730170203/http://www.objectmentor.com/resources/articles/dip.pdf>
- This repo — [Inversion of Control](../../02-inversion-of-control) (IoC vs DI, containers, service locator), [Strategy vs Subtype Polymorphism](../../34-strategy-vs-subtype-polymorphism), [Inheritance vs Composition](../../36-inheritance-vs-composition), [Two reasons for inheritance](../../38-two-reasons-for-inheritance), [When to use subtype polymorphism](../../42-when-to-use-subtype-polymorphism)