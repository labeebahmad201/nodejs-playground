# Object-Oriented Programming

*Mechanics vs philosophy. The "how" vs the "why".*

## Core
- [00-what-is-coupling.md](./00-what-is-coupling.md) — what coupling is, measured by change; tight coupling through `new`; testability; and coupling to an abstraction by constructor or parameter injection
  - [00a-hidden-coupling.md](./00a-hidden-coupling.md) — dependencies with no import or type reference, visible only at runtime or in change history
  - [00b-temporal-sequential-coupling.md](./00b-temporal-sequential-coupling.md) — required call order that the API does not enforce, and the constructor-injection fix
  - [00c-implicit-global-state.md](./00c-implicit-global-state.md) — why shared mutable state is a hidden input, and the DI plus composition-root fix
  - [00d-event-bus-topic-coupling.md](./00d-event-bus-topic-coupling.md) — why a topic-string typo fails silently, and the runtime-schema plus versioned-contract fix
  - [00e-shared-database-schema-coupling.md](./00e-shared-database-schema-coupling.md) — why multiple services on one schema are coupled, and database per service
- [01-four-fundamentals.md](./01-four-fundamentals.md) — Encapsulation, Abstraction, Inheritance, Polymorphism
- [02-history-of-oop.md](./02-history-of-oop.md) — Simula vs Smalltalk, why we lost the "why", and why history repeats

## Strategy, Polymorphism, Inheritance, Composition
- [strategy-polymorphism/34-strategy-vs-subtype-polymorphism.md](./strategy-polymorphism/34-strategy-vs-subtype-polymorphism.md)
- [strategy-polymorphism/35-strategy-pattern.md](./strategy-polymorphism/35-strategy-pattern.md)
- [strategy-polymorphism/36-inheritance-vs-composition.md](./strategy-polymorphism/36-inheritance-vs-composition.md)
- [strategy-polymorphism/38-two-reasons-for-inheritance.md](./strategy-polymorphism/38-two-reasons-for-inheritance.md)
- [strategy-polymorphism/39-coupling-to-concretion.md](./strategy-polymorphism/39-coupling-to-concretion.md)
- [strategy-polymorphism/40-seam.md](./strategy-polymorphism/40-seam.md)
- [strategy-polymorphism/41-testability-and-anti-patterns.md](./strategy-polymorphism/41-testability-and-anti-patterns.md)
- [strategy-polymorphism/42-when-to-use-subtype-polymorphism.md](./strategy-polymorphism/42-when-to-use-subtype-polymorphism.md)

## Design patterns
- [design-patterns/01-observer-pattern.md](./design-patterns/01-observer-pattern.md) — Observer: one-to-many change notification instead of polling
- [design-patterns/05d-global-access-and-coupling.md](./design-patterns/05d-global-access-and-coupling.md) — global access as common coupling, and the injection refactor
- [design-patterns/06-composition-root/composition-root.md](./design-patterns/06-composition-root/composition-root.md) — compose the object graph once at the application's entry point; runnable example in the same folder
- [design-patterns/07-dependency-injection-container/dependency-injection-container.md](./design-patterns/07-dependency-injection-container/dependency-injection-container.md) — what a DI container adds, when it helps, and why it belongs only at the composition root; runnable example in the same folder
- [design-patterns/08-testing-composition-root/testing-composition-root.md](./design-patterns/08-testing-composition-root/testing-composition-root.md) — how to test the root without mocking every `new`; runnable tests in the same folder
