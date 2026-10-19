# Open/Closed Principle (OCP)

*Software entities should be **open for extension but closed for modification** — you should be
able to add new behavior by adding new code (a new implementation of an abstraction), not by
editing existing code that already works and is already tested.*

## The principle

The canonical statement (Robert C. Martin's paraphrase of Meyer, and the wording everyone quotes):

> Software entities (classes, modules, functions, etc.) should be open for extension, but
> closed for modification.

- **Open for extension** — the behavior of the module can grow. New requirements, new variants,
  new use cases: all reachable.
- **Closed for modification** — growing it doesn't mean editing it. The existing source stays
  untouched while the new behavior arrives.

Read literally the two halves contradict each other: how can something grow if you may not change
it? The resolution is **abstraction**. The stable module depends not on concrete variants but on
an abstraction (an abstract class or interface). New behavior is a new *implementation* of that
abstraction — so the abstraction (and everything using it) can stay fixed while its behavior
becomes unbounded.

**Who gave this:** the term was coined by **Bertrand Meyer** in *Object-Oriented Software
Construction* (1988, p. 23), where "open" and "closed" described library classes and their
extension through inheritance. It became the **O** in SOLID through **Robert C. Martin**, whose
1996 C++ Report column "The Open-Closed Principle" reframed it around abstract interfaces and
polymorphism. Martin's *Clean Architecture* Ch. 8 restates it as:

> A software artifact should be open for extension but closed for modification.

## What problem it solves

Modifying code that already works is where the risk lives:

- **Every edit can break things.** Changing a tested module re-opens it for bugs and forces
  re-verification of everything that depends on it. Extending by *adding* leaves the tested code
  as tested.
- **The change author inherits the whole test suite.** Editing the central branch is not a local
  edit: before the change can be trusted, the author has to be confident that every existing
  **unit test** and every **system-level test** still passes — including the paths for variants
  they never looked at. The `circle` branch the author didn't think about is now their
  responsibility to keep green. Extending by *adding* a class makes those tests untouched by
  construction, and the new variant arrives with its own tests — so confidence is *added*, not
  *re-established* across everything that already worked.
- **The `if/else` (or `switch`) on type grows forever.** The usual shape of a violation: one
  central function branches on "what kind of thing is this." Every new variant edits that
  function — and in a real codebase, that same branch is repeated across many functions. Adding
  a variant becomes "hunt down every switch statement" — the exact cascade that makes a design
  fragile and rigid (Martin's words from the 1996 article).

| | `if/else` on type | Abstraction + polymorphism |
| --- | --- | --- |
| Adding a new variant | edit the central function(s) | add one new class |
| Existing code touched | yes — re-verify unit and system tests | no |
| Risk of the change | spread across branches everywhere | contained in the new file |
| Central function grows | with every variant | never |

## The Shape example

This is the classic illustration — Martin's own example from the 1996 article, in the `getArea`
form (it also appears as `Geometry.area` in *Clean Code* Ch. 6). **The violation** — a central
function that must be edited for every new shape:

```ts
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; side: number };

function getArea(shape: Shape): number {
  if (shape.kind === "circle") return Math.PI * shape.radius ** 2;
  if (shape.kind === "square") return shape.side * shape.side;
  throw new Error(`unknown shape: ${shape.kind}`); // every new shape edits this function
}
```

Add a `triangle` and you edit `getArea` — plus every other function that branches on
`shape.kind`. **The OCP version** — an abstraction holds the contract, variants implement it:

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

function totalArea(shapes: Shape[]): number {
  return shapes.reduce((sum, shape) => sum + shape.getArea(), 0);
}
```

Now adding `Triangle` is a **new file** — one more class extending `Shape`. `Shape`, `Circle`,
`Square`, and `totalArea` are not touched, not re-tested, not re-read. The code is open (a new
shape is always expressible) and closed (nothing existing changes). An `interface Shape {
getArea(): number }` with `implements` is the same idea — the abstract class is just the textbook
presentation.

## When a switch is fine

The smell is not the keyword. For a branch to be an OCP problem, two conditions have to hold: it
**grows with every new variant**, and it is **repeated across the codebase**. When only one holds
— or neither — the switch is ordinary code. Three referenced examples:

**1. A branch over a stable, externally-defined set.** HTTP methods are fixed by the standard, not
by your product — RFC 9110 (*HTTP Semantics*, §9 Methods) defines
`GET`/`HEAD`/`POST`/`PUT`/`DELETE`/`CONNECT`/`OPTIONS`/`TRACE`, and new ones land in the IANA
registry, not in your backlog. So a method dispatch is closed against *your* changes: each feature
adds a route, none adds a method.

```ts
switch (req.method) {
  case "GET":    return read(req);
  case "POST":   return create(req);
  case "PUT":    return replace(req);
  case "DELETE": return remove(req);
  default:       return methodNotAllowed();
}
```

**2. The switch that appears exactly once.** Robert C. Martin's rule, from *Clean Code*, Ch. 3
("Switch Statements"):

> My general rule for switch statements is that they can be tolerated if they appear only once,
> are used to create polymorphic objects, and are hidden behind an inheritance relationship so
> that the rest of the system can't see them.

A factory is the canonical home — the single place allowed to know the full variant list:

```ts
function createShape(kind: "circle" | "square"): Shape {
  switch (kind) {
    case "circle": return new Circle(1);
    case "square": return new Square(1);
  }
}
```

Adding `Triangle` touches this one function; `Shape`, `totalArea`, and every consumer stay
untouched. Martin's own example is payroll, and it shows both halves at once: `Employee.calculatePay()`,
`isPayday()`, and `deliverPay()` each switching on employee type is the violation; moving that
switch into one `EmployeeFactory` that returns polymorphic `Employee` objects is the tolerated fix.

**3. The smell: the same switch, repeated.** Martin Fowler's *Refactoring* (2nd ed.) names it the
**Repeated Switches** smell — the same conditional switching logic "pops up in different places,"
and it is specifically the *repetition* that makes it a smell. Same `kind` branch in `totalArea`,
`printShape`, and `exportShape`: adding `Triangle` means hunting down all three. The remedy has a
name too: **Replace Conditional with Polymorphism**.

## Nuance

- **Closure is strategic, never total.** No artifact can be closed against *all* future change,
  and pretending otherwise produces speculative abstraction and indirection for changes that
  never come. You pick the axis of variation you expect and close along that — Martin's own later
  point: choose the most likely axes of change.
- **OCP chooses which future change stays cheap — it doesn't make all change cheap.** This is the
  expression-problem trade. With polymorphism, adding a new **type** (`Triangle`) is free, but
  adding a new **operation** (`getPerimeter`) now means editing every shape class. The `if/else`
  version is the reverse: new operation = one function, new type = every switch. The trade-off is
  real; OCP is the right optimization when "more variants" is the change you actually expect.
- **A `switch` is not automatically a violation.** Branching on a stable set that won't grow
  (HTTP methods), or a switch that appears exactly once (in a factory), is fine. The smell is a
  branch that *grows with every new variant* and is *repeated across the codebase* — see
  [When a switch is fine](#when-a-switch-is-fine).
- **The seam belongs where change actually happens.** Closing along a guessed axis buys nothing;
  closing along an observed one pays for itself. (Compare [SRP](../01-srp): SRP decides *who* may
  share a module; OCP decides *which variation* earns its own seam.)
- **"Closed for modification" is about new behavior, not a literal freeze.** Bug fixes still edit
  code. The principle says new *features* shouldn't require reopening stable code.

## One-line summary

**Software entities should be open for extension but closed for modification — add new behavior
as a new implementation of a stable abstraction (a `Triangle` extending `Shape.getArea`) instead
of editing existing, tested code with another `if/else` branch; close along the axis of change you
expect, because you can't close everything.**

## References

- Bertrand Meyer — *Object-Oriented Software Construction* (1988), p. 23 — origin of the term
- Robert C. Martin — *The Open-Closed Principle*, C++ Report (January 1996) — the article that
  popularized it and the source of the Shape example —
  <https://www.cs.utexas.edu/~downing/papers/OCP-1996.pdf>
- Robert C. Martin — *Clean Architecture*, Ch. 8 (OCP)
- Robert C. Martin — *Clean Code*, Ch. 3 ("Switch Statements": the single tolerated factory
  switch, and the payroll-methods violation) and Ch. 6 (the `Geometry.area` vs.
  polymorphic-shapes comparison)
- Martin Fowler — *Refactoring* (2nd ed.) — the **Repeated Switches** smell and *Replace
  Conditional with Polymorphism*
- RFC 9110 — *HTTP Semantics*, §9 (Methods) —
  <https://www.rfc-editor.org/rfc/rfc9110.html#section-9>
- IANA — *HTTP Method Registry* —
  <https://www.iana.org/assignments/http-methods/http-methods.xhtml>
- Wikipedia — *Open–closed principle* (covers Meyer's inheritance version, Martin's polymorphic
  version, and Larman's link to Protected Variations) —
  <https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle>
- Craig Larman — *Protected Variation: The Importance of Being Closed*, IEEE Software (2001)
