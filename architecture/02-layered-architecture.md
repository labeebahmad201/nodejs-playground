# 02 — Layered architecture

*A layered architecture organizes code by technical role — presentation, application, domain, infrastructure — and points the dependencies down toward the database.*

This is the Day 2 note on the style the other three are defined against. It is not a style to adopt wholesale, and it is not a strawman to knock down.

## The definition

A **layered architecture** decomposes the application horizontally by **what the code does technically**, not by what the business does.

The canonical four layers:

| Layer | Contains | Typical names |
| --- | --- | --- |
| **Presentation** | Input handling, validation, view models, HTTP/CLI/UI | `controllers/`, `routes/`, `handlers/` |
| **Application / business** | Use-case orchestration, transactions, authorization | `services/`, `use-cases/`, `application/` |
| **Domain / model** | Entities, value objects, business rules | `models/`, `domain/`, `entities/` |
| **Infrastructure / persistence** | Database, ORM, mail, queues, external APIs | `repositories/`, `adapters/`, `infrastructure/` |

Different sources split this differently. Fowler's *PoEAA* uses **presentation → domain → data source**; Richards and Ford use **presentation → business → persistence → database**; many frameworks collapse application and domain into a single "service" layer. The names are inconsistent. What matters is the axis: **technical role at the top level, dependencies flowing downward.**

The layers are usually logical, not physical. Everything runs in one process; a "layer" here is a package boundary, not a network hop. That is the difference between a **layer** (logical) and a **tier** (physical). Collapsing the two is a common interview mistake.

## The canonical shape

At file level, the pattern looks like this:

```text
src/
  controllers/
    <feature>.controller.ts      parse and validate input; map to a service call
    <feature>.routes.ts          wire the transport to the controller
  services/
    <feature>.service.ts         orchestrate; own the transaction and authorization
  models/
    <feature>.ts                 entity and business rules
    <feature>-status.ts          value objects
  repositories/
    <feature>.repository.ts      persistence interface, shaped by queries
  infrastructure/
    db.ts                        connection, pool, migrations
    mailer.ts                    outbound adapter
  composition-root.ts            the one place that chooses concretions
```

The placeholders are deliberate: the pattern has no opinion about the business domain. The only axis it fixes is technical role.

A request walks straight down and back up:

```text
HTTP request
  → controller      parse, validate, map the input
  → service         begin a transaction, orchestrate, authorize
  → model           apply business rules
  → repository      persist
  → adapter         send the side effect (mail, queue, external API)
```

Every feature is spread across every folder. To change one feature, you touch all of them.

### The same layers, inside a capability

The fix is not to delete the layers. It is to change the top-level axis: one folder per capability, with the layers private to it.

```text
src/
  modules/
    <capability-a>/
      domain/
      application/
      infrastructure/
      index.ts                 the only public entry point
    <capability-b>/
      domain/
      application/
      infrastructure/
      index.ts
  shared/
    money.ts
    ids.ts
  composition-root.ts
```

This is the modular-monolith shape from [01a](01a-modular-monolith.md#module-boundaries-are-not-layers). The dependency rule is unchanged; the boundary that owns it moves. A feature change lands in one module instead of five top-level folders, and the module can still be refactored to ports and adapters internally.

## Closed, open, and isolation

Two properties are often conflated:

- **Layers of isolation** — a change in one layer does not ripple into the others. This is the actual goal.
- **Layers of encapsulation** — a layer may call only the layer directly below it.

A **closed** layer enforces encapsulation: presentation may call application, but not persistence. An **open** (or *relaxed*) layer may be skipped: a controller may call a repository directly.

Almost every real "layered" codebase is relaxed. Strict closed layering produces a lot of pass-through methods, and pass-through methods are the first symptom of the sinkhole. Which is the honest tension: **the rule that is supposed to protect the design is often the thing that makes it ceremonial.**

## What it optimizes

Layered is the default for a reason. It is not naive; it is cheap.

- **Familiarity.** Rails, Spring MVC, NestJS, Django, and most MVC frameworks hand it to you. There is no design meeting required to start.
- **Separation of technical concerns.** Validation, authorization, transactions, mapping, and persistence each have an obvious home. A reviewer knows where to look.
- **Onboarding.** A new developer can place a file correctly on day one without understanding the business.
- **Replaceability in principle.** Swap the UI, or the database, without touching the rules — in principle, and only if the domain was kept free of their types.
- **Thin domains.** Admin panels, CRUD backends, integration glue, internal tools. If the domain is a form over a table, the structure costs almost nothing and buys real consistency.
- **Transaction scripts.** Fowler's [transaction script](https://martinfowler.com/eaaCatalog/transactionScript.html) is a legitimate pattern, and layered is its natural home. Not every system needs a domain model.

That last point matters: **layered architecture does not require an anemic domain.** You can put a rich domain model in the domain layer. The critiques below are about dependency direction and decomposition axis, not about richness. A layered system with a rich domain and a persistence-shaped core is still a layered system, and still leaks.

## What it costs

### The dependency arrow ends at the database

This is the deep problem, and it is not about folder names.

In a layered architecture the database is the **foundation**. Presentation depends on application, application depends on domain, domain depends on persistence. The arrows terminate in infrastructure. So infrastructure dictates the shape of everything above it:

- entities are ORM classes with decorators, lazy loading, and change tracking;
- repository interfaces are shaped by query needs — `findByEmailAndStatusWithLineItems`;
- the domain cannot be constructed without a database connection;
- a schema migration ripples through business rules.

Layering is **not** dependency inversion. Interfaces between layers give you a seam; they do not change who owns the contract. If the repository interface lives with persistence, the domain still depends on persistence — you have just renamed the dependency.

Dependency injection is not the same thing either. Injecting a collaborator answers *who constructs it*, not *what the consumer is allowed to know about it*. A constructor parameter typed as a concrete class is still a concrete dependency; moving the `new` to a container or a composition root does not change the type the consumer declares. The service below is constructor-injected and still leaks.

That is exactly what hexagonal and clean invert: the domain owns the ports, and infrastructure implements them. The arrows point inward instead of down.

### Feature scattering

One feature change touches the controller, the service, the repository, the model, the DTO, and the mapper. That is high change cost, more merge conflict, and low cohesion per change. The **unit of change becomes the layer**, not the business capability.

This is the cost that vertical slice attacks directly. Clean architecture does not fix it: its rings are still technical rings.

### Layer-first layout hides the capability boundary

When every controller lives in `controllers/`, every service in `services/`, and every model in `models/`, the top-level view tells you **what kind of code a file is**, not **what capability it serves**. To understand one feature you open five folders and reconstruct the story yourself. There is no place that says "this is Orders," and no folder to make private when you want to enforce that boundary.

That is a **risk factor** for a big ball of mud, not the definition of one. The mud is created by unmanaged dependencies and shared state — a shared `models/` that every capability imports, tables several features write, a transaction that spans unrelated concerns. The layer layout removes the visible boundary cue and makes erosion cheap; it does not, by itself, create the coupling.

Extraction is where the bill arrives. Pulling one capability out means finding its pieces across every folder, untangling the shared models, separating its tables, and deciding what happens to transactions that were never meant to be together. The file hunt is the visible cost; the hidden coupling is the real one. See [02a — Big ball of mud](02a-big-ball-of-mud.md).

### The sinkhole

The **sinkhole anti-pattern** is a request that passes through every layer doing nothing but forwarding. Controller calls service calls repository. No rule is applied, no policy is enforced, no translation happens.

The 80/20 rule is the usual diagnostic: if most requests are sinkholes, the layers are not earning their keep. You are paying structure for the appearance of structure.

### The fat service layer

The transaction boundary lives in the service layer, so every piece of orchestration accretes there. One service class becomes 2,000 lines and is the only place anyone dares to change. The layer became a dumping ground because it was the only layer with a reason to exist.

### Testability is a seam, not an inversion

You can test the service with mocks. That is not the same as testing the business rules without I/O. Usually the mocks encode the persistence shape (`repo.save` was called with this ORM entity), so the test breaks when the schema changes and passes when the rule is wrong. If you need a database to test a discount rule, the layering did not buy you much.

### Framework-shaped domain

When the domain is expressed in the framework's language, the framework is no longer a detail. Upgrading it, replacing it, or testing without it becomes a project. Clean architecture's whole selling point is refusing that trade — and its whole cost is the mapping code that refusal requires.

## What it is not

| It is not | Why |
| --- | --- |
| **A modular monolith** | A modular monolith decomposes by business capability at the top level. A layered monolith decomposes by technical role. You can — and probably should — put layers *inside* each module. See [01a](01a-modular-monolith.md#module-boundaries-are-not-layers). |
| **The same as clean / hexagonal / onion** | Those are also layered. The difference is where the dependency arrows point: down at the database, or inward at the domain. |
| **A deployment style** | Layers are logical. Tiers are physical. A layered application is normally one process. |
| **Necessarily anemic** | You can have a rich domain model in the domain layer. Anemia is a modeling choice, not a property of layering. |
| **Microservices' opposite** | Layering says nothing about deployment, data ownership, or service boundaries. Comparing it to microservices is a category error. |
| **A temporary mess** | It is a legitimate default for thin domains. The mistake is keeping it after the domain stops being thin. |

## Failure modes

| Failure mode | What it looks like | Fix |
| --- | --- | --- |
| **Sinkhole** | Requests traverse every layer doing nothing | Collapse pass-through layers; move real behavior into the layer that owns it |
| **Fat service layer** | One service class holds all orchestration and policy | Extract domain behavior into the model; split by use case |
| **Feature scattering** | One feature change touches five folders | Reorganize by capability or vertical slice; keep layers inside the slice |
| **Database-coupled domain** | ORM entities and SQL-shaped interfaces in the model; tests need a DB | Ports owned by the domain; map at the persistence edge |
| **Layered monolith** | Shared models and tables across the whole app; business boundaries invisible | Introduce modules with public contracts and owned schemas ([01a](01a-modular-monolith.md)) |
| **Big ball of mud** | Everything imports everything; shared models and tables; no capability boundary survives | Draw the capability map; make the boundary executable; see [02a](02a-big-ball-of-mud.md) |
| **Framework-shaped core** | Business rules expressed with framework decorators and base classes | Plain domain objects; framework at the composition root |
| **Mock-shaped tests** | Tests assert repository calls, not business outcomes | Test the domain directly; use fakes at an owned boundary |
| **Layer-as-team** | One team per layer; every feature crosses three teams | Organize around capabilities; see [Layers are not teams](#layers-are-not-teams) |

The characteristic failure mode is the **sinkhole and the big ball of mud**: layers become pass-throughs, logic pools in the wrong layer, and the business boundary is invisible.

## Layers are not teams

The layer-team pattern — a frontend team, a backend team, a database team, an operations team — is the organizational form that most often *produces* a layered architecture. It is not one of the pattern's benefits. Conway's law runs in that direction: the communication structure shows up in the code.

That pattern has a well-documented cost. A feature that needs a schema change, a service method, and a screen crosses three teams. Each handoff transfers context, and context is lossy. Work queues at the boundary. Each team optimizes for its own layer, which is rational locally and slow globally. Brooks described the coordination tax decades ago; the layer boundary is one of its clearest forms.

Netflix documented the failure in 2018, years before the current AI cycle. Their Edge Engineering group had separate development, test, and operations silos. Greg Burrell's summary: **"Specialized teams can create a real efficiency within one segment but a lot of inefficiency across the cycle."** Their response was the **full-cycle developer**: one team owns design, build, test, deploy, and operate. The symptoms they named were lost context, handoff meetings, long email threads, and slow incident resolution — the same symptoms a feature team feels when it waits on the database team.

[Team Topologies](https://teamtopologies.com/key-concepts) (Skelton and Pais, 2019) made the prescription explicit. The default team is the **stream-aligned team**: full-stack and full-lifecycle, owning "front-end, back-end, database, business analysis, feature prioritization, UX, testing, deployment, monitoring." Their material is blunt about the goal: "There are no hand-offs to other teams for any purpose."

### What the AI evidence actually says

AI is now used as the argument for vertical teams. The evidence is directional, but weaker than the claim.

- **The shift predates AI.** Netflix's full-cycle model is from 2018; Team Topologies is from 2019; Amazon's two-pizza teams and Spotify's squads are older still. AI cannot be the cause of a trend that predates it by a decade.
- **AI compresses the build step, not the org chart.** Spotify reports 99% weekly AI-tool adoption and a 76% increase in pull-request frequency, and says the bottleneck has moved "from coding to decision-making." Microsoft, Atlassian, and 1Password describe the same shift: smaller mission teams, shorter planning horizons, more time in plan and validate. But they also say they did not redraw the org chart — what changed is how teams form and how work flows through it.
- **Smaller end-to-end pods are being tried.** A 2026 preprint compares a brownfield enterprise with an AI-native startup and reports 8x–33x reductions from "horizontal layering" to "vertical integration." Treat the number as a hypothesis, not a result: it compares a startup to an enterprise and greenfield to brownfield, so the AI effect is confounded with everything else.
- **AI raises the cost of weak boundaries.** More code, faster, means more review load and more drift. Atlassian reports duplication, tech debt, and maintainability pressure as output rises; Spotify reports 76% more pull requests to review. DORA's framing is the useful one: AI is an amplifier — it scales whatever the organization already is.

The defensible conclusion is narrower than "AI killed layer teams":

1. Layer teams were never the layered architecture's advantage. They were its most common *cause*, and a well-documented cost.
2. The handoff tax is real and old. AI does not create it and does not remove it; it makes the build step cheaper, which makes coordination a larger share of the cycle.
3. The modern default is a vertical team with layers *inside* it. The layers survive as an implementation detail; the team boundary follows the value stream.

### What this means for the pattern

Keep the layers. Move the axis.

A module or a vertical slice can still have a domain, an application, and an adapter layer. What it should not do is make the layer the unit of ownership, the unit of deployment, or the unit of change. That is the difference between "we use layering" and "we are organized by layer" — and only the second one produces the handoff tax.

## Layered vs. hexagonal vs. clean

The short version, because the Day 2 comparison goes deeper:

|  | Dependency direction | Database | Ports owned by | Boundary payload |
| --- | --- | --- | --- | --- |
| **Layered** | Downward | Foundation | Whoever finds it convenient | ORM entities, framework types |
| [**Hexagonal**](02b-hexagonal-architecture.md) | Inward | An adapter at the edge | The domain / application | Domain types and DTOs |
| **Clean / onion** | Inward | An outer-ring detail | The inner ring | DTOs only; entities never cross |

All three are layering. Hexagonal and clean are the same topology with different vocabulary: ports and adapters, domain at the core, dependencies pointing inward. Clean adds a prescribed set of boundary objects — input ports, use-case interactors, output ports, presenters — that most teams implement only partially.

The [hexagonal note](02b-hexagonal-architecture.md) takes the middle column apart.

## The dependency leak in code

The leak is easier to see in types than in folders.

**The entity is the row.** Business rules live on the persistence class, so they run against a database record:

```ts
@Entity()
export class Row {
  @Column() id!: string;
  @Column() status!: string;
  @Column() ownerEmail!: string;

  canCancel(): boolean {
    return this.status === "pending";
  }
}
```

**The port is shaped by queries.** Every screen adds a method, and the interface drifts from what the domain needs toward what the database can answer — until the name describes the table rather than the contract:

```ts
export interface RowRepository {
  save(row: Row): Promise<void>;
  findById(id: string): Promise<Row | null>;
  findByStatus(status: string): Promise<Row[]>;
  findByOwnerWithHistory(ownerId: string): Promise<Row[]>;
}
```

**The service is the transaction.** It imports the driver, owns the transaction boundary, and calls the network inside it:

```ts
class RowService {
  constructor(
    private readonly db: Pool,                 // infrastructure, imported by the application layer
    private readonly rows: RowRepository,
    private readonly mailer: Mailer,
  ) {}

  async cancel(id: string): Promise<void> {
    await this.db.query("BEGIN");
    const row = await this.rows.findById(id);
    if (!row || !row.canCancel()) throw new Error("cannot cancel");
    row.status = "cancelled";
    await this.rows.save(row);                 // the ORM decides when the write happens
    await this.mailer.send(row.ownerEmail);    // network I/O inside the transaction
    await this.db.query("COMMIT");
  }
}
```

Three dependencies, all concrete: a connection pool, a query-shaped port, and a mail adapter. There is nothing here you can test without a database and a mail server. The folders have layers; the dependency arrows still point down.

### The tell is cohesion, not method count

`RowRepository` now has two reasons to change: the business rule and the UI. That is the defect — not the number of methods. Ask of each method: does it change when the rule changes, or when a screen changes? Methods that answer different questions belong on different interfaces, split by purpose rather than by table:

```ts
// domain port: what the invariant needs
interface Orders {
  byId(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

// read port: what consumers ask
interface OrderSearch {
  search(criteria: OrderCriteria): Promise<OrderSummary[]>;
  countByStatus(status: string, since: Instant): Promise<number>;
}
```

A new filter changes `OrderSearch`; the domain does not notice. Same module, two contracts, two owners. That is interface segregation doing architectural work.

A strict layered version adds a `controllers/` and a `models/` folder next to these. It does not change the direction of a single arrow. **That is the trade you are being asked to evaluate on Day 2.**

## When layered is the right call

Choose it when:

- the domain is thin and mostly CRUD;
- the framework imposes it and its conventions are worth more than purity;
- the team is small and the system's horizon is short;
- the business rules are not the product;
- you need a shared, boring structure more than you need replaceability.

Revisit it when:

- the domain logic becomes the product;
- the same use cases need more than one delivery mechanism;
- tests of business rules start needing a database;
- feature changes keep touching every folder;
- the schema changes more often than the business rules.

## Decision checklist

- [ ] Can I state the primary axis of decomposition — technical role or business capability?

- [ ] Does changing one feature touch one place or five folders?

- [ ] Can I execute the business rules with no database, no HTTP, and no clock?

- [ ] Are business rules expressed in plain types, or in framework/ORM types?

- [ ] Is the layer structure earning its keep, or are most requests sinkholes?

- [ ] Is the service layer a coordinator, or a 2,000-line dumping ground?

- [ ] Would a new team member find the business capability, or only the technical role?

- [ ] Do I know what would make me move to ports and adapters?

If the last answer is "nothing," the choice is not a decision. It is a habit.

## Trade-off matrix row

| Style or decision | Optimizes | Costs | Use when | Avoid when | Failure mode |
| --- | --- | --- | --- | --- | --- |
| **Layered architecture** | Familiarity; framework fit; technical separation of concerns; cheap start; easy onboarding; replaceable layers in principle | Feature scattering; database-coupled domain; pass-through layers; mock-based tests; fat service layer | Thin domain; CRUD and admin systems; framework-imposed MVC; small team; short horizon | Domain logic is the product; multiple delivery mechanisms; business rules must be testable without I/O; expected schema or framework churn | Sinkhole; layered monolith; invisible business boundaries; logic pooling in controllers or services |

This row is also collected in the [consolidated trade-off matrix](tradeoffs.md).

## Sources

- Fowler, [*Patterns of Enterprise Application Architecture*](https://martinfowler.com/eaaCatalog/) (2002), for layering, the domain model, and the transaction script.
- Fowler, [*PresentationDomainDataLayering*](https://martinfowler.com/bliki/PresentationDomainDataLayering.html) (2015).
- Richards & Ford, *Fundamentals of Software Architecture* (2020), ch. 10, for closed and open layers and the sinkhole anti-pattern.
- Cockburn, [*Hexagonal Architecture (Ports and Adapters)*](https://alistair.cockburn.us/hexagonal-architecture/) (2005), for the inversion this note is measured against.
- Martin, [*The Clean Architecture*](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) (2012), for the Dependency Rule.
- Evans, [*Domain-Driven Design*](https://www.domainlanguage.com/ddd/) (2003), for the domain model and bounded contexts.
- Parnas, [*On the Criteria To Be Used in Decomposing Systems into Modules*](https://www.cs.colostate.edu/~france/CS314/Readings/Parnas-decomposition.pdf) (1972), for information hiding and decomposition by change.
- Brown, Malveau, McCormick & Mowbray, *AntiPatterns* (1998), for the Blob.
- Skelton & Pais, [*Team Topologies*](https://teamtopologies.com/key-concepts) (2019), for stream-aligned teams and the "no hand-offs" goal.
- Fowler, [*Team Topologies*](https://martinfowler.com/bliki/TeamTopologies.html) (2023), for the full-stack, full-lifecycle definition.
- Burrell, [*Full Cycle Developers @Netflix*](https://www.infoq.com/presentations/netflix-devops) (QCon, 2018), for the silo-to-end-to-end case study.
- Kinney, [*Organizational Patterns and Team Topology*](https://stevekinney.com/courses/enterprise-ui/organizational-patterns-and-team-topology) (2026), for the layer-team failure mode and the "every feature crosses every layer" formulation.
- Spotify Engineering, [*Coding Is No Longer the Constraint*](https://engineering.atspotify.com/2026/6/code-with-claude-coding-is-no-longer-the-constraint) (2026), for AI adoption, PR volume, and the shift to decision-making.
- Reock, [*Designing the AI-native engineering organization*](https://getdx.com/blog/designing-the-ai-native-engineering-organization/) (DX, 2026), interviews with Microsoft, Atlassian, and 1Password.
- Zhang et al., [*From Horizontal Layering to Vertical Integration*](https://arxiv.org/abs/2601.22667) (arXiv preprint, 2026) — cited as a hypothesis, not a settled result.
- Harvey, [*AI is an Amplifier*](https://www.infoq.com/presentations/dora-ai-adoption-engineering-performance) (DORA/InfoQ), for AI as an amplifier of existing organizational strengths and dysfunctions.

## Next

- [Day 2 — application structure](../roadmap.md) — the rest of the four-way comparison, the ports-and-adapters refactor, and the questions to ask before choosing each style.
- [Hexagonal architecture](02b-hexagonal-architecture.md) — driving versus driven ports, the dependency rule, what crosses a port, and the mapping tax.
- [Big ball of mud](02a-big-ball-of-mud.md) — what happens when the capability boundary is never enforced, and how to get out without a rewrite.
- [Modular monolith](01a-modular-monolith.md) — why the top-level axis should be business capability, with layers inside.
- [External calls inside a transaction](01e-external-calls-inside-transactions.md) — the anti-pattern that layering makes easy: network I/O inside a transaction.
- [Trade-offs](tradeoffs.md) — the consolidated matrix.