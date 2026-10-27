# ADR-0001: Use a composition root and constructor injection

- Status: Accepted
- Date: 2026-10-27
- Deciders: architecture study notes
- Related: [Day 1 — trade-off vocabulary](../01-tradeoff-vocabulary.md), [composition-root note](../../fundamentals/oop/design-patterns/06-composition-root/composition-root.md), [runnable example](../../fundamentals/oop/design-patterns/06-composition-root/main.ts)

## Context

The order example has a service that needs three collaborators: an order repository, a mailer, and a clock. The domain logic must be testable without a database, an SMTP server, or the real system clock. The application also needs one visible place where concrete infrastructure choices are made.

The forces:

- **Testability** — application behavior should be testable with fakes, without booting production infrastructure.
- **Replaceability** — the repository, mailer, and clock should be replaceable without editing the domain service.
- **Clarity** — the object graph should be visible in one place, not spread across imports, globals, or hidden factories.
- **Simplicity** — the example should not require a container or a framework.

## Decision

`OrderService` depends on interfaces (`OrderRepository`, `Mailer`, `Clock`) supplied through its constructor. The concrete implementations are chosen once, in the composition root at `main.ts`. Application code does not resolve dependencies from a container or service locator.

The root is the only place allowed to import the concrete infrastructure:

```ts
const orders = new InMemoryOrderRepository();
const mailer = new ConsoleMailer();
const clock = new SystemClock();

const service = new OrderService(orders, mailer, clock);
```

## Consequences

### Positive

- The domain service is testable with in-memory or fake collaborators.
- The concrete choices are visible in one place.
- The service has no compile-time dependency on a database, mailer, or clock implementation.
- A test composition root can reuse the same service with different adapters.

### Negative

- The composition root must change when the application's wiring changes.
- Manual wiring grows as the graph grows; a container may become worthwhile later.
- The root itself is coupled to every concrete implementation, which is acceptable at the edge but must not leak inward.
- Constructor injection makes required dependencies explicit, but it does not fix runtime coupling, shared schemas, or bad interfaces.

### Neutral

- This is an application pattern, not a library pattern. A library should expose constructors and contracts; the consuming application owns composition.
- A DI container remains an option. If used, it belongs in the root.

## Alternatives considered

1. **Construct collaborators inside `OrderService`.** Rejected: it couples the service to concrete infrastructure and makes tests require real I/O.
2. **Use a global service locator.** Rejected: it hides dependencies from the constructor and makes the service reach for whatever it wants at runtime.
3. **Introduce a DI container from day one.** Rejected for this example: the graph is small, and explicit `new` calls are easier to read. A container can be introduced when registration and lifetime management actually pay for themselves.

## Revisit if

- The graph grows large enough that manual wiring becomes harder to read than registration.
- Lifetime management becomes complex enough to need scopes and container validation.
- The application gains multiple entry points that need different wiring.
- The root starts containing business decisions instead of composition decisions.

The decision would be wrong if it turned into a god object, or if application code started calling back into the root or a container.
