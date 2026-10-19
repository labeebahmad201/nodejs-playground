# Coupling to a concretion

*You use an interface, but you create the implementation yourself. Then the interface protects
nothing — the choice was already made where the object was built.*

## Polymorphism works when the object comes from outside

```ts
interface Notifier {
  send(to: string, body: string): Promise<void>;
}

class EmailNotifier implements Notifier { /* ... */ }
class SlackNotifier implements Notifier { /* ... */ }

function announce(notifier: Notifier, body: string) {
  return notifier.send("ops", body);
}

announce(new EmailNotifier(), "deployed");
announce(new SlackNotifier(), "deployed");
```

`announce` works with both because both are passed in. It never mentions a concrete class.

## The problem: the class creates its own collaborator

```ts
class Checkout {
  private notifier: Notifier = new EmailNotifier();

  async pay(order: Order): Promise<void> {
    await this.notifier.send(order.email, "paid");
  }
}
```

The field says `Notifier`. The value is always `EmailNotifier`. The interface describes what
`Checkout` calls, not what it can be given.

Composition itself is fine — `Checkout` has-a collaborator. What is wrong is where the
collaborator comes from: it is created here.

So:

- **Changing the channel means editing `Checkout`.** There is no parameter through which another
  implementation could arrive.
- **Callers cannot see the dependency.** `new Checkout()` looks self-contained, but it sends email.
- **Tests touch the real thing.** Constructing `Checkout` is enough to reach SMTP, and there is no
  seam for a fake.

### The missing seam

A **seam** is "a place where you can alter behavior in your program without editing in that place"
(Michael Feathers, *Working Effectively with Legacy Code*, ch. 4). In object code that place is a
parameter — the constructor, a method, a setter.

`Checkout` has the socket but not the seam. The field is typed `Notifier`, so a `SlackNotifier`
would fit, but there is no way to hand one in. The only place the value can change is the source of
`Checkout` itself.

Feathers adds that every seam has an **enabling point** — "a place where you can make the decision
to use one behavior or another." With a constructor parameter that place is the caller: `main`, a
test, a factory. With `new` inside, no such place exists outside the class.

## Worse inside a method

```ts
class InvoiceReport {
  render(rows: Row[]): string {
    const exporter = new CsvExporter();
    return exporter.export(rows);
  }
}
```

Now the collaborator is not even a field. It is created and discarded on every call, so nothing can
replace or configure it, and any state it keeps is lost each time. `render(rows)` gives no hint that
an exporter exists.

## Why the interface doesn't help

An interface lets a variable hold any implementation. That only matters if more than one can reach
the variable.

In `Checkout` there is exactly one assignment, and it is `new EmailNotifier()`. The type is
compatible with both classes; the code only ever produces one.

Typing the field `EmailNotifier` would change nothing. The coupling is the `new` and the import, not
the annotation. `Notifier` is necessary for substitution, but it does not create it.

## Every form of the same mistake

| Where you write `new` | What is fixed |
| --- | --- |
| field initializer | the implementation, before the object is used |
| constructor body | the implementation and its arguments |
| method body | the implementation, again on every call |
| private factory or static helper | the implementation, behind one more name |
| imported singleton | the implementation, at module load |

In all five, the class that uses the object is also the class that names it.

## Where it is fine

`new` has to happen somewhere. The difference is where: not inside the class that uses the object,
but at the edge of the application, in code whose job is assembly.

Martin Fowler's `MovieLister` is the canonical before/after. The naive version builds its finder
itself — and note that the field is *already* the `MovieFinder` interface, while the constructor
picks the class. That is this note's scenario, written in 2004:

```java
class MovieLister {
  private MovieFinder finder;

  public MovieLister() {
    finder = new ColonDelimitedMovieFinder("movies1.txt");
  }
}
```

The injected version takes the interface and lets someone else decide:

```java
class MovieLister {
  private MovieFinder finder;

  public MovieLister(MovieFinder finder) {
    this.finder = finder;
  }
}
```

The decision moves to an assembler — Fowler's word:

> The basic idea of the Dependency Injection is to have a separate object, an assembler, that
> populates a field in the lister class with an appropriate implementation for the finder interface.

Mark Seemann names that place the **composition root**:

> A Composition Root is a (preferably) unique location in an application where modules are composed
> together.

He puts it as close as possible to the application's entry point — `Main` in a console app,
`global.asax` in ASP.NET MVC, `OnStartup` in WPF. That is where the concrete class is named; every
class below it only receives.

A default parameter sits in between: `constructor(private n: Notifier = new EmailNotifier())`. A
caller can override it, but everyone who does not gets the same hard-coded class.

## How to spot it

- An empty constructor whose body constructs things.
- An interface field assigned once, with `new`.
- A method whose first line builds what the rest of it calls.
- A test that does I/O just by constructing the object.

## One-line summary

**An interface lets you swap implementations only when the object arrives from outside; if the
class that uses the collaborator also writes `new Concrete()`, the field type records what it calls
but the implementation is already fixed, and the class is coupled to the concretion.**

## References

- Christopher Okhravi — *Only Use Inheritance If You Want Both of These* (30 Apr 2024), chapter
  *Couple to Abstractions* (7:13) — <https://www.youtube.com/watch?v=C3B5IIlt4-0>
- Martin Fowler — *Inversion of Control Containers and the Dependency Injection pattern*
  (23 Jan 2004) — <https://martinfowler.com/articles/injection.html> — the `MovieLister` naive
  example, the constructor-injected version, and the assembler
- Mark Seemann — *Composition Root* (28 Jul 2011) —
  <https://blog.ploeh.dk/2011/07/28/CompositionRoot/> — the definition and the entry points
- Michael Feathers — *Working Effectively with Legacy Code* (2004), ch. 4 "The Seam Model" — the
  definition of a seam and of an enabling point
- Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides — *Design Patterns* (1994) — the design
  principle "Program to an interface, not an implementation"
- This repo — [Strategy pattern](../35-strategy-pattern) — the receiving side, where the
  collaborator arrives through the constructor
- This repo — [Inheritance vs composition](../36-inheritance-vs-composition) and
  [Two reasons for inheritance](../38-two-reasons-for-inheritance) — the same "couple to the
  contract, not the implementation" rule on the inheritance axis
