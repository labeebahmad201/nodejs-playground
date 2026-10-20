# Liskov Substitution Principle (LSP)

*Wherever your code uses a supertype, every subtype must be usable in its place without the client
breaking. Read alone, that is a definition with no motive — which is why it gets repeated as dogma,
a rule about squares and rectangles. The motive lives one step earlier: object-oriented design is
change management, subtype polymorphism exists so that adding a type does not mean editing a
function, and LSP is what decides whether a new subtype is still an extension or a modification of
every client that used the base.*

## The definition

Take a supertype `T` and its subtypes `S1 ... Sn`. Any code written against `T` — a parameter, a
field, an array element, a variable — must keep working when it is handed any `Si` instead. Same
result, same promises, no edits on the client side.

If one substitution makes a client misbehave, `Si` violates the principle and `T`'s hierarchy is
broken — even though every class compiles and every subtype is a correct implementation of its own
idea. The test is not "is the subtype well written?" It is "does a client that only knows the base
type notice the difference?"

The rest of this note is the reasoning behind that test. If you start from the definition, it reads
as a rule to memorize. Start from the problem it solves, and it is the only sensible answer.

## Why we care: OOP is change management

Object-oriented design is not a way to draw class diagrams. It is a way to keep the cost of change
low: when the next feature arrives, how much working code has to be edited, and how much confidence
has to be re-established before the change can be trusted?

That is the [Open/Closed Principle](../03-ocp): extend by adding code, don't modify code that
already works. Bug fixes are the exception — fixing a bug *is* editing code, and no principle
changes that. Feature growth is where the rule applies: a new feature should be a new class, not an
edit to a function that is already tested and working.

The cost being avoided is concrete. Every edit to a working function re-opens everything that guards
it:

- its **unit tests**, because the branch that changed is the one they assert;
- its **integration tests**, because its collaborators now see a slightly different module;
- its **end-to-end paths**, because behavior the system exposes may have moved.

So "just add an `if`" is not a local change. It transfers the verification burden for that function
to whoever added the branch — for a function they did not need to touch. Adding a subtype instead
leaves the function and its tests exactly as they were, and the new subtype arrives with its own
tests. The **blast radius** of adding a type is the new file.

## The scenario: the conditional that grows

This is the shape the principle exists for. One function, deciding what to do from the type of the
object it received:

```ts
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; side: number };

function areaOf(shape: Shape): number {
  if (shape.kind === "circle") return Math.PI * shape.radius ** 2;
  return shape.side ** 2;
}
```

Every new variant edits `areaOf`. And `areaOf` is rarely alone: `render`, `export`, `hitTest` all
ask the same "what kind is this?" question, so adding `triangle` means editing all of them and
re-verifying all of them. That repetition is the real cost, not the keypress — one new concept
spread across every function that dispatches on it.

## The polymorphic version: one call, dispatch at runtime

Replace the branch with a method on the supertype:

```ts
abstract class Shape {
  abstract area(): number;
}

class Circle extends Shape {
  constructor(private readonly radius: number) { super(); }
  area(): number { return Math.PI * this.radius ** 2; }
}

class Square extends Shape {
  constructor(private readonly side: number) { super(); }
  area(): number { return this.side ** 2; }
}

function totalArea(shapes: Shape[]): number {
  let total = 0;
  for (const shape of shapes) total += shape.area(); // one call for every variant
  return total;
}
```

The conditional is gone. `totalArea` accepts the supertype, so any subtype can be passed in, and at
runtime each object runs its own `area()`. Adding `Triangle` is one new class: `Shape`,
`totalArea`, and every other client are untouched, and their existing tests still assert exactly
what they asserted before. X branches became one call, and the function stopped being a place where
change accumulates.

| | `if`/`switch` on type | Subtype polymorphism |
| --- | --- | --- |
| Add a subtype | edit every function that dispatches | add one class |
| Client functions touched | yes | no |
| Tests to re-establish | for each edited function | none — the new subtype brings its own |
| The function's source | grows with every variant | fixed |

## The part that makes it work: the client cannot see the subtype

`totalArea` has no idea what it received. It holds a `Shape`, calls `area()`, and trusts that the
call means what `Shape` says it means. That is the whole benefit — and the whole risk.

If a subtype redefines what `area()` means, `totalArea` silently returns a different number. The
signature did not change, so the compiler is satisfied. The function's tests still pass for the
shapes they instantiate. The break appears only in production, in a client that was never edited.

Subtype polymorphism is therefore safe under exactly one condition: **every subtype must honor the
contract of the base type as a client observes it.** That condition is the Liskov Substitution
Principle.

This is also the sense in which LSP is tied to OCP: if adding a subtype can break an existing
client, then adding that subtype *was* a modification, and the code was never closed. OCP asks for
the seam; LSP is what keeps the seam sound.

## Overriding changes the implementation, not the contract

A subtype is allowed to override a method — that is the mechanism. What it may change is **how** the
answer is produced: the algorithm, the data structures, the collaborators, the private state, the
performance. What it may not change is **what the client observes**:

- if the method is supposed to return something, it returns that thing — same meaning, not merely
  the same type;
- the same state transitions, the same errors where the base promises errors, the same side effects
  where the base promises them.

The implementation is the subtype's business. The contract is the client's. An override that
renegotiates the contract is not polymorphism; it is a different abstraction sharing a name.

That is why the payoff compounds. With a contract in place, you can keep adding subtypes and the
client code keeps working — that is the property the whole refactor is for. Without it, every new
subtype is a new chance to break the clients that were supposed to be closed.

## Square extends Rectangle, through the client's eyes

The canonical failure, because both classes are individually correct:

```ts
class Rectangle {
  constructor(protected width: number, protected height: number) {}

  setWidth(width: number): void { this.width = width; }     // height is untouched
  setHeight(height: number): void { this.height = height; } // width is untouched

  area(): number { return this.width * this.height; }
}

// A client, written once, against the base type.
function resize(rect: Rectangle): number {
  rect.setWidth(5);
  rect.setHeight(4);
  return rect.area(); // 20 for every Rectangle
}
```

```ts
class Square extends Rectangle {
  constructor(side: number) { super(side, side); }

  override setWidth(width: number): void { this.width = width; this.height = width; }
  override setHeight(height: number): void { this.width = height; this.height = height; }
}
```

```ts
resize(new Rectangle(3, 4)); // 20
resize(new Square(3));       // 16 — same function, same signature, different answer
```

| Step | `Rectangle(3, 4)` | `Square(3)` |
| --- | --- | --- |
| start | 3 × 4 | 3 × 3 |
| `setWidth(5)` | 5 × 4 | 5 × 5 |
| `setHeight(4)` | 5 × 4 | 4 × 4 |
| `area()` | **20** | **16** |

At `setWidth(5)`, `Rectangle` keeps its height; `Square` drags the height along, which is correct
for a square. By `setHeight(4)`, the rectangle is 5 × 4 and the square is 4 × 4. The client changed
nothing, the signature changed nothing, the compiler is happy — and the answer changed. That is a
substitution the client noticed.

Neither class is wrong on its own. `Square` keeps its sides equal; `Rectangle` keeps its dimensions
independent. The lie is in the `extends`: it claims a `Square` can stand in wherever the base
promises two independent dimensions, and it cannot. Geometry says a square is a rectangle; this API
says a `Rectangle` is "two independent dimensions", which is not what a square is. The base type is
the contract, not the shape.

What to do instead:

- **Drop the inheritance.** `Square` and `Rectangle` both implement a `Shape` with `area()`. A
  client that needs independent dimensions takes the type that promises them.
- **Remove the mutation.** An immutable `Rectangle` makes no promise about its dimensions after a
  setter, so `Square extends Rectangle` is safe — there is no contract left to break.
- **Name the client's requirement.** If resizing is a real need, put `setWidth`/`setHeight` on an
  interface implemented only by types that can honor it. `Square` never claims to be one.

## Signatures follow the same logic

Overriding also changes the method's type, and the same client-first reasoning applies there. This
is where the rule becomes concrete enough to check in code.

### Parameters may only stay the same or get more general

The parameter belongs to its own hierarchy, and it is not the class's hierarchy. In this example,
renderers draw *onto* something: that something is the parameter. `Canvas` is not a subtype of
`Renderer` — it is a subtype of `Surface`, the type the base method accepts. That is exactly the
narrowing this section is about.

```ts
// The parameter's hierarchy — independent of the receiver's.
abstract class DrawTarget {
  abstract paint(color: string): void;
}

class Surface extends DrawTarget {
  paint(color: string): void { /* ... */ }
}

class Canvas extends Surface {
  paint(color: string): void { /* ... */ }
}

class Wall extends Surface {
  paint(color: string): void { /* ... */ }
}

// The receiver's hierarchy.
class Renderer {
  render(surface: Surface): void { /* ... */ }
}

// A client, written once, against the base type.
function renderAll(renderers: Renderer[], surface: Surface): void {
  for (const renderer of renderers) renderer.render(surface);
}

renderAll([new Renderer()], new Wall()); // valid: a Wall is a Surface
```

Now a subtype narrows the parameter:

```ts
class ChartRenderer extends Renderer {
  override render(canvas: Canvas): void { /* ... */ } // only a Canvas will do
}

// Still compiles: ChartRenderer is a Renderer, and a Wall is a Surface.
renderAll([new ChartRenderer()], new Wall()); // at runtime, ChartRenderer gets a Wall
```

`Canvas` is a type the base method never mentioned. Every call site written against `Renderer` may
pass any `Surface`; this override accepts only one branch of that hierarchy. The new type does not
stay inside the subtype — it leaks out. To keep `renderAll` working, someone has to learn about
`Canvas` and thread it through the call sites, which is precisely the client edit this design was
supposed to prevent. Depending on the language, the client either stops compiling or fails at
runtime; either way, the client is where the damage shows.

The rule: **an override's parameter type must be the same as the base's, or more general.** More
general means it accepts everything the base accepted, plus more. The base takes a `Surface`; taking
a `DrawTarget` is legal, because every `Surface` is a `DrawTarget`. The same subtype, widened:

```ts
class ChartRenderer extends Renderer {
  override render(target: DrawTarget): void { /* ... */ } // every Surface, and more
}
```

Every call site written against `Renderer` still compiles, and it never needs to know the subtype's
type. Note what "more general" is measured against: the **base method's parameter type**, not the
class that declares the method. Accepting a `Renderer` here would not be more general — renderers
are a different hierarchy, and accepting only renderers would be another narrowing.

### Return types may only stay the same or get more specific

The same argument on the way out: a client typed against the base's return value must still be able
to use what it receives. Narrowing the return (returning a `Circle` where the base promised a
`Shape`) is safe; widening it (returning `number | string` where the base promised `number`) forces
every caller to handle a case the base never promised.

| Position | Allowed in the override | What the client sees |
| --- | --- | --- |
| parameter | same, or more general (contravariant) | call sites keep passing what they already pass |
| return | same, or more specific (covariant) | call sites keep using the value they already get |
| behavior | the same observable results | the client does not know a subtype is there |

The shorthand: a subtype may **require less** and **promise more**, never the reverse.

### Where the rule comes from

- **Liskov & Wing, *A Behavioral Notion of Subtyping* (1994)** — a subtype may *weaken* a
  precondition and must *strengthen* a postcondition; strengthening the precondition or weakening
  the postcondition is forbidden. The parameter type is the precondition: widening it accepts
  every input the base accepted, and more; narrowing it strengthens the precondition, which is the
  direction the rule forbids.
- **Bertrand Meyer, *Object-Oriented Software Construction* (1988)** — Design by Contract, quoted
  by Martin in the LSP article: "when redefining a routine [in a derivative], you may only replace
  its precondition by a weaker one, and its postcondition by a stronger one."
- **Function subtyping** — in type theory, function types are contravariant in their parameters and
  covariant in their result: `S2 → T1` is a subtype of `S1 → T2` when `S1 <: S2` and `T1 <: T2`
  (Pierce, *Types and Programming Languages*, ch. 15). "Contravariant parameter" is the formal name
  for "same or more general"; "covariant return" is "same or more specific".

### What the compiler checks

TypeScript enforces the return half. In `strict` mode, widening an override's return type is a build
error. It does not enforce the parameter half for methods: method overrides are compared
bivariantly, so `render(canvas: Canvas)` over `render(surface: Surface)` compiles — and the call
above compiles with it, failing only at runtime, inside the client that passed a `Wall`.
`strictFunctionTypes` closes the hole for plain function values (a property or callback typed
`(surface: Surface) => void` cannot be assigned `(canvas: Canvas) => void`), but method declarations
stay bivariant even under `strict`.

That asymmetry is the everyday shape of LSP: some of it lives in the signature, where a checker can
see it, and the rest is a promise. The types tell you which promises exist; tests are how you find
out whether a subtype kept them.

## Where it came from

Barbara Liskov formulated the principle in her 1987 OOPSLA keynote, *Data Abstraction and
Hierarchy*, while working through inheritance as a reuse mechanism. The insight is not about
squares. It is about what inheritance has to guarantee before the reuse is real: code written
against a supertype is reusable with a subtype only if the subtype can stand in without the code
noticing. If it cannot, the subtype is not an extension of the abstraction — it is a different
abstraction sharing a name, and the polymorphism that promised to isolate the client leaks the
client's assumptions back into view. In her framing, the substitution property is what a subtype
*is*; without it, the hierarchy is a naming convention.

Liskov and Jeannette Wing made that precise in 1994 (*A Behavioral Notion of Subtyping*): a subtype
may weaken preconditions, strengthen postconditions, preserve invariants, and may not add observable
state changes the base forbids — the formal versions of the rules above, plus the behavioral rule
that no signature can express.

Robert C. Martin named it the **Liskov Substitution Principle** in his 1996 C++ Report column, from
the same series as the [Open/Closed Principle](../03-ocp), and drew the connection this note is
built on: a subtype that breaks its clients turns an extension into a modification.

## Why it matters

- **The benefit of subtype polymorphism is stable client code, and LSP is what makes that true.**
  The conditional does not disappear for elegance; it disappears so the function stops being edited
  when types are added. A subtype that breaks the contract reinstates the edit — not in the source,
  but in the verification and the assumptions, which is where the cost was all along.
- **It is the test for whether an `extends` is honest.** When you write a subclass, the question is
  not "does it compile?" but "would a client that only knows the base notice?" If yes, the is-a is
  false: compose instead of inheriting, or narrow the base contract until the promise is true.
- **It bounds the blast radius of adding a type.** With the contract held, a new subtype is a new
  file plus its tests, and the clients stay closed. Without it, every subtype is a potential edit to
  every client that used the base.

Related:

- [Open/Closed Principle](../03-ocp) — the seam LSP keeps sound
- [Two reasons for inheritance](../../38-two-reasons-for-inheritance) — reuse *and* substitutability;
  if you only want the reuse, compose
- [Strategy vs subtype polymorphism](../../34-strategy-vs-subtype-polymorphism) — once behavior
  varies, subtype or injected strategy?
- [When to use subtype polymorphism](../../42-when-to-use-subtype-polymorphism) — a hierarchy is
  justified when the variants do different things; a conditional over a closed set may be cheaper

## One-line summary

**Wherever code uses a supertype, any subtype must fit without the client noticing — parameters may
only widen, returns may only narrow, and observable behavior must not change — because the whole
payoff of subtype polymorphism is that adding a type never edits the client, and an override that
breaks the base's promise turns that extension back into a modification.**

## References

- Barbara Liskov — *Data Abstraction and Hierarchy* (OOPSLA '87 keynote; SIGPLAN Notices 23(5),
  1988) — the substitution property —
  <https://web.archive.org/web/20200621040810/https://klevas.mif.vu.lt/~plukas/resources/OODPrinciples/Liskov1987.pdf>
- Barbara Liskov, Jeannette Wing — *A Behavioral Notion of Subtyping*, ACM TOPLAS 16(6), 1994 —
  preconditions, postconditions, invariants, and the history rule —
  <https://doi.org/10.1145/197320.197383>
- Bertrand Meyer — *Object-Oriented Software Construction* (1988) — Design by Contract: the
  precondition/postcondition rule for redefinitions
- Robert C. Martin — *The Liskov Substitution Principle*, C++ Report (March 1996) — the name, the
  Square/Rectangle example, the link to OCP, and the Design by Contract rule quoted from Meyer —
  <https://www.cs.utexas.edu/~downing/papers/LSP-1996.pdf>
- Benjamin C. Pierce — *Types and Programming Languages* (2002), ch. 15 — function subtyping is
  contravariant in its parameters and covariant in its result
- TypeScript 2.6 release notes — "Strict function types": the check applies to function types, not
  to method declarations, which is why a narrowing method override still compiles —
  <https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-6.html>
- Martin Fowler — *Refactoring* (2nd ed.) — the **Repeated Switches** smell and *Replace
  Conditional with Polymorphism*
- Wikipedia — *Liskov substitution principle* — the concise statement and the Square/Rectangle
  code — <https://en.wikipedia.org/wiki/Liskov_substitution_principle>
- This repo — [Open/Closed Principle](../03-ocp), [Strategy vs subtype
  polymorphism](../../34-strategy-vs-subtype-polymorphism), [Two reasons for
  inheritance](../../38-two-reasons-for-inheritance), [When to use subtype
  polymorphism](../../42-when-to-use-subtype-polymorphism)
