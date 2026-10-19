# Two reasons for inheritance

*Inheritance gives you two things at once: **hierarchical reuse of code** and **subtype
polymorphism**. It is reasonable only when you want both. Want just one, and a cheaper construct
gives you that one without dragging the other along.*

| You want | Use |
| --- | --- |
| both reuse and polymorphism | inheritance |
| only reuse of code | composition |
| only subtype polymorphism | an interface |

## Both → inheritance

```ts
abstract class Importer {
  run(file: File): void {
    for (const row of this.parse(file)) this.save(row); // shared
  }

  protected abstract parse(file: File): Row[];
  protected abstract save(row: Row): void;
}
```

Callers hold an `Importer` (polymorphism); subclasses share `run` (reuse). Both halves are used.

## Only reuse → composition

```ts
class Csv {
  toCsv(rows: Row[]): string { /* ... */ }
}

class SalesReport {
  constructor(private csv: Csv) {}
  render(rows: Row[]): string { return this.csv.toCsv(rows); }
}
```

`SalesReport` gets the CSV code and claims to be nothing. No parent type, no all-or-nothing API.

## Only polymorphism → interface

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
```

`implements` carries the contract and **no code** — which is exactly what is wanted when the
implementations have nothing to share.

## The catch: the second half arrives anyway

Inherit only for the reuse, and the polymorphism still comes with it. Your class is now accepted
anywhere the parent is accepted — including places you never considered:

```ts
class BaseService {
  protected log(message: string): void { /* ... */ }
  start(): void { /* begins polling */ }
}

class BillingService extends BaseService {
  charge(order: Order): void { this.log(`charging ${order.id}`); } // wanted log(), became a service
}

function startAll(services: BaseService[]): void {
  for (const service of services) service.start();
}

startAll([new BillingService()]); // compiles: billing now polls, which nobody asked for
```

- `BillingService` never meant to be a `BaseService`; inheriting `log` made the claim for it.
- The compiler cannot tell "is a" from "wanted the helper", so no call site can either.
- Every function typed against `BaseService` now accepts it — including the ones that call `start`.

The fix is the previous row of the table: hold the helper (`constructor(private logger: Logger)`),
and `BillingService` stops being a `BaseService` at all.

## One-line summary

**Inherit only when you want both hierarchical reuse and subtype polymorphism; want only the reuse
and compose, want only the polymorphism and implement an interface — neither of those needs the
other half, and inheritance gives you no way to decline it.**

## References

- Christopher Okhravi — *Only Use Inheritance If You Want Both of These* (30 Apr 2024),
  <https://www.youtube.com/watch?v=C3B5IIlt4-0>
- This repo — [Inheritance vs composition](../36-inheritance-vs-composition) — the is-a test and
  the full cost list; this note is the "do I want both?" half.
