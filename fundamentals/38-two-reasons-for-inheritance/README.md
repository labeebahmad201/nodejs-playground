# Two reasons for inheritance

*Inheritance ships two independent capabilities in one keyword: **hierarchical reuse of code** and
**subtype polymorphism**. You cannot take one and decline the other, so the decision is not "is
there code to share?" or "do I want polymorphism?" but "do I want both, at once?" If the answer is
one or the other, the language already has a cheaper construct that gives you exactly that and
nothing more.*

## The two capabilities

| Capability | What it buys | What it costs |
| --- | --- | --- |
| Hierarchical reuse | subclasses run the parent's implementation; the shared body lives once, up the tree | a parent whose implementation you accept **whole** |
| Subtype polymorphism | callers code against one type; any subtype can be passed | a contract every subtype honors |

They are orthogonal. A `Shape` hierarchy needs polymorphism with zero shared code; a CSV helper
needs reuse with zero polymorphism. Inheritance couples the two decisions into one.

```ts
interface Shape { area(): number }

class Circle implements Shape {
  constructor(private radius: number) {}
  area(): number { return Math.PI * this.radius ** 2; }
}

class Square implements Shape {
  constructor(private side: number) {}
  area(): number { return this.side ** 2; }
}

const shapes: Shape[] = [new Circle(1), new Square(2)]; // polymorphism only
```

`Circle` and `Square` share no implementation and lose nothing — there was nothing to share.
The contract is the whole of what callers need; `implements` delivers exactly that.

## Want both → an abstract base is the natural fit

```ts
abstract class Importer {
  run(file: File): void {
    for (const row of this.parse(file)) this.save(row); // written once
  }
  protected abstract parse(file: File): Row[];          // varies
  protected abstract save(row: Row): void;              // varies
}

class CsvImporter extends Importer { /* parse + save */ }
class JsonImporter extends Importer { /* parse + save */ }

function importAll(importers: Importer[], file: File): void {
  for (const importer of importers) importer.run(file); // needs the subtype
}
```

Both capabilities are load-bearing here: callers need an `Importer` (subtyping), and the loop is
written once for all formats (reuse). An interface would lose the loop; a standalone helper would
lose the subtype. This is Template Method, and it is the shape inheritance was designed for.

## The bundle is all-or-nothing

The two capabilities cannot be split up at the use site:

- **Reuse without subtyping** → `class BillingService extends BaseService` only to call
  `this.log()`. The class is now a `BaseService` at every call site, forever.
- **Subtyping without reuse** → that is an interface. Extending a *concrete* class for the
  contract is strictly worse: the parent's body comes along for no reason.
- **Reuse of part of the API** → impossible. `class Stack extends Array` cannot decline `splice`,
  `sort`, or index assignment; the stack invariant depends on callers not using half their type.

And what arrives is more than a method list:

1. every public and protected member;
2. the parent's **internal call graph** — its methods call its own methods, so your overrides fire
   from inside code you never wrote;
3. the parent's **future** — its next release is a change to your class.

That is what "locked in" means: not just that you got functions you did not want, but that your
object is usable in places you never intended and must keep working against a body you do not own.

## Why composition is the picky option

You can be picky in two directions, and composition is the only construct that gives you both:

```ts
class Stack<T> {
  private items: T[] = [];

  push(item: T): void { this.items.push(item); }
  pop(): T | undefined { return this.items.pop(); }
  get size(): number { return this.items.length; }
}
```

- **Picky about what I use** — hold exactly the collaborator you need (`Csv`, `Logger`), or, in a
  structurally typed language, accept just the shape you call: `{ toCsv(rows: Row[]): string }`.
- **Picky about what I must be** — expose `push`/`pop`/`size` and nothing else. No consumer can
  ask this `Stack` to behave like an `Array`.

Inheritance gives you the opposite in both directions: the whole collaborator, and the whole
public surface.

## Couple to abstractions

`extends Foo` binds the subclass to `Foo`'s **implementation**, while callers only ever needed
`Foo`'s **contract**. Interfaces and collaborators let each side depend on the contract alone — and
the subclass, which is the only party that needs the body, is precisely the party that gets locked
to it.

## The decision, in order

1. Do callers need to treat two or more implementations uniformly? (polymorphism)
2. Do those implementations share a body that belongs to all of them? (reuse)
3. **Both** → inherit, with an abstract base and explicit hooks.
4. **Only 1** → interface.
5. **Only 2** → collaborator or free function.
6. Both, but the shared body is partial or varies on a second axis → interface plus composition.

## Nuance

- **Wanting both is necessary, not sufficient.** The is-a must still hold behaviorally (LSP) and
  the shared body must be safe to see (white-box reuse). See
  [Inheritance vs composition](../36-inheritance-vs-composition).
- **Inheritance buys fewer pieces, not unique power.** An interface plus a shared free function
  can emulate both halves; what inheritance removes is the wiring, not the possibility.
- **C++ makes the split literal.** *Private* inheritance is "reuse without subtyping" — the
  language has a form for each half. Java and TypeScript do not, so the halves get confused into a
  public is-a claim that may not be meant.
- **Languages that drop class inheritance force the separation.** Go offers struct embedding for
  reuse and interfaces for subtyping, and the two are never one keyword.

## One-line summary

**Inheritance is two capabilities bundled — hierarchical code reuse and subtype polymorphism — and
it is justified only when you want both, because the bundle is all-or-nothing: want just the
contract and take an interface, want just the code and take a collaborator.**

## References

- Christopher Okhravi — *Only Use Inheritance If You Want Both of These* (30 Apr 2024),
  <https://www.youtube.com/watch?v=C3B5IIlt4-0> — chapters: *Only Hierarchical Reuse* (0:21),
  *Only Subtype Polymorphism* (3:16), *Avoid Inheritance?* (5:37), *Couple to Abstractions* (7:13),
  *Example* (7:32). The framing is his; the TypeScript examples here are mine.
- Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides — *Design Patterns* (1994) — interface
  versus implementation inheritance; "favor object composition over class inheritance"
- Joshua Bloch — *Effective Java* (3rd ed.), Item 18 — "Favor composition over inheritance"
- Barbara Liskov — *Data Abstraction and Hierarchy* (1987); Barbara Liskov, Jeannette Wing —
  *A Behavioral Notion of Subtyping* (1994)
- This repo — [Inheritance vs composition](../36-inheritance-vs-composition), [Strategy vs subtype
  polymorphism](../34-strategy-vs-subtype-polymorphism), [Strategy
  pattern](../35-strategy-pattern), and the [SOLID overview](../32-solid)
