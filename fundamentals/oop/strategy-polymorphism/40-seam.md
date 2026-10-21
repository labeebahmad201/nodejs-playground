# Seams

*A seam is a place where you can change what happens without editing the code at that place. In
object-oriented code it is almost always a parameter — the spot where a different object can be
handed in.*

## The definition

> A seam is a place where you can alter behavior in your program without editing in that place.

That is Michael Feathers' definition, from *Working Effectively with Legacy Code* (2004, ch. 4). He
adds:

> Every seam has an enabling point, a place where you can make the decision to use one behavior or
> another.

The seam is the opening; the enabling point is where someone chooses through it. Both are needed:
the opening without a caller using it is just a parameter, and a decision with nowhere to apply it
is not a seam.

## A seam in TypeScript

Martin Fowler's example is a price calculation that calls an external shipping service directly:

```ts
export async function calculatePrice(order: Order) {
  const itemPrices = order.items.map(i => calculateItemPrice(i))
  const basePrice = itemPrices.reduce((acc, i) => acc + i.price, 0)
  const discount = calculateDiscount(order)
  const shipping = await calculateShipping(order)
  const adjustedShipping = applyShippingDiscounts(order, shipping)
  return basePrice + discount + adjustedShipping
}
```

`calculatePrice` is welded to `calculateShipping`, so a test cannot stop it from hitting the
service. Fowler changes the signature to take the function as a parameter:

```ts
export async function calculatePrice(order: Order, shippingFn: (o: Order) => Promise<number>) {
  const itemPrices = order.items.map(i => calculateItemPrice(i))
  const basePrice = itemPrices.reduce((acc, i) => acc + i.price, 0)
  const discount = calculateDiscount(order)
  const shipping = await shippingFn(order)
  const adjustedShipping = applyShippingDiscounts(order, shipping)
  return basePrice + discount + adjustedShipping
}
```

The seam is `shippingFn`. The enabling point is the call:

```ts
const shippingFn = async (o: Order) => 113
expect(await calculatePrice(sampleOrder, shippingFn)).toStrictEqual(153)
```

The production function is untouched by the test; the test supplies the behavior at the seam.

## The same idea in a constructor

```ts
interface Clock {
  now(): Date;
}

class Token {
  constructor(private clock: Clock) {}

  isExpired(expiresAt: Date): boolean {
    return expiresAt.getTime() <= this.clock.now().getTime();
  }
}
```

```ts
const prod = new Token(new SystemClock());
const test = new Token(new FixedClock(new Date("2026-01-01T00:00:00Z")));
```

The seam is the `clock` parameter; the enabling point is the `new Token(...)` call. `Token` is
never edited, and it never asks what time it is — it asks the object it was given.

## The interface is not the seam

```ts
class Token {
  private clock: Clock = new SystemClock(); // no seam

  isExpired(expiresAt: Date): boolean {
    return expiresAt.getTime() <= this.clock.now().getTime();
  }
}
```

The type is still `Clock`, and any `Clock` would fit, but there is nowhere to put one: the value is
created inside the class. The interface describes the socket; the seam is whether the socket can be
reached from outside.

This is the case in [Coupling to a concretion](39-coupling-to-concretion.md).

## Where seams are

| Seam | Enabling point |
| --- | --- |
| constructor parameter | the `new` that builds the object |
| function or method parameter | the call |
| setter | the assignment |
| default parameter | the caller omitting or overriding it |
| overridable method | the subclass |
| module export (mocked import) | the test runner |

The first five are **object seams**: a collaborator is supplied at a point the class exposes. The
last is a **link seam**: the substitution happens at the module boundary (`jest.mock("./mailer")`).
It is useful when the code has no object seam, but it works around the design instead of exposing
it.

## What it buys

- **Tests** replace the collaborator without editing production code.
- **Variation** moves to the caller — which implementation to use becomes one decision at one place.
- **Visibility** — the dependency is in the signature instead of buried in a constructor body.

## One-line summary

**A seam is a place where behavior can be substituted without editing the code at that place; in
object code that place is a parameter, and its enabling point is the caller that decides what to
pass — an interface field filled by `new` inside the class has the type but not the seam.**

## References

- Michael Feathers — *Working Effectively with Legacy Code* (2004), ch. 4 "The Seam Model" — the
  definitions of seam and enabling point
- Martin Fowler — *Legacy Seam* (4 Jan 2024) — <https://martinfowler.com/bliki/LegacySeam.html> —
  the `calculatePrice` example and the definition restated
- This repo — [Coupling to a concretion](39-coupling-to-concretion.md) — the no-seam case
- This repo — [Strategy pattern](35-strategy-pattern.md) — a collaborator arriving through a
  constructor parameter
