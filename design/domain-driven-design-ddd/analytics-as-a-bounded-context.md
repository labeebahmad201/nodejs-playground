# Analytics as a bounded context

*Bounded contexts divide models, not job descriptions. A team that owns an operational model does not automatically own every report, dashboard, and metric derived from it. Analytics is a read-side capability with its own model, its own owner, and its own service level. If that ownership is left implicit, every domain team inherits reporting work it did not choose and cannot sustainably staff.*

## The wrong default

A common reading of DDD goes like this:

> Each bounded context gets a team; therefore each team owns its own analytics.

The first clause is already too strong. A bounded context is a model boundary, not a team-count formula; one team can own several contexts. The second clause is a non sequitur. The context boundary tells you where a model and language are consistent. It does not tell you who should answer "what was revenue by region last quarter?"

Operational and analytical needs are different. Martin Fowler points out that operational updates and reporting often have "different requirements from a schema and different data access patterns," which is why a reporting database can be a copy of operational data represented in a different schema ([*Reporting Database*](https://martinfowler.com/bliki/ReportingDatabase.html), 2014). Eric Evans makes the stronger version of the same point: when analysis requires a substantially different way of reasoning, "tools such as data warehouses provide the means to define distinct models of the same domain geared to those ends" ([*The challenge of executing DDD*](https://www.dddcommunity.org/uncategorized/evans_2004_3/)). A separate analytical model is not a failure of DDD. It is often the correct use of a bounded context.

If every domain team builds its own reporting, the usual results are:

- duplicate ingestion and transformation pipelines;
- metrics with the same name and different definitions;
- reporting requests crowding out work on the core domain;
- cross-domain questions falling between teams because no one owns the whole picture.

That is also a cognitive-load problem. Team Topologies warns that small stream-aligned teams need ways to "reduce their cognitive load, so they can concentrate on supporting the business needs" rather than non-focal concerns ([*Team Topologies*](https://martinfowler.com/bliki/TeamTopologies.html), 2023). Reporting infrastructure and cross-domain marts are exactly the kind of concern a platform or specialist capability can absorb.

None of this says domain teams have no responsibility. They own the **source semantics**: the meaning of the facts they write and publish. That is different from owning every consumer of those facts.

Put differently: the goal is not to centralize analytics. It is to give reporting an explicit owner so business teams can keep building and maintaining their core capabilities without inheriting unrelated reporting work.

## Two models, one authority

An operational context is built to protect invariants. It owns the write model, the state transitions, and the authoritative record of what happened. An analytical context is built to answer questions. It owns derived, denormalized, query-shaped models, often in a different store and usually on a delay.

| Concern | Operational context | Analytical context |
| --- | --- | --- |
| Primary job | Enforce business rules and record state changes | Answer questions across time and domains |
| Model shape | Normalized, invariant-preserving | Denormalized, query-shaped, often historical |
| Consistency | Strong inside the aggregate | Usually eventual |
| Authority | The facts and state transitions | The derived models, metrics, and report logic |

The separation does not create a second source of truth for operational facts. Microsoft's microservices guidance is explicit: one service should represent the source of truth for an entity, while other services may hold "their own copy of the data, or a subset of the data, that's eventually consistent with the primary data but not considered the source of truth" ([*Data considerations for microservices*](https://learn.microsoft.com/en-us/azure/architecture/microservices/design/data-considerations)). Analytics is downstream. If a report disagrees with the operational record about what happened, the operational record wins. If two reports disagree about what a metric means, the analytical context's metric definition wins — but only if that definition is owned and published.

That gives two different kinds of authority, and mixing them up is how "data ownership" becomes a shouting match.

## Who owns what

The useful question is not "which team owns analytics?" It is "which team is authoritative for which decision?"

| Capability | Authoritative for | Not responsible for |
| --- | --- | --- |
| **Operational domain team** | Source writes, invariants, event schemas, and the meaning of the facts it publishes | Every dashboard, cross-domain mart, or analytical SLA built from those facts |
| **Analytics / reporting capability** | The analytical model, transformations, metric definitions, reports, freshness, and reconciliation | Operational writes or the source domain's invariants |
| **Data platform team** | Ingestion, storage, compute, orchestration, catalogue, access control | Business semantics and KPI definitions |
| **Business owner / consumer** | Accepting that a metric or report answers the right question; prioritising changes; making decisions from it | Pipeline internals or the source schema |

The analytics capability can be a dedicated analytics team, a data-product team, or a designated domain team. What matters is that it is **one named owner**, not an implicit expectation spread across every domain team. The data-mesh guidance reaches the same conclusion from the data side: "No single data product should be owned by multiple domains" ([*Designing data products*](https://martinfowler.com/articles/designing-data-products.html), 2024).

## It can be its own bounded context or a supporting capability

Analytics does not have one organizational shape. Classify it the same way you classify any other subdomain: by how much it differentiates the business.

| If analytics is... | Treat it as... | What that implies |
| --- | --- | --- |
| **Core** — the insight itself is the product, such as risk scoring, pricing intelligence, or a benchmarking service | A core subdomain with its own bounded context | Dedicated team, rich model, best people, long-term investment |
| **Supporting** — necessary internal reporting, but not the differentiator | A supporting bounded context with a simpler model | A small dedicated team or designated owner; still has contracts and SLAs |
| **Generic** — standard dashboards, warehousing, and BI | A generic subdomain | Buy or reuse a platform; integrate instead of building a custom analytics stack |

This is the core/supporting/generic distinction from Evans's strategic design (*Domain-Driven Design*, 2003), and it is a business decision, not a technical one. AWS's monolith-decomposition guidance gives a concrete example: it treats "Campaigns, Analytics, and Reports" as supporting business functionality rather than as part of the differentiating purchasing and claims models ([*Decompose by subdomain*](https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-decomposing-monoliths/decompose-subdomain.html)).

"Supporting" does not mean "unowned" or "low quality." It means the capability is necessary but not the thing the company competes on, so it deserves a simpler model and an explicit owner — not a full DDD treatment inside every domain team.

## Data mesh does not mean every team builds reports

Data mesh can sound like it contradicts this. It does not. Data mesh argues for domain-oriented ownership of **analytical data products**, not for making every operational team responsible for every report, dashboard, and cross-domain metric.

Zhamak Dehghani's description of the model is explicit that new teams can own data products that do not fit an existing operational domain: "It's also possible to form new teams to serve data products that don't naturally fit into an existing operational domain" ([*Data Mesh Principles and Logical Architecture*](https://martinfowler.com/articles/data-mesh-principles.html), 2020). It also separates the data product from the self-serve platform that runs it. The principle is federated ownership plus a shared platform — not universal reporting duty.

So the two positions fit together:

- operational domain teams own the semantics of their source data;
- analytical data products have one named owner each;
- a specialist analytics team can own cross-domain marts and consumption-facing reports;
- a platform team provides the self-service infrastructure;
- business owners accept the metrics and make decisions from them.

What data mesh rejects is the opposite extreme: a central team that owns every pipeline and invents every business definition without domain input. What it does not require is every domain team reinventing its own reporting stack.

## Integration points are part of the boundary

A bounded context is only useful if its contracts are explicit. For analytics, the important contracts are:

- **Facts, not screenshots.** Operational contexts publish domain events or change data with stable schemas. Consumers should not depend on internal tables or UI-shaped payloads.
- **One-way flow.** Analytics reads from operational contexts; it does not write back into their stores. If an analytical result must change operational state, it goes through a command or API owned by that context.
- **Versioned contracts.** Event name, version, business keys, timestamps, idempotency, and compatibility rules are part of the published interface.
- **Freshness and reconciliation.** State whether the report is real-time, micro-batch, or daily; define the acceptable lag and how disagreements are investigated.
- **A named owner for cross-domain metrics.** A cross-domain metric needs one owner who assembles it from stable data products. A committee is not an owner.

Fowler's reporting-database pattern is still the pragmatic default for heavy reporting: a separate read-optimized store keeps analytical queries off the operational database and lets the operational schema evolve independently ([*Reporting Database*](https://martinfowler.com/bliki/ReportingDatabase.html)). CQRS is one way to implement the read side, but it is not required; Fowler warns that CQRS "should only be used on specific portions of a system (a BoundedContext in DDD lingo) and not the system as a whole" ([*CQRS*](https://www.martinfowler.com/bliki/CQRS.html), 2011). The same caution applies here: separate the analytical model where it earns its keep, not everywhere by default.

## Smells that ownership is missing

| Smell | What it usually means |
| --- | --- |
| Every team has its own dashboard for the same KPI | No analytical owner; definitions are drifting |
| A domain team's backlog is dominated by report requests | Reporting is under-owned and being paid for out of core capacity |
| The analytics team defines business terms without domain experts | Source semantics are disconnected from the people who own them |
| An analytics pipeline writes directly into an operational database | The read/write boundary has been crossed |
| One central team owns every pipeline and every metric definition | The opposite failure: a bottleneck with no domain accountability |
| Nobody can say who owns a metric | Ownership is implicit; make it explicit before building another report |

## Remember

- **DDD divides models, not chores.** A bounded context does not automatically make analytics every domain team's responsibility.
- **Operational teams own source semantics.** Analytics owns derived models, metrics, and reports. The platform owns the machinery. The business owns acceptance.
- **Analytics can be core, supporting, or generic.** Classify it; do not assume it belongs inside every domain team.
- **One named owner per analytical context or data product.** Federated ownership is not the same as everyone doing everything.
- **Contracts and SLAs are part of the boundary.** Events, freshness, reconciliation, and metric definitions need explicit owners.

## See also

- [Subdomains and bounded contexts](subdomains-and-bounded-contexts.md)
- [Bounded contexts, microservices, and teams](bounded-contexts-microservices-and-teams.md)
- [Aggregate root IDs and foreign keys](aggregate-root-ids-and-foreign-keys.md)
- [God aggregates and transaction boundaries](god-aggregates-and-transaction-boundaries.md)
- [When to use DDD](when-to-use-ddd.md)
