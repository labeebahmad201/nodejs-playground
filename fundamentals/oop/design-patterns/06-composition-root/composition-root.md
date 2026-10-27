# 06 — Composition root

*The one place where the application's object graph is built. It is allowed to know every concrete class; everything below it should know only the contracts.*

## The definition

Mark Seemann's definition:

> A Composition Root is a (preferably) unique location in an application where modules are composed together.
>
> — Mark Seemann, [*Composition Root*](https://blog.ploeh.dk/2011/07/28/CompositionRoot/) (2011)

The placement rule is just as important:

> As close as possible to the application's entry point.

The rule says "as close as possible" because a framework may not hand you the exact entry point. Use the earliest hook the framework exposes; do not compose in the middle of a feature module just because that is where the first object is needed.

That is the whole idea. Classes declare what they need through their constructors. The composition root is the one place that decides which concrete objects satisfy those constructor parameters and wires the graph together. Nothing below the root is allowed to make that decision for itself.

The root is a **role**, not a particular class. In a Node application it is usually a `main()` or `bootstrap()` function. In ASP.NET it is `Program.cs`; in a console application it is `Main`; in a framework it is the framework's startup hook. What matters is that the wiring happens once, at the edge, before the application starts doing work.

It is also an **application infrastructure component**, not domain code:

> Only applications should have Composition Roots. Libraries and frameworks shouldn't.
>
> — Seemann, *Composition Root*

A library exposes constructors and interfaces. The application that consumes the library decides which implementations to use. A library that builds its own dependencies has taken a choice away from its caller.

## The shape

Start with a service that depends only on contracts:

```ts
// domain/order-service.ts
import { randomUUID } from "node:crypto";

export interface Order {
  id: string;
  total: number;
  placedAt: Date;
}

export interface Clock {
  now(): Date;
}

export interface OrderRepository {
  save(order: Order): Promise<void>;
}

export interface Mailer {
  send(to: string, subject: string, body: string): Promise<void>;
}

export class OrderService {
  private readonly orders: OrderRepository;
  private readonly mailer: Mailer;
  private readonly clock: Clock;

  constructor(orders: OrderRepository, mailer: Mailer, clock: Clock) {
    this.orders = orders;
    this.mailer = mailer;
    this.clock = clock;
  }

  async placeOrder(customerEmail: string, total: number): Promise<void> {
    const order: Order = {
      id: randomUUID(),
      total,
      placedAt: this.clock.now(),
    };

    await this.orders.save(order);
    await this.mailer.send(customerEmail, "Order confirmed", `Total: ${total}`);
  }
}
```

`OrderService` does not know that orders live in Postgres, that mail goes through SMTP, or that time comes from the system clock. It knows three contracts and nothing else.

The composition root supplies the concrete answers:

```ts
// main.ts — the composition root
import { OrderService } from "./domain/order-service";
import { PostgresOrderRepository } from "./infrastructure/postgres-order-repository";
import { SmtpMailer } from "./infrastructure/smtp-mailer";
import { SystemClock } from "./infrastructure/system-clock";

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const db = await connect(config.databaseUrl);

  const orders = new PostgresOrderRepository(db);
  const mailer = new SmtpMailer(config.smtp);
  const clock = new SystemClock();

  const service = new OrderService(orders, mailer, clock);

  await service.placeOrder("ada@example.com", 42);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

The object graph is now visible in one place:

```text
main()
├── loadConfig(process.env)
├── connect(config.databaseUrl)
├── PostgresOrderRepository(db)
├── SmtpMailer(config.smtp)
├── SystemClock()
└── OrderService(orders, mailer, clock)
```

The root is the only place that knows all the concrete choices. `OrderService` knows only the three interfaces. That is the trade: the root is coupled to the whole application, but the application is not coupled to the root.

## Run the example

The runnable version of this graph lives in this folder:

```sh
node fundamentals/oop/design-patterns/06-composition-root/main.ts
```

`main.ts` is the composition root. `order-service.ts` imports only `contracts.ts`; `infrastructure.ts` holds the concrete implementations. No file below `main.ts` imports an implementation.

## What belongs in it

The composition root is allowed to be boring. It should contain no business decisions. Its job is to answer four questions:

- **Which implementation?** `PostgresOrderRepository` instead of `InMemoryOrderRepository`; `SmtpMailer` instead of `ConsoleMailer`.
- **Which lifetime?** One connection pool for the process, one repository per request, a fresh value object per call.
- **Which configuration?** Read environment variables and configuration files once, validate them, and pass typed values down. Do not let domain code read `process.env` later.
- **Which cross-cutting behavior?** Wrap a service with logging, metrics, retries, or a transaction decorator before handing it to its consumer.

It also owns the application's long-lived resources: the database pool, the HTTP client, the queue connection, the mail transport. If those need to be closed, the root is the natural place to close them.

What does **not** belong there:

- pricing rules, order state transitions, validation of business invariants;
- request handling;
- conditionals that choose behavior based on domain data;
- a second, hidden composition root inside a service;
- `new` for a collaborator that could have been injected.

The root may use `new` freely for **services and infrastructure**. A value object, a DTO, an error, or a short-lived data structure can still be constructed where it is used. The rule is not "no `new` anywhere"; it is "no hidden choice of collaborator below the edge."

There is a second boundary: the root composes **whole-object collaborators**, not per-call data. An order id, a request, or the current user belongs in a method parameter. Constructor injection is for things that live as long as the object; parameter injection is for things that change per call. The root should not hold request state just because it is the place where dependencies are assembled.

## What it fixes

| Problem | What the root changes |
| --- | --- |
| Coupling to a concretion | The `new` for a collaborator moves to the edge. The domain depends on the contract. |
| Hidden configuration | Environment and config are read once, validated, and passed as typed values. |
| Temporal coupling | Constructor injection makes the required dependencies part of creation; there is no "remember to initialize" step. |
| Global state | Shared objects are passed explicitly. One instance becomes a lifetime decision, not global access. |
| Testability | A test can compose the same unit with fakes without booting the application. |
| Lifecycle | Creation and disposal of long-lived resources happen in one place. |

The key move is that the root is the **only** place where the application's concrete choices are made. That is what turns dependency injection from a collection of constructor parameters into an actual architecture.

## What it does not fix

The root does not remove coupling. It concentrates the coupling at the edge:

- The domain still depends on the interfaces. If those interfaces are wrong, the root cannot save the design.
- The root itself depends on every concrete implementation. That is acceptable because it is infrastructure, but it means the root must change when the application's wiring changes.
- The root does not fix runtime coupling between services, shared databases, or event contracts. Those are separate problems.
- The root does not require a DI container.
- The root can become a god object. If it grows without limit, split it by entry point or by explicit registration modules—not by letting domain code call back into it.

## DI containers are optional

A DI container is a tool for building the object graph. It is not the definition of dependency injection, and it is not required by the composition root pattern. See [Dependency injection container](../07-dependency-injection-container/dependency-injection-container.md) for the deeper treatment.

The baseline is **Pure DI**: wire the graph with ordinary constructor calls, as in the `main()`example above. It is explicit, compile-time checked, and easy to read. For a small or medium application, it is often the better choice.

A container starts to pay for itself when the graph is large, lifetimes are complicated, or modules are loaded dynamically. It gives you registration, lifetime management, and resolution in one place. The trade-off is indirection: the graph is described by registrations rather than visible `new` calls, and some mistakes move from compile time to runtime. Common examples are `tsyringe`, `InversifyJS`, and `Awilix` in TypeScript, `Microsoft.Extensions.DependencyInjection` in .NET, and Spring in Java. The APIs and lifetime models differ; the boundary is the same.

The rule that keeps a container from becoming a problem is Seemann's:

> A DI Container should only be referenced from the Composition Root. All other modules should have no reference to the container.
>
> — Seemann, *Composition Root*

That is the difference between a container and a **Service Locator**. A container used inside the root is infrastructure. A container called from application code is a Service Locator: the dependency is no longer in the constructor, and the class can reach for anything it wants.

A useful test:

> If application code calls `resolve()`, `get()`, or `getInstance()`, the dependency is hidden.

### What a container is good at

- Registering a large number of interfaces and implementations.
- Managing lifetimes: singleton, scoped, transient.
- Creating a scope per request or per job.
- Loading modules or plugins at startup.
- Applying decorators and interceptors consistently.
- Validating the graph at startup so a missing registration fails fast.

### What it costs

- The graph is less visible than a sequence of `new` calls.
- Registration errors are often runtime errors unless you validate eagerly.
- Lifetimes become a configuration problem: a singleton that captures a scoped dependency is a classic bug.
- It is easy to let the container leak into domain code, at which point it becomes a Service Locator.
- Framework integrations can hide the composition root behind module decorators, making it harder to see where the graph is actually built.

Use a container when the complexity it removes is greater than the complexity it adds. Do not use one just to avoid writing a few constructor calls.

## The container version

The container stays in the root. The application code still uses constructor injection. The only difference is how the root builds the graph.

```ts
// main.ts — the container is a tool used by the root
import { Container } from "./infrastructure/container";

const container = new Container();

container.register(Clock, SystemClock);
container.register(OrderRepository, PostgresOrderRepository);
container.register(Mailer, SmtpMailer);
container.register(OrderService, OrderService);

const service = container.resolve(OrderService);
await service.placeOrder("ada@example.com", 42);
```

The registration API above is illustrative; every container names these operations differently. The shape is what matters:

1. The root creates and configures the container.
2. The root registers the concrete choices and lifetimes.
3. The root resolves the entry points once.
4. The rest of the application never sees the container.

A common large-application compromise is to keep registration modules close to the feature they register:

```ts
// composition/register-order-module.ts
export function registerOrderModule(container: Container): void {
  container.register(OrderRepository, PostgresOrderRepository);
  container.register(Mailer, SmtpMailer);
  container.register(OrderService, OrderService);
}
```

That is still composition as long as the module is called by the root and the domain does not import it. The registration module is part of the root's code, not part of the domain's code.

## Distinctions that matter

| Not this | Difference |
| --- | --- |
| **Service Locator** | A Service Locator is called from application code to fetch a dependency. A composition root resolves once at the edge and passes dependencies in. |
| **Factory** | A factory creates objects on demand inside the application. A composition root wires the application at startup. A factory can be a legitimate injected dependency when creation must be deferred. |
| **Singleton** | A singleton is a cardinality choice. The composition root decides whether the application uses one instance; it does not make that instance globally reachable. |
| **A module with top-level** `new` | If importing a module creates and connects services, that module has become an accidental composition root. The root should be the only place with that side effect. |
| **A framework's service collection** | The framework's registration hook is the composition root for that framework. Registrations should still be explicit about lifetimes and concrete choices. |

## Where it lives

The exact entry point depends on the runtime:

- **Node/TypeScript:** `main.ts`, `server.ts`, or `bootstrap.ts`, called from the package entry point.
- **ASP.NET Core:** `Program.cs` (and, in older versions, `Startup.ConfigureServices`).
- **Console applications:** `Main`.
- **Angular:** `main.ts` and the application module/bootstrap code.
- **NestJS:** `main.ts` plus the root module; the module system is part of the container configuration.
- **React:** `main.tsx` or the root component where providers and the outer application are composed.
- **Serverless functions:** module initialization or the cold-start path. Be careful not to put per-request state in a long-lived root; the root is per process, not per request.
- **Workers and queue consumers:** the worker process's entry point, separate from the HTTP entry point if the application has both.

A repository can have more than one composition root if it produces more than one application. An HTTP server and a CLI can each have their own root. What you should not have is multiple roots inside one process, each making different choices for the same graph.

## Testing

The composition root is not usually the unit under test. It is thin infrastructure. What matters is that the application below it can be composed without the root:

```ts
const service = new OrderService(
  new InMemoryOrderRepository(),
  new RecordingMailer(),
  new FixedClock(new Date("2026-01-01T00:00:00Z")),
);

await service.placeOrder("ada@example.com", 42);
```

The test is its own composition root. It chooses fakes and passes them in. It does not need the application's container, environment, or startup path.

Integration tests can use a **test composition root** that wires real infrastructure against a test database or a local mail catcher. The root stays the same shape; only the concrete choices change.

If a business rule is hard to test without booting the composition root, the root is probably doing too much or the dependency is still hidden.

## Common mistakes

| Mistake | Why it hurts |
| --- | --- |
| `new` inside a domain class | The class chooses its collaborator; the interface no longer protects anything. |
| `container.resolve()` inside a service | The container has become a Service Locator; dependencies disappear from the constructor. |
| A static `getInstance()` or global service registry | The graph is reachable from anywhere, so tests and callers cannot control it. |
| One root per feature | Composition happens too early; features cannot be composed differently for different applications. |
| Business logic in the root | The root becomes hard to test and the domain logic leaks into infrastructure. |
| `process.env` read deep in the graph | Configuration is a hidden input; the root no longer shows what the application needs. |
| A composition root in a library | The library has taken a choice away from the application that consumes it. |
| A singleton that captures a scoped dependency | The short-lived object lives forever and is shared across requests. |
| A domain module that imports the root | Importing domain code has startup side effects and creates a second composition path. |
| A container used "just in case" | The indirection and runtime errors are paid without a corresponding benefit. |

## One-line summary

> **Compose the object graph at the edge, once. Below the edge, every class receives its collaborators and knows only the contracts.**

## References

- Mark Seemann — *Composition Root* (2011) — <https://blog.ploeh.dk/2011/07/28/CompositionRoot/>
- Mark Seemann — *Pure DI* (2014) — <https://blog.ploeh.dk/2014/06/10/pure-di/>
- Mark Seemann — *Service Locator is an Anti-Pattern* (2010) — <https://blog.ploeh.dk/2010/02/03/ServiceLocatorisanAnti-Pattern/>
- Mark Seemann — *Service Locator roles vs. mechanics* (2011) — <https://blog.ploeh.dk/2011/08/25/ServiceLocatorrolesvs.mechanics/>
- Martin Fowler — *Inversion of Control Containers and the Dependency Injection pattern* (2004) — <https://martinfowler.com/articles/injection.html>
- Mark Seemann and Steven van Deursen — *Dependency Injection Principles, Practices, and Patterns*(Manning, 2019) — composition root, lifetimes, and the DI anti-patterns

Related notes:

- [What coupling is](../../00-what-is-coupling.md) — why `new` in the domain is coupling to a concretion.
- [Coupling to a concretion](../../strategy-polymorphism/39-coupling-to-concretion.md) — the same mistake in its other forms.
- [Seams](../../strategy-polymorphism/40-seam.md) — the composition root is the application's largest seam.
- [Global access and coupling](../05d-global-access-and-coupling.md) — why one instance is fine but global reachability is not.
- [Dependency injection container](../07-dependency-injection-container/dependency-injection-container.md) — the container as a tool used by the root.