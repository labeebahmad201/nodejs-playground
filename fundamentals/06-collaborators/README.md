# Collaborators

*A **collaborator** is any object your object works *with* to get its job done — a database, a
mailer, a clock, a repository, another service. Where value objects and entities are the **data**
your object holds, collaborators are the **other objects it talks to**. Recognizing the difference
is what tells you what to `new` and what to inject.*

Part of the language-agnostic [`fundamentals/`](../) track. See `02-inversion-of-control` and
`03-value-objects-vs-collaborators`.

## Definition

A **collaborator** is an object that your object depends on and interacts with to fulfill a
responsibility — typically an object with **behavior and/or side effects**, not just data.

In a `InvoiceService`:

```ts
class InvoiceService {
  constructor(
    private repo: InvoiceRepo,   // collaborator
    private mailer: Mailer,      // collaborator
    private clock: Clock,        // collaborator
  ) {}

  send(id: InvoiceId): void {
    const invoice = this.repo.find(id);              // talks to a collaborator
    const rendered = render(invoice);                // pure helper — not a collaborator
    this.mailer.send(invoice.customer.email, rendered);
  }
}
```

`repo`, `mailer`, and `clock` are collaborators. `render` is a pure function, and `invoice` is
data — neither is a collaborator.

## What counts as a collaborator

| Object | Collaborator? | Why |
| --- | --- | --- |
| `InvoiceRepo`, `UserRepo` | yes | behavior + I/O |
| `Mailer`, `HttpClient`, `Cache` | yes | side effects |
| `Clock`, `Random`, `UuidGenerator` | yes | nondeterministic, injectable |
| `Logger` | yes | side effect |
| `Money`, `EmailAddress`, `DateRange` | **no** | values — `new` them |
| a pure `format()` / `calculate()` helper | **no** | value in, value out |

The test: **does it do something to the world, or hold state that varies?** Then it's a
collaborator — inject it. If it's just descriptive data, it's a value object — construct it.

## Why the word matters

The "collaborator" framing makes the design question concrete: **what does this object collaborate
with?** Answering it reveals your true dependencies — and therefore what tests must substitute, and
what the composition root must wire.

- **Dependencies are explicit.** Making collaborators constructor parameters means the signature
  documents what the object needs.
- **Testable.** Because collaborators are injected (usually as interfaces), tests pass fakes/spies.
- **Loose coupling.** The object depends on an abstraction, not on `SqlInvoiceRepo` or `SmtpMailer`.

## Collaborators vs the other building blocks

| | Collaborator | Value object (`04`) | Entity (`05`) |
| --- | --- | --- | --- |
| Role | what your object *works with* | what your object *is/holds* | a thing with identity |
| Behavior | yes (often with effects) | pure | domain rules |
| Constructed by | injected (composition root) | `new` freely | repository/factory |
| Substituted in tests | yes (fakes/mocks) | no need | via repository |

A collaborator is a **relationship** ("X collaborates with Y"), not a fixed category of class — the
same object can be a collaborator of one object and a domain object in its own right elsewhere.

## Guidance

- **Inject collaborators; don't construct them inside your logic.** If you `new` one inline, you've
  welded your object to a concrete implementation and an effect.
- **Depend on interfaces** so implementations can be swapped (`InvoiceRepo`, not `SqlInvoiceRepo`).
- **Keep collaborators few.** A constructor with eight collaborators is a sign the object does too
  much — split it.
- **Distinguish the relation from the type.** Don't create a `Collaborator` base class; the term
  describes how objects relate, not a category to inherit from.
- **Mock at the boundary.** In tests, substitute collaborators (DB, HTTP, clock); let value objects
  and pure functions run for real.

## Pitfalls

- **Hidden collaborators.** Module singletons, `import { db }`, direct `fetch`, or `Date.now()`
  are collaborators you didn't declare — the class looks dependency-free but isn't.
- **Treating data as a collaborator.** Injecting a factory for `Money` is ceremony; just `new` it.
- **Too many collaborators.** Lots of injected services usually means missing domain abstraction —
  the logic may belong *on* an entity or value object instead.

## One-line summary

**A collaborator is an object your object works with to do its job — behavior-bearing and often
effectful — as opposed to the value objects/entities it merely holds; you inject collaborators from
the composition root so your logic depends on substitutable interfaces rather than concrete
implementations.**

## References

- Martin Fowler — *Inversion Of Control* — <https://martinfowler.com/bliki/InversionOfControl.html>
- Martin Fowler — *Inversion of Control Containers and the Dependency Injection pattern* — <https://martinfowler.com/articles/injection.html>
- Related: `02-inversion-of-control`, `03-value-objects-vs-collaborators`, `08-repositories`, `09-domain-services`
