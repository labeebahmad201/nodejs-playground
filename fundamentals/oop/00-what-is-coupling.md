# What coupling is

## The definition

The standard's wording is drier than the word's reputation:

> The manner and degree of interdependence between software modules.
>
> — ISO/IEC/IEEE 24765:2017, §3.919 (first standardised in IEEE Std 610.12-1990)

Both halves do work. **Interdependence** names a relationship rather than a single arrow. **Degree** says it is measured rather than declared: nothing is simply "coupled," only more or less so. The standard says *modules*; this note says *part*, because the same measure applies to classes, packages, services and teams.

That gives the working definition — the standard's "degree," made concrete:

> **Coupling is how much one part of a system must know about another in order to work — and therefore how much change can travel from one to the other.**

The test is not "does A use B?" It is: **change B — does A need editing?** If yes, they are coupled, and the strength is how much of B's change reaches A. If B can be rewritten and A never notices, the coupling is weak no matter how many times A calls B.

## Tight coupling: the consumer writes `new`

The clearest case is a class that builds its own collaborator:

```ts
class TightOrderService {
  #mailer = new SmtpMailer("smtp.example.com");

  place(order: Order): void {
    this.#mailer.send(order.email, "Order confirmed", `Total: ${order.total}`);
  }
}
```

Its public signature says `place(order)`. Its body also depends on SMTP, a host name, and `SmtpMailer`'s constructor — none of which appear in the signature. The `new` is the moment the implementation stops being a choice and becomes a fact.

Three costs follow from that one line.

**Rigidity.** If `SmtpMailer`'s constructor gains a required argument, `TightOrderService` stops compiling until it is edited for a reason that has nothing to do with orders. If the team moves to another provider, the class is edited again. The consumer and the implementation now change together — and how often that happens is how the coupling shows up in your week.

**Testability.** Email is not an input here; it is a hidden effect reached through construction. `new TightOrderService()` opens the connection before the first assertion, and there is no parameter through which a fake could arrive. The test has three bad options: talk to a real server, mock the module system, or skip the unit test and exercise the class through the network. A hard test in this case is not a testing problem. It is the signature reporting that a dependency is missing.

**Hidden knowledge.** A caller reading `place(order)` cannot tell that placing an order sends email, or where it connects. Reading the signature is not enough; you have to read the field initializer. That is the standard's "degree" in practice: how much of `SmtpMailer` you must know in order to use `TightOrderService`.

Typing the field as an interface does not undo any of this:

```ts
class Checkout {
  private notifier: Notifier = new EmailNotifier();
}
```

The annotation says what the class is allowed to call. The `new` says what it will call. An interface only creates a seam when something else can supply a different object — [Coupling to a concretion](strategy-polymorphism/39-coupling-to-concretion.md) follows that case through.

## Coupling to an abstraction

The alternative is to name only the operations the consumer uses, and let the choice of class happen outside.

**Constructor injection** — the collaborator arrives when the object is created:

```ts
class LooseOrderService {
  #mailer: Mailer;

  constructor(mailer: Mailer) {
    this.#mailer = mailer;
  }

  place(order: Order): void {
    this.#mailer.send(order.email, "Order confirmed", `Total: ${order.total}`);
  }
}
```

`LooseOrderService` now knows `send(to, subject, body)` and nothing else. It does not know whether the implementation is SMTP, Slack, or a recorder. The constructor parameter is the seam.

**Parameter injection** — the collaborator arrives with the operation:

```ts
function placeOrder(order: Order, mailer: Mailer): void {
  mailer.send(order.email, "Order confirmed", `Total: ${order.total}`);
}
```

Use this when the collaborator varies per call, or when the class has a single operation and no state worth keeping. Constructor injection is the default for a collaborator the whole object uses; parameter injection for one the operation decides.

The `new` does not disappear. It moves:

```ts
const mailer: Mailer = new SmtpMailer("smtp.example.com");
const service = new LooseOrderService(mailer);
```

This is the composition root: the entry point of the application, where lifetimes and implementations are decided once. Every class below it receives. [Seam](strategy-polymorphism/40-seam.md)is the general name for the place where the substitution happens.

## The test the tight version cannot write

With the collaborator as a parameter, the test supplies a fake and asserts on what it recorded:

```ts
import assert from "node:assert/strict";

type Sent = { to: string; subject: string; body: string };

class RecordingMailer implements Mailer {
  readonly sent: Sent[] = [];

  send(to: string, subject: string, body: string): void {
    this.sent.push({ to, subject, body });
  }
}

const order = { id: "A-2", email: "grace@example.com", total: 30 };
const recording = new RecordingMailer();

new LooseOrderService(recording).place(order);

assert.deepEqual(recording.sent, [
  { to: order.email, subject: "Order confirmed", body: "Total: 30" },
]);
```

No server, no module mock, no network. The same test body also exercises `SlackMailer`, `SmtpMailer`, or a future provider without editing the service — the implementation is the test's choice, not the class's.

That is the practical difference between the two versions, and it is the difference the definition predicts: the tight class is coupled to the vendor's address, constructor, and protocol; the loose class is coupled to one method signature.

## Run the example

The full before/after is in [00-what-is-coupling.ts](00-what-is-coupling.ts):

```sh
node fundamentals/oop/00-what-is-coupling.ts
```

It constructs the tight service (and opens SMTP as a side effect), tries to pass a `SlackMailer` to it (a type error; the runtime ignores the argument), then runs the injected versions against a recording fake and asserts the result. Node runs the TypeScript directly by stripping the types.

## One-line summary

**The** `new` **keyword is not the defect; where it is written is. A class that constructs its collaborator has already made the choice, whatever its field is typed as. A class that receives the collaborator knows only the contract, and the choice belongs to the edge.**

Related: [Coupling to a concretion](strategy-polymorphism/39-coupling-to-concretion.md), [Seam](strategy-polymorphism/40-seam.md), [Testability and anti-patterns](strategy-polymorphism/41-testability-and-anti-patterns.md), [Global access and coupling](design-patterns/05d-global-access-and-coupling.md).