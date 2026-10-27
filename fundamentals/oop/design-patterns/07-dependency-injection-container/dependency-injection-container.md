# 07 — Dependency injection container

*A container is a machine for building the object graph at the edge. It is not the architecture. If
application code can reach it, it has become a Service Locator.*

## The definition

A dependency injection container is a library or runtime that:

- **registers** a mapping from a token, type, or contract to a factory or implementation;
- **resolves** an object graph by calling those factories and supplying their dependencies;
- **manages lifetimes** such as singleton, scoped, and transient;
- optionally applies decorators, interceptors, configuration, and startup validation.

It is a tool, not a pattern. The pattern is dependency injection: a class declares what it needs
through its constructor and receives it from outside. The [composition
root](../06-composition-root/composition-root.md) is the place where those choices are made. A
container is one way to write that place.

That ordering matters:

| Concept | What it is |
| --- | --- |
| **Inversion of control** | The caller no longer creates its collaborators; control over creation moves outward. |
| **Dependency injection** | A form of inversion of control: dependencies arrive through a constructor, parameter, or property. |
| **Composition root** | The one place at the application edge where the concrete choices are made. |
| **DI container** | An optional tool that helps the composition root register and resolve the graph. |

A container without constructor injection is just a global registry with extra steps. Constructor
injection without a container is still dependency injection.

## What it actually does

The smallest useful container has three jobs.

### 1. Registration

You tell the container which implementation to use for a contract:

```ts
container.register<Clock>(tokens.clock, () => new SystemClock(), "singleton");
container.register<OrderRepository>(
  tokens.orderRepository,
  () => new InMemoryOrderRepository(),
  "singleton",
);
container.register<Mailer>(
  tokens.mailer,
  () => new ConsoleMailer(),
  "singleton",
);
```

In TypeScript, an interface disappears at runtime. The container needs a runtime token — a class, a
string, or a symbol. The runnable example uses symbols:

```ts
const tokens = {
  clock: Symbol("Clock"),
  orderRepository: Symbol("OrderRepository"),
  mailer: Symbol("Mailer"),
  orderService: Symbol("OrderService"),
} as const;
```

### 2. Resolution

The container builds the graph by calling the registered factories:

```ts
container.register<OrderService>(
  tokens.orderService,
  (c) =>
    new OrderService(
      c.resolve<OrderRepository>(tokens.orderRepository),
      c.resolve<Mailer>(tokens.mailer),
      c.resolve<Clock>(tokens.clock),
    ),
);
```

The `OrderService` constructor does not mention the container. It still receives three interfaces.
The container is only the thing that assembles them.

### 3. Lifetime management

The container decides whether a registration is created once, once per scope, or every time. That is
the feature that usually justifies a container in the first place: a large graph with a mix of
long-lived infrastructure and short-lived request state is tedious to wire by hand.

## The boundary rule

The rule that keeps a container from becoming a problem is Mark Seemann's:

> A DI Container should only be referenced from the Composition Root. All other modules should have
> no reference to the container.
>
> — Mark Seemann, [*Composition Root*](https://blog.ploeh.dk/2011/07/28/CompositionRoot/) (2011)

A container used inside the composition root is infrastructure. A container called from application
code is a **Service Locator**: the dependency is no longer in the constructor, and the class can
reach for anything it wants.

Bad:

```ts
class OrderService {
  constructor(private readonly container: Container) {}

  async placeOrder(customerEmail: string, total: number): Promise<void> {
    const mailer = this.container.resolve<Mailer>(tokens.mailer);
    await mailer.send(customerEmail, "Order confirmed", `Total: ${total}`);
  }
}
```

Good:

```ts
class OrderService {
  constructor(private readonly mailer: Mailer) {}

  async placeOrder(customerEmail: string, total: number): Promise<void> {
    await this.mailer.send(customerEmail, "Order confirmed", `Total: ${total}`);
  }
}
```

The second version can be tested by passing a fake. The first version requires a configured
container before the class can do anything, and its real dependencies are invisible from its
constructor.

Seemann's distinction is about roles, not mechanics:

> It becomes a Service Locator if used incorrectly: when application code (as opposed to
> infrastructure code) actively queries a service in order to be provided with required
> dependencies, then it has become a Service Locator.
>
> — Mark Seemann, [*Service Locator roles vs.
> mechanics*](https://blog.ploeh.dk/2011/08/25/ServiceLocatorrolesvs.mechanics/) (2011)

Resolution at the root is composition. Resolution in the middle of the application is lookup.

## Lifetimes and scopes

| Lifetime | Meaning | Typical use | What goes wrong |
| --- | --- | --- | --- |
| **Singleton** | One instance per container (usually per process). | Configuration, connection pools, stateless services. | Mutable global state; a singleton captures a shorter-lived dependency. |
| **Scoped** | One instance per scope, such as a request or job. | Database context, request context, unit of work. | Scope mismatch; state leaks between requests; a singleton captures it. |
| **Transient** | A new instance every time it is resolved. | Cheap stateless objects and per-call collaborators. | Too many allocations; disposables are created and never released. |

The classic lifetime bug is the **captive dependency**: a singleton resolves a scoped dependency and
keeps it alive forever. The scoped object is now effectively a singleton, and every request shares
the same state.

A container should validate this at startup where possible. If it cannot, the composition root
should make the scopes explicit and test the graph.

Scopes are also where many containers earn their keep:

- one scope per HTTP request;
- one scope per background job;
- one scope per message;
- one root scope for the process.

The composition root creates the root scope. The framework or worker creates the child scopes.

## Registration styles

| Style | Strengths | Costs |
| --- | --- | --- |
| **Explicit registration** | Visible, compile-time friendly, easy to trace. | More code as the graph grows. |
| **Feature registration modules** | Keeps registrations near the feature; the root still calls them. | Easy to let modules turn into hidden roots. |
| **Convention scanning** | Less boilerplate; useful for plugins and large assemblies. | Magic; harder to see what is registered; startup surprises. |
| **Configuration files** | Deployment-time choices without a rebuild. | Drift, weak typing, and runtime failures; poor for domain logic. |

The important boundary is not *where the registration code lives*; it is *who is allowed to call
it*. A `registerOrderModule(container)` function is still composition if the root calls it and the
domain never imports it.

## The runnable example

The example lives in this folder:

- `container.ts` — a deliberately small container with registration, resolution, lifetimes, and
  circular-dependency detection.
- `main.ts` — the composition root. It is the only file that imports the container.
- It reuses the domain and infrastructure from
  [`../06-composition-root/`](../06-composition-root/).

Run it from the repo root:

```sh
node fundamentals/oop/design-patterns/07-dependency-injection-container/main.ts
```

Or from inside the folder:

```sh
node main.ts
```

The example registers the repository, mailer, and clock as singletons, and `OrderService` as a
transient. It then resolves two services and places an order through each one. The assertions check
that:

- the two `OrderService` instances are different;
- both share the same repository and mailer;
- two orders were stored;
- two emails were sent.

The output ends with:

```text
[container] OrderService is transient: true
[container] repository is singleton: true
[container] saved orders: 2
[container] sent emails: 2
assertions passed
```

The container in `container.ts` is a teaching implementation, not a production one. It does not
implement scopes, decorators, async disposal, module scanning, or graph validation. Real containers
add those, and each addition has a cost.

## When to use a container

Use one when the graph is large enough that hand-wiring obscures it, or when the application needs
something a container is genuinely good at:

- many registrations and several entry points;
- request, job, or message scopes;
- plugins or dynamically loaded modules;
- consistent decorators and interceptors;
- startup validation of the whole graph;
- framework integration that expects a container.

Do not use one just because dependency injection is mentioned. Pure DI — a few `new` calls in the
composition root — is often clearer for a small or medium application. Do not put a container in a
library or framework; the application that consumes it should own the composition.

A container is not an architecture. It does not design your interfaces, decide your boundaries, or
fix a graph that is already tangled.

## Common mistakes

| Mistake | Why it hurts |
| --- | --- |
| Injecting the container into a service | The service can resolve anything; dependencies disappear from its constructor. |
| Calling `resolve()` in application code | The container has become a Service Locator. |
| Using a static container or global registry | The graph is reachable from anywhere, so tests and callers cannot control it. |
| Registering everything as a singleton | Mutable state is shared globally, and scoped dependencies become captive. |
| Registering everything as transient | Disposable objects leak, and identity-sensitive services are recreated unexpectedly. |
| Hiding registrations in convention scans | The graph is hard to trace; a missing or duplicate registration fails at runtime. |
| Registering dependencies inside domain modules | Domain code now depends on the container. |
| Skipping graph validation | Missing registrations and lifetime errors surface in production. |
| Resolving inside constructors | Construction order becomes fragile; use an injected factory when creation must be deferred. |
| Treating the container as a service registry | The container becomes the application's public API instead of its startup tool. |

## Testing

- **Unit tests** should not need the container. Construct the class with fakes, as the composition
  root note shows.
- **Integration tests** can use a test composition root or a test container with overrides for the
  database, clock, and mail transport.
- **Container tests** should resolve every entry point at startup. A graph that cannot be built
  should fail before the first request, not during it.
- **Lifetime tests** should check that a singleton does not capture a scoped dependency and that a
  scope does not leak into the next one.

If a test needs the whole container to exercise one business rule, the rule is probably coupled to
infrastructure that should have been injected.

## One-line summary

> **Use a container to build the graph at the edge. Never let it become the graph's public API.**

## References

- Mark Seemann — *Composition Root* (2011) —
  <https://blog.ploeh.dk/2011/07/28/CompositionRoot/>
- Mark Seemann — *Pure DI* (2014) —
  <https://blog.ploeh.dk/2014/06/10/pure-di/>
- Mark Seemann — *Service Locator is an Anti-Pattern* (2010) —
  <https://blog.ploeh.dk/2010/02/03/ServiceLocatorisanAnti-Pattern/>
- Mark Seemann — *Service Locator roles vs. mechanics* (2011) —
  <https://blog.ploeh.dk/2011/08/25/ServiceLocatorrolesvs.mechanics/>
- Martin Fowler — *Inversion of Control Containers and the Dependency Injection pattern* (2004) —
  <https://martinfowler.com/articles/injection.html>
- Microsoft — *Dependency injection in .NET* —
  <https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection>
- Mark Seemann and Steven van Deursen — *Dependency Injection Principles, Practices, and Patterns*
  (Manning, 2019) — lifetimes, scopes, and the DI anti-patterns

Related notes:

- [Composition root](../06-composition-root/composition-root.md) — where the graph is assembled.
- [Global access and coupling](../05d-global-access-and-coupling.md) — why one instance is fine
  but global reachability is not.
- [What coupling is](../../00-what-is-coupling.md) — the dependency the container is trying to
  make explicit.
