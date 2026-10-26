# 05d — Global access, coupling, and injection

*The objection to Singleton is not that one instance exists. It is that the instance can be
reached without being passed.*

## One instance is not the problem

Miško Hevery's distinction is the one to keep:

> There is nothing wrong with having a single instance of a class... However, when I complain
> about the Singletons, I complain about the design pattern. Specifically: (1) private
> constructor and (2) global instance variable which refers to the singleton.

The GoF pattern bundles two things: **cardinality** (one instance) and **global reachability**
(anyone can fetch it). The first is a legitimate application-lifetime decision. The second is
the defect. Hevery's phrase for the combination is "global state in sheep's clothing."

This is why replacing `getInstance()` with `export const db` changes nothing: there is still one
object, still reachable from anywhere, still invisible in every signature.

An **application singleton** — one instance in the app that does not enforce its own
singleton-ness — is not the pattern. The object is shared; the class is ordinary; the
composition root decides the lifetime.

## The coupling has a name

This is not a modern opinion. In the structured-design coupling scale (Stevens, Myers &
Constantine, 1974), **common coupling** means several modules share the same global data. It sits
second-worst, just below content coupling and well above data coupling, where modules exchange
only the parameters they need.

The name comes from FORTRAN's `COMMON` blocks, but the mechanism is unchanged:

```ts
class Settings {
  static #instance = new Settings();
  mode = "safe";

  static get(): Settings {
    return Settings.#instance;
  }
}

class A {
  run(): void {
    Settings.get().mode = "fast";
  }
}

class B {
  run(): string {
    return Settings.get().mode;
  }
}
```

`A` and `B` never mention each other. They are still coupled: `B`'s result depends on whether
`A` ran first, and neither signature says so. That is the whole problem in one example.

## What it costs

**Hidden dependency.** `charge(order)` looks self-contained. Nothing in its signature says it
will reach for a database, a clock, or a config. The API "lies about its true dependencies";
the reader has to know the module by heart.

**Action at a distance.** A mutates shared state; B reads it; B's behavior changes without B
being touched. Tests, background jobs, and request handlers can all interfere through the same
object.

**Transitivity — "global load."** Anything reachable from the global is global too. The
reachability is not one variable: a singleton cache exposes every entry and every mutable field
of every entry. Hevery's *global load* is the amount of state exposed for direct or indirect
mutation through globals; a singleton with a `Map` has unbounded global load.

**No substitution.** A class wired to `Database.getInstance()` can only collaborate with that
implementation. As J.B. Rainsberger put it, you have said the class "can only collaborate with
one particular implementation... You will allow no substitutes." That is a direct obstacle to
testing in isolation.

**Test order becomes part of the specification.** Mutable global state survives between tests in
the same process. The workaround — `reset()`, `setForTest()` — reopens the hole it was meant to
close and makes parallel tests unreliable.

## This is not an SRP problem

It is tempting to call global access a second responsibility. That is the wrong axis. SRP is
about **actors**: if one team owns both the lifecycle policy and the persistence policy, that is
one reason to change, not two. Moving the database into a collaborator fixes the SRP complaint
and leaves the coupling untouched.

The surviving charges are different:

- **Dependency Inversion** — the class depends on a concretion and on a global lookup instead of
  an injected abstraction.
- **Encapsulation** — the class reaches outside its own boundary for a collaborator.
- **Common coupling** — modules share mutable global data.

Injection fixes all three. Composition alone fixes only the first.

## The refactoring

The change is not "stop having one instance." It is "stop fetching it."

```ts
// before — the dependency is reached, not passed
class BillingService {
  charge(orderId: string): void {
    const db = Database.getInstance();
    db.query("insert into charges ...", [orderId]);
  }
}
```

```ts
// ports.ts — the contract, owned by the consumer
export interface OrderStore {
  save(orderId: string): Promise<void>;
}

// billing-service.ts — receives the contract
export class BillingService {
  private readonly orders: OrderStore;

  constructor(orders: OrderStore) {
    this.orders = orders;
  }

  async charge(orderId: string): Promise<void> {
    await this.orders.save(orderId);
  }
}

// main.ts — the composition root, the only place that knows the adapter
const orders: OrderStore = new PostgresOrderStore(pool);
const billing = new BillingService(orders);
```

The test no longer needs a global or a reset:

```ts
const calls: string[] = [];
const fake: OrderStore = { save: async (id) => { calls.push(id); } };

await new BillingService(fake).charge("A-1");
// calls === ["A-1"] — no database, no global state
```

Three rules make it hold:

1. **One composition root.** `main.ts` / bootstrap is the only place that constructs the graph.
   Containers are optional; pure DI is usually enough in Node.
2. **Inject, don't fetch.** The dependency is a constructor parameter, so it appears in the
   signature and the compiler can check it.
3. **The interface belongs to the consumer.** The domain declares `OrderStore`; the adapter
   implements it. In TypeScript, use `import type` in the domain so the adapter is never
   imported at runtime.

Lifetime is now a wiring decision. The composition root can create one instance (application
scope), one per request (scoped), or a new one per use (transient). The class does not know or
care; that is precisely why it stops being a Singleton.

## What injection fixes — and what it does not

Injection makes shared state **visible**, not **safe**.

If A and B both receive the same mutable `OrderStore`, they can still affect each other through
it. The action at a distance is still there; it is now declared in their constructors, which is
a large improvement for reasoning and testing, but it is not isolation.

For isolation you need one of:

- **immutability** — shared values that cannot change;
- **narrow interfaces** — a read-only view where the consumer only reads;
- **shorter lifetimes** — request-scoped or transient instead of application-scoped.

A singleton that holds request or user state is a smell no matter how it is injected.

## The alternatives, corrected

| Approach | Hides the dependency? | Keeps one instance? | Verdict |
| --- | --- | --- | --- |
| Constructor injection + composition root | no | yes, as a lifetime choice | recommended |
| Injected factory (Abstract Factory / Factory Method) | no | yes | good when creation must be deferred or parameterized |
| Static factory returning a cached instance | yes | yes | a Singleton with extra steps |
| Service locator | yes | yes | anti-pattern |
| Monostate (all instances share state) | yes | no — shared state, not identity | does not address the coupling |

**Service Locator** is not an alternative. `locator.get(Settings)` hides the dependency exactly
as `Settings.getInstance()` does; it turns compile-time errors into runtime ones and makes
breaking changes hard to see. Seemann's 2010 post is the canonical argument. A DI container used
inside the composition root is not a service locator; application code calling `resolve()` is.

**Monostate** ("Borg") shares state through class-level fields. It removes the identity
constraint and keeps the global mutable state, which is the part that hurts. Every instance is a
window onto the same hidden data.

**Factory** is complementary, not a replacement. A *static* factory that returns a cached
instance is the same global access with more indirection. An *injected* factory is DI: it is
useful when the consumer must create objects later, or with parameters it does not own.

## When a global is acceptable

The critique is about mutable global state and hidden dependencies, not about every shared
object. The usual carve-outs:

- **Immutable configuration.** If everything reachable from the singleton is immutable, there is
  no mutable global state. Hevery allows this, while noting how easily it turns mutable.
- **Write-only cross-cutting concerns.** Logging and metrics: information flows one way, and the
  application behaves the same whether logging is on. Hevery calls this semi-acceptable. If a
  test must assert on logs, inject the logger.
- **Stable dependencies.** Value objects and pure helpers can be constructed directly. Seemann's
  rule is to inject the **volatile** dependencies — database, clock, HTTP, configuration that
  changes per environment — not everything.
- **Process-level facts.** Signal handlers, `process.env`, the working directory. There is
  nothing to substitute and no shorter lifetime to give them.

Everything else — a connection pool, a repository, a mutable cache, a session store — is exactly
the kind of thing that should be injected and scoped deliberately.

## Three questions

1. **Could a second instance of the application exist in the same process without collisions?**
   If not, you have process-global state.
2. **Can a test replace it?** If not, it is global state with a pattern name.
3. **How much mutable state is reachable from it?** That is the global load, and it is usually
   larger than the single variable suggests.

## One-line summary

> **Keep the instance if the lifetime is genuinely application-wide; remove the global access.
> Create it once at the composition root, pass it through a constructor, and let consumers depend
> on a narrow contract — then one instance is a wiring decision, not a pattern.**

## References

- Miško Hevery — *Root Cause of Singletons* (Google Testing Blog, 2008) —
  <https://testing.googleblog.com/2008/08/root-cause-of-singletons.html>
- Miško Hevery — *Guide to Writing Testable Code*, "Brittle Global State & Singletons" —
  <https://github.com/mhevery/guide-to-testable-code/blob/main/flaw-brittle-global-state-singletons.md>
- Mark Seemann — *Service Locator is an Anti-Pattern* (2010) —
  <https://blog.ploeh.dk/2010/02/03/ServiceLocatorisanAnti-Pattern/>
- Mark Seemann — *Some thoughts on anti-patterns* (2019), on Ambient Context —
  <https://blog.ploeh.dk/2019/01/21/some-thoughts-on-anti-patterns/>
- Mark Seemann, Steven van Deursen — *Dependency Injection Principles, Practices, and Patterns*
  (Manning, 2019) — composition root, lifetimes, the DI anti-patterns
- Martin Fowler — *Inversion of Control Containers and the Dependency Injection pattern* (2004) —
  <https://martinfowler.com/articles/injection.html>
- Martin Fowler — *Dependency Composition* (2023) —
  <https://martinfowler.com/articles/dependency-composition.html>
- W. Stevens, G. Myers, L. Constantine — *Structured Design*, IBM Systems Journal 13(2), 1974 —
  the coupling scale, including common coupling
- J.B. Rainsberger — *JUnit Recipes*, recipe 14.4, on Singleton coupling and test isolation
- This repo — [Singleton](./05-singleton.md), [the guarded
  singleton](./05c-singleton.ts), [Dependency Inversion](../../32-solid/06-dip/README.md),
  [Inversion of Control](../../02-inversion-of-control/README.md), [Cardinality and
  lifetime](../05-cardinality.md)
