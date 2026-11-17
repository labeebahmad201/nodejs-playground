# Trade-offs

*The canonical trade-off matrix. One row per style or decision: what it optimizes, what it costs, when to use it, when to avoid it, and how it fails.*

Individual notes may repeat a row for context. This file is the source of truth. When a row changes, change it here first.

## Why this matrix exists

The matrix is not the goal. **Customer value is the goal.** A quality attribute only matters if it affects customer value, risk, or the cost of future change. Read this table through that filter — see [01f — Customer value is the measure of progress](01f-customer-value-and-progress.md).

## Columns

- **Optimizes** — which quality attributes this choice is good at.
- **Costs** — what you pay in complexity, latency, operations, or coordination.
- **Use when** — the forces that make it the sensible default.
- **Avoid when** — the forces that make it the wrong tool.
- **Failure mode** — the characteristic way it fails: not the cause, not the blast radius, but the pattern.

## The matrix

| Style or decision | Optimizes | Costs | Use when | Avoid when | Failure mode |
| --- | --- | --- | --- | --- | --- |
| [**Layered architecture**](02-layered-architecture.md) | Familiarity; framework fit; technical separation of concerns; cheap start; easy onboarding; replaceable layers in principle | Feature scattering; database-coupled domain; pass-through layers; mock-based tests; fat service layer | Thin domain; CRUD and admin systems; framework-imposed MVC; small team; short horizon | Domain logic is the product; multiple delivery mechanisms; business rules must be testable without I/O; expected schema or framework churn | Sinkhole; layered monolith; invisible business boundaries; logic pooling in controllers or services |
| [**Hexagonal / ports and adapters**](02b-hexagonal-architecture.md) | Testability without I/O; multiple drivers; replaceable infrastructure; delayed decisions; framework independence; explicit contracts | Mapping tax; indirection and ceremony; leaky ports; transaction ambiguity; fake drift; one giant hexagon; composition-root sprawl | Multiple drivers; volatile infrastructure; rich domain; long-lived system; testability is a real constraint; you can enforce the dependency rule | Thin CRUD; one adapter; prototype; short horizon; the real problem is module boundaries; the team will cargo-cult the folders | Ports mirror the database; ORM entities cross; anemic hexagon; one giant hexagon with a mud inside; fake drift; transaction per call |
| [**Seam at the volatile edge**](02d-coupling-and-testability.md) | Testability without I/O; failure-path tests; replaceable volatile dependencies; fast feedback | Indirection; fakes to maintain; over-injection; interaction-test coupling | A dependency is volatile and its failure paths matter | Stable pure logic; local scratch data; trivial glue | Mocks assert internal call sequences; fake drift; the seam is shaped by the vendor |
| [**Modular monolith**](01a-modular-monolith.md) | Simple deployment; local transactions; fast change; easy debugging; low operational overhead | Shared runtime; coarse scaling; one deploy train; boundaries erode without discipline | Small or medium teams; unclear boundaries; strong consistency; early product; you want to learn the seams before distributing | Independent scaling or deployment is mandatory; teams already block each other on releases; a module needs a separate compliance or failure boundary | Big ball of mud; boundary erosion; shared schema; transaction creep; one deploy blocks everyone |
| [**C4 model**](01b-c4-model.md) | Shared understanding; onboarding; scope control; communication across audiences; a vocabulary for module and container boundaries | Maintenance; staleness; oversimplification; false confidence; time spent drawing instead of deciding | Multiple audiences; architecture reviews; onboarding; distributed systems; decisions that need a shared map | A whiteboard sketch is enough; nobody will maintain it; you need detailed behavior or data modeling; the diagram is for compliance theater | Beautiful stale diagrams; mixed abstraction levels; boxes without meaning; "diagram theater" |
| [**Transactional outbox**](01c-outbox-pattern.md) | Reliable publication; local atomicity of state and event; failure isolation; audit/replay; extraction seam | Extra table and relay; eventual consistency; duplicate handling; monitoring; cleanup | Events must survive crashes; side effects must not fail the primary operation; you need reliable integration; eventual consistency is acceptable | Best-effort side effects; immediate queries; same-boundary commands; huge payloads; no idempotent consumer | Relay lag; outbox bloat; duplicate processing; marking published too early; missing idempotency; poison messages |
| [**Idempotency keys / idempotent consumer**](01g-idempotency.md) | Safe retries; duplicate tolerance; crash recovery; at-least-once handling; external-call safety | Dedupe state; unique constraints; key design; retention; extra writes; provider support | Any retryable command, event consumer, or external side effect | Pure reads; duplicates that are genuinely harmless | Duplicate charges or emails; key collision or reuse; check-then-act race; lost dedupe state; side effect before the record |
| [**In-process call**](01a-modular-monolith.md#integration-inside-the-monolith) | Simplicity; immediate result; strong local consistency; easy debugging; no extra infrastructure | Runtime coupling; latency coupling; failure coupling; harder to split; a transaction may be held across I/O | A query; a command where the caller needs the result; failure should fail the caller; the work is in one consistency boundary | The side effect must not fail the primary operation; an external provider is involved; independent availability or scaling is needed; durable delivery is required | Cascading failure; latency spikes; hidden temporal coupling; transaction held across I/O; a distributed monolith after extraction |
| [**Local transaction across module schemas**](01a-modular-monolith.md#transactions-and-consistency) | Strong consistency now; simple implementation; no saga; works across app instances with a shared database | Schema and migration coupling; extraction seam; coordinated deploys; hides a boundary violation | The invariant is truly atomic; the modules share one database; the split is not near or likely | An external resource is involved; eventual consistency is acceptable; the split is likely or required; modules need independent migrations | Transaction creep; coordinated release train; distributed monolith on split; hidden coupling |
| [**Saga / process manager**](01a-modular-monolith.md#transactions-and-consistency) | Multi-step coordination across boundaries; compensation; eventual consistency; works with external resources; preserves future extraction | State-machine complexity; retries; idempotency; observability; partial progress | A multi-step business process; external providers; eventual consistency is acceptable; work spans modules | One local invariant; a simple synchronous flow; no compensation is needed; the process is low-value | Stuck workflow; compensation failure; duplicate steps; invisible state; compensations that themselves fail |
| [**Schema per module**](01a-modular-monolith.md#data-ownership) | Data ownership; migration isolation; extraction readiness; clear contracts; reporting isolation | Cross-module reads need contracts or read models; no joins; more projections; duplicated lookup data | Modules are real capabilities; extraction is likely; ownership is clear; multiple teams are involved | One shared model is truly cohesive; the application is tiny; a read replica already solves reporting | Shared-schema creep; cross-schema joins; reporting on operational tables; duplicated data with no source of truth |
| [**Separate worker deployment**](01a-modular-monolith.md#when-to-extract-a-service) | Independent scaling of async work; isolation from the API; a simple process boundary without full microservices | Another process; a queue; more operational surface; eventual behavior; deployment coordination | An async workload has different traffic; notifications, reporting, or media processing; a durable queue exists | Everything is synchronous and low volume; there is no durable queue; the team cannot operate another process | Worker lag; duplicate jobs; split-brain; queue backlog; deployment drift |
| [**Microservices**](04-microservices/README.md) | Independent deployability; independent scaling; team autonomy; failure isolation; compliance boundaries; runtime fit; replaceable services; data ownership | Network latency and partial failure; distributed consistency; data duplication; contract/versioning; many pipelines and dashboards; tracing; testing; security surface; coordination; microservice premium | Multiple teams need independent releases; parts scale differently; a capability needs a compliance, failure, or runtime boundary; boundaries and data ownership are proven; platform and on-call exist | Small team or product; boundaries still unknown; strong consistency across capabilities; no observability, CI/CD, or on-call; a modular monolith can satisfy the force | Distributed monolith; chatty services; cascading failure; inconsistent data; lockstep releases; nanoservices |
| [**Service granularity**](04-microservices/README.md#service-granularity) | A boundary that is also a business capability, transaction, data ownership, deployment, failure, and ownership boundary | Too coarse becomes a monolith; too fine becomes a chatty network with distributed transactions and high operational cost | One capability, one owner, one data boundary, one release cadence; the invariant can stay local | An entity, layer, screen, framework, or org chart is the only proposed axis; the service would need a distributed transaction for its core rule | Nanoservices; god service; chatty calls; distributed monolith; a boundary no team can own |
| [**Database per service**](04-microservices/README.md#data-ownership) | Data ownership; independent schema evolution; migration isolation; extraction readiness; clear source of truth | No cross-service joins or foreign keys; deliberate duplication; eventual consistency; read models; distributed transactions | Services own their data; independent deployment is real; reporting has a read model or warehouse | One team and one deploy; the core value is a cross-capability join; reporting is the only consumer; you cannot operate multiple stores | Shared database in disguise; cross-service joins; duplicated data with no owner; stale reporting; saga sprawl |
| [**Synchronous vs. asynchronous integration**](04-microservices/README.md#synchronous-vs-asynchronous-integration) | Sync: an immediate answer and simple control flow. Async: temporal decoupling, buffering, independent availability, fan-out, and retry | Sync: runtime coupling, availability multiplication, latency, cascading failure, retry amplification. Async: eventual consistency, duplicates, ordering, observability, broker operations | Sync when the caller needs the answer now and the call is bounded; async when the side effect can be eventual, multiple consumers need the fact, or failure isolation matters | Sync for a volatile dependency whose failure should not fail the caller; async for a simple local query or a flow that needs an immediate answer | Sync call-chain outage; retry storm; async lost or duplicate events; queue backlog; hidden contract coupling |
| [**In-memory event bus**](01a-modular-monolith.md#integration-inside-the-monolith) | Simple decoupling inside one process; no broker; fast; no extra infrastructure | Non-durable; per-instance; lost on crash; no cross-instance delivery; no retry | Non-critical in-process notifications; cache invalidation; metrics; a single instance is enough | The event must survive a crash; multiple instances must receive it; reliable integration is required; payment or notification state is involved | Silent event loss; inconsistent state across instances; hidden coupling; no retry path |

## Anti-patterns

These are not styles to choose. They are recurring bad solutions to keep out of the design.

| Anti-pattern | What it seems to optimize | Costs | Use when | Avoid when | Failure mode |
| --- | --- | --- | --- | --- | --- |
| [**External call inside a transaction**](01e-external-calls-inside-transactions.md) | Short-term code simplicity; the illusion of atomicity | Long-held locks and connections; pool exhaustion; timeouts; duplicate side effects; false atomicity; cascading failure | Almost never for network I/O | Any external HTTP, email, broker, cache, file, or third-party call | Provider succeeds but DB rolls back; DB commits but provider fails; pool saturation; retries duplicate the side effect; ambiguous state |
| [**Big ball of mud**](02a-big-ball-of-mud.md) | Short-term speed; local freedom; no coordination cost | Hidden coupling; change amplification; extraction cost; onboarding drag; no safe deletion | Never deliberately; it emerges under deadline, turnover, and drift | Any system expected to live longer than the patch that created it | Everything talks to everything; shared models and tables; no boundary survives; rewrite or strangler only |
| [**Distributed monolith**](04-microservices/README.md#the-distributed-monolith) | The appearance of microservice autonomy; independent services on the diagram | Network complexity plus monolith coupling; lockstep releases; shared database; synchronous call chains; cascading failure; no independent scaling | Never deliberately | Any extraction without a module boundary, data ownership, and an independent deploy pipeline | One change requires many services; shared schema; a request needs every service up; no service can deploy alone |

## Still to add

Fill these in as the later days are worked:

- [ ] Clean / onion architecture
- [ ] Vertical slice
- [ ] Event-driven architecture
- [ ] CQRS
- [ ] Event sourcing
- [ ] Serverless
- [ ] Saga orchestration vs. choreography
- [ ] Outbox vs. CDC

## How to use this file

No row is universally good. The same choice can be right in one context and wrong in another; this matrix is a set of questions, not a ranking.

For any architecture proposal, ask:

1. Which row are we choosing?
2. What does it optimize?
3. What are we accepting as a cost?
4. When would this choice be wrong?
5. What is its characteristic failure mode?

The answer should be a sentence, not a shrug:

> For **[context]**, given **[top two or three forces]**, choose **[option]** because it optimizes **[quality attributes]**. Accept **[costs]**. Revisit if **[trigger]**.

## Related

- [01 — Trade-off vocabulary](01-tradeoff-vocabulary.md) — the 12 questions and the "it depends" formula.
- [01a — Modular monolith](01a-modular-monolith.md) — module boundaries and data ownership.
- [01b — C4 model](01b-c4-model.md) — diagrams as a communication tool.
- [01c — Outbox pattern](01c-outbox-pattern.md) — reliable event publication.
- [01d — Outbox implementation](01d-outbox-implementation.md) — how to build it.
- [01e — External calls inside a transaction](01e-external-calls-inside-transactions.md) — the anti-pattern to avoid.
- [01f — Customer value is the measure of progress](01f-customer-value-and-progress.md) — the filter for why any of this matters.
- [01g — Idempotency](01g-idempotency.md) — safe retries and duplicate processing.
- [01h — Practice provenance and context](01h-practice-provenance.md) — why a practice’s popularity is not evidence of fit.
- [02 — Layered architecture](02-layered-architecture.md) — technical layering, dependency direction, the sinkhole, and when layered is the right default.
- [02a — Big ball of mud](02a-big-ball-of-mud.md) — the anti-pattern behind boundary erosion, and how to get out without a rewrite.
- [02b — Hexagonal architecture](02b-hexagonal-architecture.md) — the goal it serves, driving versus driven ports, two-way mapping, adapter testing, and module enforcement.
- [02b — Hexagonal nuances](02b-hexagonal-nuances.md) — the 31-nuance catalog and runnable lab.
- [04 — Microservices](04-microservices/README.md) — independent deployability, data ownership, partial failure, and the distributed monolith.
- [Roadmap](../roadmap.md) — the 8-day plan that fills this matrix.
