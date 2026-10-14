# When to `new` — value objects vs collaborators

*`new` is not the problem. The smell is creating a **collaborator** — a dependency with behavior
or side effects — inside your logic, instead of receiving it. Construct **value objects** (plain
data) freely; **inject** collaborators (services) from the outside. Getting this one distinction
right is most of what makes code testable and loosely coupled.*

Part of the language-agnostic [`fundamentals/`](../) track. Builds on `fundamentals/02-inversion-of-control`.

## The confusion

Saying "`new` makes code brittle and untestable" is too broad. `new X()` shows up in two very
different situations, and they call for opposite treatment:

```ts
class InvoiceService {
  send(id: string) {
    const invoice = this.repo.find(id);       // collaborator (injected) — good
    const total = new Money(invoice.amount);  // value object — good
    const repo2 = new SqlInvoiceRepo(dbUrl);  // collaborator created here — the problem
  }
}
```

---

## Value objects — `new` them anywhere

A **value object** is plain data with no dependencies and no side effects — its behavior is pure.

- Examples: `Money`, `Date`, `OrderId`, `EmailAddress`, `LineItem`, a DTO, a config record.
- Typically **immutable**: operations return a **new** instance rather than mutating.
- Equatable by value, cheap to build, deterministic.
- Nothing to substitute, nothing to mock — so **constructing them inside your code is correct**.

```ts
class Money {
  constructor(readonly amount: number, readonly currency: string) {}

  add(other: Money): Money {
    return new Money(this.amount + other.amount, this.currency); // new is right here
  }
}
```

You'd never inject a `Money` factory. `new` for data is good design.

## Collaborators — inject them

A **collaborator** (a *service*/*dependency*) is an object with **behavior, state, or side
effects** that your code talks to: a database, an HTTP client, an email sender, a clock, a
logger, a cache.

Creating one *inside* your logic is what couples you to a concrete implementation and an effect:

```ts
class InvoiceService {
  private repo = new SqlInvoiceRepo(process.env.DB_URL!); // welded to Postgres
  private mailer = new SmtpMailer();                      // welded to SMTP

  send(id: string) {
    const invoice = this.repo.find(id);
    this.mailer.send(invoice.email, render(invoice));
  }
}
```

Now `InvoiceService` can't be tested without a real database and a real mail server, can't be
pointed at a different backend, and drags the concrete classes' constructor changes into itself.

Instead, **receive** the collaborators (dependency injection) and depend on **interfaces**:

```ts
interface InvoiceRepo { find(id: string): Invoice }
interface Mailer { send(to: string, body: string): void }

class InvoiceService {
  constructor(private repo: InvoiceRepo, private mailer: Mailer) {}

  send(id: string) {
    const invoice = this.repo.find(id);
    this.mailer.send(invoice.email, render(invoice)); // render() is pure — can stay a function
  }
}
```

Concrete choices move to the **composition root** — the one place where `new`-ing collaborators is
correct:

```ts
const service = new InvoiceService(new SqlInvoiceRepo(env.DB_URL), new SmtpMailer());
```

And a test composes fakes instead:

```ts
const service = new InvoiceService(new InMemoryInvoiceRepo(), new SpyMailer());
```

## The rule of thumb

> **Would you ever want to substitute this in a test, or choose a different implementation per
> environment?** If yes → **inject** it. If it's just data → **`new`** it.

| | Value object | Collaborator |
| --- | --- | --- |
| Nature | data | behavior / state / effects |
| Dependencies | none | usually other collaborators |
| Side effects | none | I/O, time, randomness, network |
| Mutable? | usually immutable | often stateful |
| Substitutable? | no need | yes (`memo`, tests, envs) |
| Construct with | `new` freely, inline | inject from the composition root |
| Examples | `Money`, `OrderId`, DTO, config | `Db`, `HttpClient`, `Clock`, `Logger` |

A good heuristic: **new up nouns (data); inject verbs (things that do something to the world).**

## Why internal `new` of a collaborator is brittle & untestable

- **Coupling to a concrete implementation.** You can't swap it; the class *is* tied to Postgres/SMTP.
- **Effects are forced.** Any test runs real I/O, or fails without it.
- **Hidden dependencies.** The constructor doesn't reveal what the class needs — it "just works" until it doesn't.
- **Ripple on change.** Change the collaborator's constructor and every class that `new`s it breaks.
- **Violates the dependency-inversion principle.** High-level policy depends on low-level detail.

## It isn't only `new`

The same brittleness comes from any hardcoded, non-substitutable dependency:

- a module-level singleton (`import { db } from "./db"`),
- direct `fetch` / `fs` / `process.env` calls inside logic,
- `Date.now()` / `Math.random()` (the clock and randomness are dependencies too),
- global mutable state.

The root cause is never the keyword — it's **two things together**:

1. **you don't control creation** of the collaborator, and
2. **you depend on a concrete implementation or an effect** you can't substitute.

## Nuance: don't over-apply

- Don't inject **value objects** — it's ceremony.
- Don't abstract **everything**; pure helper functions (`render`, `format`, `calculate`) are fine to
  call directly — they're values in, value out (see `fundamentals/01-pure-functions`).
- A tiny script or a throwaway doesn't need a composition root. The rule matters where code is
  **long-lived and tested**.
- Injecting a dependency isn't the same as *needing* a DI container — hand-wiring (**pure DI**) is
  often enough.

## One-line summary

**`new` is fine for value objects (immutable, dependency-free data you construct anywhere) but a
smell for collaborators (services with behavior and effects) — inject those from a single
composition root so your logic depends on interfaces you can substitute, which is what keeps code
loosely coupled and testable.**

## References

- Mark Seemann — *Composition Root* — <https://blog.ploeh.dk/2011/07/28/CompositionRoot/>
- Martin Fowler — *Inversion of Control Containers and the Dependency Injection pattern* — <https://martinfowler.com/articles/injection.html>
- Martin Fowler — *ValueObject* — <https://martinfowler.com/bliki/ValueObject.html>
- Robert C. Martin — *The Dependency Inversion Principle* — <https://web.archive.org/web/20160304101740/http://www.objectmentor.com/resources/articles/dip.pdf>
- Related: `fundamentals/02-inversion-of-control`, `fundamentals/01-pure-functions`
