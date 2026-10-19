# Coupling to a concretion

*A class that receives a `Notifier` can be handed any implementation. A class that writes
`new EmailNotifier()` has already picked one — the interface in its field records what it uses, not
what it can become. That is coupling to a concretion, and it survives every `implements` in the
codebase.*

## The polymorphism that works

```ts
interface Notifier {
  send(to: string, body: string): Promise<void>;
}

class EmailNotifier implements Notifier { /* ... */ }
class SlackNotifier implements Notifier { /* ... */ }

async function announce(notifier: Notifier, body: string): Promise<void> {
  await notifier.send("ops", body);
}

await announce(new EmailNotifier(), "deployed");
await announce(new SlackNotifier(), "deployed");
```

The function names the contract and *receives* the value; both implementations reach the same
parameter, so the substitution is real. Note where the `new` is written: in the code that decides,
outside the function that uses.

## The scenario: the choice is made inside

```ts
class Checkout {
  private notifier: Notifier;

  constructor() {
    this.notifier = new EmailNotifier(); // the only implementation it will ever hold
  }

  async pay(order: Order): Promise<void> {
    // ...
    await this.notifier.send(order.email, `paid ${order.total}`);
  }
}
```

`Checkout` compiles against `Notifier`, and the field is honest about what the class needs:
one `send` method. But the field is assigned once, to a literal constructor call, in a constructor
that takes no arguments. No `SlackNotifier` can ever arrive. The interface narrowed the **surface**
of the dependency; it did nothing about its **source**.

Nothing at the call site hints at this. `new Checkout()` looks like an object with no
dependencies, while it silently owns an SMTP client.

## The scenario, one level worse: inside a method

```ts
class InvoiceReport {
  render(rows: Row[]): string {
    const exporter = new CsvExporter(); // created, used, discarded
    return exporter.export(rows);
  }
}
```

Here the collaborator is not even state. It is born at the top of the call and dies at the return,
so it cannot be replaced, configured, shared, or inspected — and the dependency does not appear in
the class at all, only in the body. The signature `render(rows)` mentions no exporter.

A second symptom falls out of the same line: anything the exporter would remember between calls
(a cache, a buffer, a connection) is thrown away on every call, because the object is rebuilt on
every call.

## What is fixed

`new Concrete()` inside the consumer transfers four decisions that the abstraction cannot take
back:

- **The implementation.** `EmailNotifier` is named in `Checkout`'s source. Moving to Slack is an
  edit to `Checkout`, not a configuration change.
- **The construction.** `new EmailNotifier()` carries its argument list — URL, credentials, retry
  policy. The consumer now knows how to *build* the collaborator, not just how to call it.
- **The lifetime.** The consumer creates it, so it owns initialisation and disposal, and cannot
  share one notifier with the rest of the application or reuse a pooled one.
- **The policy.** "Which channel do we notify on" was one decision for one place; it is now
  repeated in every class that writes the same `new`.

These are one dependency. None of it passes through the field, so none of it is visible to the
interface.

## Why the interface does not help

Substitutability requires that two implementations can *arrive at the same variable*. In `Checkout`
there is one assignment, to a `new`, and no parameter, setter, or factory result. The type accepts
both classes; the code path admits one.

Typing the field as `EmailNotifier` instead would change nothing — the coupling is the constructor
call and the import, not the annotation. Typing it as `Notifier` is necessary for substitution and
does not produce it. The interface is a label on the choice, not a seam in it.

## Every shape it takes

| Where the `new` is written | What is fixed | Can anything vary it? |
| --- | --- | --- |
| field initializer | implementation, before the constructor body runs | no |
| constructor body | implementation and its arguments | no |
| method body | implementation, rebuilt on every call | no — not even state to replace |
| private factory in the same class | implementation, behind one more name | no |
| imported singleton (`import { notifier }`) | implementation, at module load | no |
| a parameter, supplied by the caller | nothing | yes |

The first five differ in spelling, not in coupling: the code that uses the collaborator is also the
code that names the concrete class. The last row is the other side of the line — see below.

## Where the line is

`new` is not the smell; a program must construct something. The distinction is **who writes it**:

- **Inside the consumer** — `Checkout` writes `new EmailNotifier()`. The consumer fixes the choice.
  This note.
- **At the edge** — the entry point, a factory, a test, or a container writes it and passes the
  object in. The consumer only receives; the choice is made once, where it belongs.

A default parameter (`constructor(private n: Notifier = new EmailNotifier())`) sits between them:
a caller can override it, so it is not a lock — but everyone who omits the argument gets the same
hard-coded implementation.

Moving the `new` to the edge is the fix, and it is its own note.

## How to spot it

- A constructor with an empty parameter list and a body that constructs things.
- A field typed as an interface whose only assignment is `new`.
- A method whose first statement builds the collaborator the rest of the method calls.
- An `import` of a concrete class sitting next to a field typed as its interface.
- A test that performs I/O just by constructing the class under test — the dependency was chosen
  inside, and the interface offered no seam.

## One-line summary

**An interface creates substitutability only where implementations arrive from outside; writing
`new Concrete()` inside the consumer's field, constructor, or method picks the implementation at the
point of use, so the field type documents what the class uses but never becomes a seam — the
consumer is coupled to the concretion whatever the field declares.**

## References

- Christopher Okhravi — *Only Use Inheritance If You Want Both of These* (30 Apr 2024), chapter
  *Couple to Abstractions* (7:13) — <https://www.youtube.com/watch?v=C3B5IIlt4-0>
- Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides — *Design Patterns* (1994) — the design
  principle "Program to an interface, not an implementation"
- This repo — [Strategy pattern](../35-strategy-pattern) — the receiving side, where the
  collaborator arrives through the constructor
- This repo — [Inheritance vs composition](../36-inheritance-vs-composition) and
  [Two reasons for inheritance](../38-two-reasons-for-inheritance) — the same "couple to the
  contract, not the implementation" rule on the inheritance axis
