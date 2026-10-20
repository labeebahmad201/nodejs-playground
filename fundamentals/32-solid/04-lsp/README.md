# Liskov Substitution Principle (LSP)

*An object of a subtype must be usable anywhere the base type is expected, without changing the
behavior clients rely on. The compiler checks the method signatures; LSP checks the promises behind
them. `Square extends Rectangle` is the canonical failure: the geometry is right, but the
`Rectangle` API promises that `setWidth` leaves the height alone — and a square cannot keep that
promise.*

## The promise in the base class

`Rectangle` has two independent dimensions:

```ts
class Rectangle {
  constructor(protected width: number, protected height: number) {}

  // setWidth changes width only; height is untouched.
  setWidth(width: number): void { this.width = width; }

  // setHeight changes height only; width is untouched.
  setHeight(height: number): void { this.height = height; }

  area(): number { return this.width * this.height; }
}
```

The signatures say `setWidth(width: number): void`; they do not say what happens to `height`. The
contract does:

- after `setWidth(w)`: `width === w`, and `height` is unchanged;
- after `setHeight(h)`: `height === h`, and `width` is unchanged;
- `area()` is `width × height`.

A client uses only that contract:

```ts
// Make the rectangle 5 × 4.
function resize(rect: Rectangle): number {
  rect.setWidth(5);
  rect.setHeight(4);
  return rect.area();
}

resize(new Rectangle(3, 4)); // 20
```

The function is correct for every `Rectangle`. It does not know whether the object is also a square,
and the base type says it does not need to.

## The Square that cannot keep it

```ts
class Square extends Rectangle {
  constructor(side: number) { super(side, side); }

  // A square keeps both sides equal, so setting one sets both.
  override setWidth(width: number): void {
    this.width = width;
    this.height = width;
  }

  override setHeight(height: number): void {
    this.width = height;
    this.height = height;
  }
}
```

The override is correct for a square: the sides stay equal. But it changes the behavior the base
class promised. Step through `resize(new Square(3))`:

| Step | `Rectangle(3, 4)` | `Square(3)` |
| --- | --- | --- |
| start | 3 × 4 | 3 × 3 |
| `setWidth(5)` | 5 × 4 | 5 × 5 |
| `setHeight(4)` | 5 × 4 | 4 × 4 |
| `area()` | **20** | **16** |

The divergence is at `setWidth(5)`: the rectangle keeps its height; the square changes it. By the
time `setHeight(4)` runs, the rectangle is 5 × 4 and the square is 4 × 4.

`resize` returns 20 for the rectangle and 16 for the square. Nothing is wrong with either class in
isolation: `Rectangle` keeps its dimensions independent; `Square` keeps its sides equal. The wrong
part is the `extends` — a `Square` is being used as a `Rectangle`, and it cannot honor the
`Rectangle` contract.

Martin: "The function works just fine for a Rectangle, but declares an assertion error if passed a
Square." In his version the function ends with an assertion; here it returns the area, which makes
the same difference visible.

## The substitution test

LSP is the rule that this example breaks. Barbara Liskov's original formulation:

> If for each object o1 of type S there is an object o2 of type T such that for all programs P
> defined in terms of T, the behavior of P is unchanged when o1 is substituted for o2 then S is a
> subtype of T.

Read it as a test: take any program written against the base type, swap in the subtype, and see
whether the program still behaves the same. `resize` is such a program. Put a `Square` where the
`Rectangle` is expected, and the result changes from 20 to 16. That is the violation.

The compiler cannot catch it. `Square` has every method `Rectangle` has, with compatible
signatures, so the assignment is legal. The broken part is the behavior, not the type.

Martin puts the distinction bluntly: "No! A square might be a rectangle, but a Square object is
definitely not a Rectangle object. Why? Because the behavior of a Square object is not consistent
with the behavior of a Rectangle object. Behaviorally, a Square is not a Rectangle!"

## "But a square is a rectangle"

In geometry, yes. In this mutable API, no. The base type is not the mathematical idea of a
rectangle; it is a set of promises to clients. `Rectangle` promises independent dimensions. A square
cannot promise that and remain a square.

The client's assumption is not a mistake. The client has a `Rectangle` reference, cannot see the
`Square` behind it, and the base type invites the assumption that the dimensions are independent.
Martin:

> The validity of a model can only be expressed in terms of its clients.

A `Square` that keeps its sides equal is a valid `Square`; it is not a valid `Rectangle` *for this
client*.

## The contract, precisely

The promise behind `setWidth` is a **postcondition**:

```ts
// Rectangle.setWidth(w):
// width === w && height === old.height
```

`Square.setWidth` guarantees `width === w && height === w`. It does not guarantee
`height === old.height`; whenever `old.height !== w`, the base postcondition is false. The subtype
has weakened a postcondition, which is exactly what LSP forbids.

Bertrand Meyer's rule, quoted by Martin:

> ...when redefining a routine [in a derivative], you may only replace its precondition by a weaker
> one, and its postcondition by a stronger one.

In table form:

| | Rule | Why |
| --- | --- | --- |
| precondition | may weaken | accept everything the base accepted, and more |
| postcondition | may strengthen | promise everything the base promised, and more |
| invariant | must preserve | clients rely on it in every state |
| history | must not add observable state changes | clients see the base's methods only |

The last row is the part Liskov and Wing added: a subtype cannot introduce observable state changes
that the base type forbids. A mutable point cannot be a subtype of an immutable point, because the
mutable one has histories the base does not allow. It is the same substitution rule applied to
state, not just to method results.

## Fix 1: remove the mutation

The violation is in the mutable setters, not in the geometry. Make the rectangle immutable, and the
same is-a relationship works:

```ts
class Rectangle {
  constructor(readonly width: number, readonly height: number) {}
  area(): number { return this.width * this.height; }
}

class Square extends Rectangle {
  constructor(side: number) { super(side, side); }
}
```

`Square` is now a valid `Rectangle`: it has the same read-only properties, and `area()` is correct.
There is no `setWidth` to break the contract. The old `resize` function no longer compiles, which is
the right outcome: "resize two independent dimensions" was never a `Rectangle` operation in this
design. A client that needs it must ask for a type that promises it.

## Fix 2: make the client's contract explicit

If the application really needs resizing, keep the mutable rectangle but stop claiming that a square
is one. Name the contract the client needs:

```ts
interface Shape {
  area(): number;
}

interface ResizableRectangle extends Shape {
  setWidth(width: number): void;
  setHeight(height: number): void;
}

class Rectangle implements ResizableRectangle {
  constructor(private width: number, private height: number) {}
  setWidth(width: number): void { this.width = width; }
  setHeight(height: number): void { this.height = height; }
  area(): number { return this.width * this.height; }
}

class Square implements Shape {
  constructor(private side: number) {}
  area(): number { return this.side ** 2; }
}
```

`resize` now takes a `ResizableRectangle`:

```ts
function resize(rect: ResizableRectangle): number {
  rect.setWidth(5);
  rect.setHeight(4);
  return rect.area();
}
```

`Square` is a `Shape`, not a `ResizableRectangle`, so the compiler rejects the call that used to
break at runtime. The base contract is now explicit, and only the types that can honor it implement
it.

## Why it matters

LSP is what makes subtype polymorphism safe. Without it, a caller cannot trust the base type: any
subtype might change the behavior behind the same signature, and every call becomes a guess. That is
why Martin ties LSP directly to the [Open/Closed Principle](../03-ocp): if adding a subtype can
break existing clients, the code is not closed for modification.

- [When to use subtype polymorphism](../../42-when-to-use-subtype-polymorphism) — a hierarchy is
  justified when the subtypes behave differently; LSP is the test that the difference is still
  compatible with the base.
- [Two reasons for inheritance](../../38-two-reasons-for-inheritance) — inheritance is for reuse
  *and* substitutability. If you only want the reuse, compose instead.
- [Strategy vs subtype polymorphism](../../34-strategy-vs-subtype-polymorphism) — once behavior
  varies, this is how to choose between a subtype and an injected strategy.

## One-line summary

**LSP is behavioral subtyping: a subtype must honor every promise the base type makes to its
clients — `Square extends Rectangle` fails because `Rectangle.setWidth` promises to leave the
height alone, and `Square.setWidth` cannot.**

## References

- Barbara Liskov — *Data Abstraction and Hierarchy* (OOPSLA '87 keynote; SIGPLAN Notices 23(5),
  1988) — the substitution property —
  <https://web.archive.org/web/20200621040810/https://klevas.mif.vu.lt/~plukas/resources/OODPrinciples/Liskov1987.pdf>
- Barbara Liskov and Jeannette Wing — *A Behavioral Notion of Subtyping*, ACM TOPLAS 16(6),
  1994 — preconditions, postconditions, invariants, and the history rule —
  <https://doi.org/10.1145/197320.197383>
- Robert C. Martin — *The Liskov Substitution Principle*, C++ Report (March 1996) — the
  Square/Rectangle example, the client assumption, and the Design by Contract rule —
  <https://www.cs.utexas.edu/~downing/papers/LSP-1996.pdf>
- Bertrand Meyer — *Object-Oriented Software Construction* (1988) — Design by Contract:
  preconditions, postconditions, invariants
- Wikipedia — *Liskov substitution principle* — the concise statement and the Square/Rectangle
  code —
  <https://en.wikipedia.org/wiki/Liskov_substitution_principle>
- This repo — [Open/Closed Principle](../03-ocp) — why a subtype that breaks clients is not an
  extension
- This repo — [Strategy vs subtype polymorphism](../../34-strategy-vs-subtype-polymorphism)
- This repo — [Two reasons for inheritance](../../38-two-reasons-for-inheritance)
- This repo — [When to use subtype polymorphism](../../42-when-to-use-subtype-polymorphism)
