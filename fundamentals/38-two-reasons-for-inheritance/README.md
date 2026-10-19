# Two reasons for inheritance

*Inheritance bundles two independent capabilities: **hierarchical reuse of code** and **subtype
polymorphism**. You cannot take one and decline the other — so inherit only when you want both.*

## One without the other

**Only subtyping** — an interface gives the polymorphism, with no code attached:

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

const shapes: Shape[] = [new Circle(1), new Square(2)];
```

**Only reuse** — a collaborator gives the code, with no type claim:

```ts
class Csv {
  toCsv(rows: Row[]): string { /* ... */ }
}

class SalesReport {
  constructor(private csv: Csv) {}
  render(rows: Row[]): string { return this.csv.toCsv(rows); }
}
```

Neither case is missing anything: the shapes share no body, and `SalesReport` has no parent type
to be a subtype of.

## Both → inherit

```ts
abstract class Importer {
  run(file: File): void {
    for (const row of this.parse(file)) this.save(row); // once, for every format
  }

  protected abstract parse(file: File): Row[];
  protected abstract save(row: Row): void;
}

class CsvImporter extends Importer { /* parse + save */ }
class JsonImporter extends Importer { /* parse + save */ }

function importAll(importers: Importer[], file: File): void { /* ... */ }
```

Both halves are load-bearing: the loop is written once, and callers hold `Importer`. Remove either
half and a simpler construct covers what is left.

## Why the bundle is a problem

You cannot take the reuse and decline the subtyping: `class BillingService extends BaseService` just
to call `this.log()` makes every `BillingService` a `BaseService` at every call site. Nor can you
take part of the parent's API: `Stack extends Array` inherits `splice` and index assignment along
with `push`, and with them the parent's internal call graph and its future.

`extends` binds you to the parent's *implementation*; callers only ever needed its *contract*. That
is the whole case for composition: hold the collaborator and expose only what you mean to support.

## One-line summary

**Inheritance is two capabilities bundled — hierarchical code reuse and subtype polymorphism — and
it is justified only when you want both, because the bundle is all-or-nothing: want just the
contract and take an interface, want just the code and take a collaborator.**

## References

- Christopher Okhravi — *Only Use Inheritance If You Want Both of These* (30 Apr 2024),
  <https://www.youtube.com/watch?v=C3B5IIlt4-0> — chapters *Only Hierarchical Reuse* (0:21),
  *Only Subtype Polymorphism* (3:16), *Avoid Inheritance?* (5:37), *Couple to Abstractions* (7:13).
  The framing is his; the TypeScript examples are mine.
- This repo — [Inheritance vs composition](../36-inheritance-vs-composition) — the is-a test and
  the full cost list; this note is only the "do I want both?" half.
