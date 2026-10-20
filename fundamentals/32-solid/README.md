# SOLID

*A container for the five object-oriented design principles that keep code easy to change:
each letter is a principle, each subdirectory is one deep dive, and every one of them is really
about the same thing — managing the cost of change.*

- **S** — Single Responsibility Principle
- **O** — Open/Closed Principle
- **L** — Liskov Substitution Principle
- **I** — Interface Segregation Principle
- **D** — Dependency Inversion Principle

## The five

| Letter | Principle | One-line version | Notes |
| --- | --- | --- | --- |
| S | **Single Responsibility** | one class, one reason to change | → [01-srp/](./01-srp) |
| O | **Open/Closed** | open for extension, closed for modification | → [03-ocp/](./03-ocp) |
| L | **Liskov Substitution** | subtypes must be usable as their base type | → [04-lsp/](./04-lsp) |
| I | **Interface Segregation** | many small interfaces beat one fat one | todo |
| D | **Dependency Inversion** | depend on abstractions, not concretions | see `02-inversion-of-control` |

## How they fit together

SOLID is one idea seen from five angles: **decouple change causes from each other.**

- **SRP** attacks it at the *class boundary* — one class, one responsibility.
- **OCP** attacks it at the *extension boundary* — new behavior shouldn't require editing old code.
- **LSP** attacks it at the *inheritance boundary* — a subtype must honor the contracts of its parent.
- **ISP** attacks it at the *interface boundary* — clients shouldn't depend on methods they don't use.
- **DIP** attacks it at the *dependency boundary* — policy shouldn't depend on detail.

The principles are complementary, not a checklist: SRP tells you to split the class, ISP and DIP
tell you how to stitch the pieces back together without re-creating the coupling.

## Rules of thumb when applying any of them

- They prevent pain, they don't create value by themselves. A preemptive refactor for a system
  that never changes is waste.
- Apply at the seams that actually change. Volatile, fast-moving code earns SOLID; stable code
  earns nothing special.
- Every principle has a cost. Five classes and three abstractions where one class would do is
  not a win — the boundary you draw should pay for itself the first time the code changes.

## Sub-notes

- [Single Responsibility Principle (SRP)](./01-srp) — the baker class, four reasons to change, and
  what splitting it buys you.
- [The Uncle Bob Test](./02-uncle-bob-test) — SRP as a blame question: ask who will get paged when
  the code breaks; two different accountable people is a clear violation.
- [Open/Closed Principle (OCP)](./03-ocp) — Meyer's principle, Martin's Shape/Circle/Square
  example, and why adding a variant should be a new class, not another `if/else` branch.
- [Liskov Substitution Principle (LSP)](./04-lsp) — the Square/Rectangle substitution failure:
  why a subtype must honor the base class's behavior, not just its signatures.
