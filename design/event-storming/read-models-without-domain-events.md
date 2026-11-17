# Read Models Without Domain Events

*During Event Storming, some information needs have no domain event behind them. Record them, do not invent events, and assign ownership when you know where the data lives.*

## The observation

Event Storming surfaces two different things:

- **What happens** — domain events, commands, policies, and the rules that connect them.
- **What someone needs to see** — read models, projections, screens, reports, and dashboards.

The usual example makes the second look like a consequence of the first. `JobPosted` feeds a "Job Details" read model. `BidAccepted` feeds a "Contract" view. The event happens, the projection follows.

Real boards are messier. A workshop produces requirements such as:

- the home page;
- a search result page;
- an admin dashboard;
- a "featured professionals" strip;
- a "Top Rated" or "Verified" badge.

Some of these have no domain event and no aggregate in the current context. The data may be:

- content managed outside the domain;
- a query over current state;
- a metric computed from history;
- data owned by another bounded context;
- a hardcoded or editorial list.

If you force every green sticky into the event timeline, you invent events that are not business facts:

```text
HomePageViewed -> HomePageDataFetched -> HomePageRendered
```

That is a UI and telemetry sequence, not a domain story. It pollutes the model and hides the real question: **where does the data come from, and who owns it?**

## The rule

**Capture the information need. Do not invent a domain event.**

A domain event records a fact that happened. A read model answers a question. They are different things. A read model can be fed by events, but it does not need an event to exist.

This is the nuance behind "no event, no metric." The phrase is a useful test for **event-fed projections**: if a metric is supposed to be derived from events and no event exists, you have found a gap. It is not a rule that every read model needs an event. Content, external data, and current-state queries are legitimate sources.

## What to capture in the workshop

When a read requirement appears, write a card with:

- **Who** needs it.
- **What question** it answers.
- **What decision or action** it supports.
- **When** it is needed — before a command, during browsing, after the fact.
- **How fresh** it must be — real time, seconds, minutes, daily.
- **Where it comes from** — "unknown" is a valid answer at this stage.

Do not put it on the Big Picture timeline as an event. At Big Picture, keep it as a note or a hotspot. At Process/Design, it becomes a green read-model sticky. Placement comes later, when there is enough information to name the source.

## Source taxonomy

Not every read model is a projection over events.

| Source | Needs a domain event? | Example | Owner |
| --- | --- | --- | --- |
| Event-fed projection | Yes — events feed it | Job Details from `JobPosted` / `JobUpdated` | The context that owns the events |
| Current-state query | No — reads the write model | Open jobs list | The context that owns the write model |
| Computed aggregate | No — derived on read or on a schedule | Home page stats | Analytics or the read-model owner |
| External system | No — owned outside | Payment provider status | The integration or contract owner |
| Content / CMS | No — editorial | Testimonials, marketing copy | Content or marketing |
| Another context | Depends on its source | `clientRating` from Reputation | The context that owns the source data |

The table is the important part. It tells you what to do when a green sticky has no event behind it: find the source type first, not a fake event.

## From source to owner

At Design and context mapping, trace each field to a source. For each field, ask:

1. Which bounded context owns the authoritative data?
2. Does that context expose it as an API, an event, or a projection?
3. Which team owns that context?
4. Is the screen a single read model or a composition of several?

The default rule in this repository is: the API or projection responsibility goes to the team that owns the source context. If a team owns two or three contexts, it owns the APIs for those contexts. If another team owns one context, that team owns its API. The screen does not get assigned to a single team by default.

For a cross-context screen, someone must own the composition:

- a BFF team;
- the frontend team, if it composes the APIs;
- a dedicated read-model team, if the composition is complex and shared.

In this repository, we treat a **screen** as a view that composes several read models plus content, not as a single read model.

## Worked example: a marketplace home page

| Element | Likely source | Domain event? | Owner |
| --- | --- | --- | --- |
| Categories | Catalog / Category context, or CMS | No | Catalog team or content |
| Stats — "10K+ professionals", "98% satisfaction" | Analytics | No; the analytical store is fed by events, but the read is analytical | Analytics team |
| Testimonials | Content / CMS | No | Marketing or content |
| Featured professionals | Profile + Reputation + Availability | No single event | Each source context; a composition owner |
| "Top Rated" badge | Reputation | No; derived from reviews and completion | Reputation team |
| "Verified" badge | Identity | No; current verification status | Identity team |
| "Available" badge | Availability | No; current-state query or projection | Availability team |

The home page is a composition. The categories may not even have a `Category` aggregate; they may be free text or CMS content. That is a finding, not a failure. Record it, then decide whether to introduce a Category context or keep it as content.

Do not create `HomePageViewed` or `HomePageDataFetched` as domain events. If you need page-view analytics, that is a separate telemetry concern, not a fact on the business timeline.

## Decision-supporting vs presentation read models

| Type | Example | Can it be deferred? | Why |
| --- | --- | --- | --- |
| Decision-supporting | Availability before accepting a bid; price before capturing payment | No | The command is unsafe without it |
| Presentation | Home page stats, featured professionals | Yes | The business can operate without it; stale data is acceptable |
| Analytical | Conversion funnel, GMV | Usually yes | Not on the transactional path |

The test: if the read model is missing or stale, does a business decision become wrong or unsafe? If yes, design it early. If no, defer it.

This is where teams get the order wrong. They spend weeks on the home page and discover during implementation that the bid-acceptance flow needed an availability check that no one modeled. The presentation read model was visible; the decision read model was not.

## The timing rule

**Own the source early; own the projection late.**

- Source ownership must be explicit early: which context owns the write model, the invariant, and the authoritative data.
- Projection implementation can be late: the API shape, cache, and read store can wait until you know the access pattern.
- The asymmetry is deliberate. Source ownership is expensive to change; projections are disposable and rebuildable.
- This is a working rule (synthesis), not a named principle. See [Where this rule comes from](#where-this-rule-comes-from) for the published ideas behind each half.

Caveat: decision-supporting read models are the exception. You cannot defer the availability check until after you have built the bid-acceptance flow.

## Where this rule comes from

The exact sentence — **own the source early; own the projection late** — is not a named principle in the literature. It is a synthesis of two well-supported ideas:

1. **The source of truth belongs to a boundary and should be decided early.**
2. **A projection is derived data, so its implementation can be deferred and rebuilt.**

The first idea is the bounded-context and data-ownership argument. [Evans](https://www.informit.com/store/domain-driven-design-tackling-complexity-in-the-heart-of-9780321125217) makes the model boundary explicit; [Helland](https://www.microsoft.com/en-us/research/publication/data-on-the-outside-versus-data-on-the-inside/) argues that a service encapsulates and protects its data, and that one service owns the authoritative perspective of a shared collection; [Richardson's "database per service"](https://microservices.io/patterns/data/database-per-service.html) keeps each service's data private behind its API; [Fowler](https://martinfowler.com/bliki/CQRS.html) applies CQRS per bounded context, not to the system as a whole.

The second idea is the derived-data argument. [Kleppmann](https://dataintensive.net/) separates a **system of record** (the source of truth) from **derived data** and writes: "If you lose derived data, you can recreate it from the original source." [Fowler's Event Sourcing note](https://martinfowler.com/eaaDev/EventSourcing.html) describes a **complete rebuild** from the event log: application state is "purely derivable from the event log." [Dudycz](https://event-driven.io/en/projections_and_read_models_in_event_driven_architecture/) makes the same point for read models: events are the source of truth, read models are secondary data, and they can be rebuilt.

The asymmetry is the inference. If the source is authoritative and expensive to change, while the projection is derived and rebuildable, then decide the source early and defer the projection. That sequencing rule is ours; the premises are theirs.

| Claim | Source | What the source supports |
| --- | --- | --- |
| Own the source early | Evans, *Domain-Driven Design* (2003) | A bounded context owns its model and language. |
| Own the source early | Helland, *Data on the Outside versus Data on the Inside* (2005) | A service encapsulates and protects its data; one service owns the authoritative perspective of a shared collection. |
| Own the source early | Richardson, *Database per service* | Keep each service's data private and accessible only via its API. |
| Own the source early | Fowler, *CQRS* (2011) | Apply CQRS per bounded context; each context decides how it is modeled. |
| Own the projection late | Kleppmann, *Designing Data-Intensive Applications* (2017), Part III | A system of record is authoritative; derived data can be recreated from the original source. |
| Own the projection late | Fowler, *Event Sourcing* (2005) | Application state is purely derivable from the event log; a complete rebuild is possible. |
| Own the projection late | Dudycz, *Guide to Projections and Read Models* (2023) | Events are the source of truth; read models are secondary data and can be rebuilt. |
| Early/late asymmetry | This note | Inference from the two premises; not a named principle or a direct quote. |

The closest single statement to the rule is Kleppmann's distinction between systems of record and derived data. He does not say "early" or "late"; he says which one is authoritative and which one can be recreated. The sequencing is the practical consequence.

Two clarifications:

- **Sequencing is not importance.** A decision-supporting read model still has to be designed early. "Late" applies to the projection implementation, not to the decision that depends on it.
- **Late is not never.** The projection still needs an owner, a contract, and a rebuild path. Owning the source early is what makes the later projection cheap.

## Checklist

- [ ] Did we capture the information need, not just the events?
- [ ] Did we avoid inventing a domain event?
- [ ] Did we mark the source as unknown where it is unknown?
- [ ] Did we record who needs it and what decision it supports?
- [ ] Did we keep it off the Big Picture event timeline?
- [ ] At Design, did we trace each field to a source context?
- [ ] Did we assign the API to the team that owns the source context?
- [ ] Did we name a composition owner for the screen?
- [ ] Is this read model decision-supporting or presentation?
- [ ] Can it be deferred?

## Common mistakes

- Inventing `HomePageViewed` or `HomePageDataFetched` as domain events.
- Treating the screen as the read model.
- Assigning the API to the team that owns the screen rather than the team that owns the data.
- Modeling content or CMS data as a domain aggregate.
- Deferring a decision-supporting read model and discovering it during implementation.
- Putting read models on the Big Picture timeline.
- Creating a single "frontend API" team that owns data it does not own.

## See also

- [DDD notes](../domain-driven-design-ddd/README.md) — bounded contexts, aggregates, and ownership.
- [Bounded contexts, microservices, and teams](../domain-driven-design-ddd/bounded-contexts-microservices-and-teams.md) — code, data, deployment, and design ownership.
- [Subdomains and bounded contexts](../domain-driven-design-ddd/subdomains-and-bounded-contexts.md)
- [Domain events](../../fundamentals/10-domain-events/README.md) — the event vocabulary.
- [Aggregates](../../fundamentals/07-aggregates/README.md) — the consistency boundary.

## Sources

- Brandolini, [*Introducing Event Storming*](https://ziobrando.blogspot.com/2013/11/introducing-event-storming.html) (2013) — the workshop format and the three levels.
- Dudycz, [*Guide to Projections and Read Models in Event-Driven Architecture*](https://event-driven.io/en/projections_and_read_models_in_event_driven_architecture/) (2023) — read models as secondary data, and projection rebuilds.
- Evans, [*Domain-Driven Design*](https://www.informit.com/store/domain-driven-design-tackling-complexity-in-the-heart-of-9780321125217) (2003) — bounded contexts, ubiquitous language, and model ownership.
- Fowler, [*BoundedContext*](https://martinfowler.com/bliki/BoundedContext.html) — the linguistic boundary.
- Fowler, [*CQRS*](https://martinfowler.com/bliki/CQRS.html) (2011) — separate models for reads and writes; CQRS per bounded context. Fowler credits Greg Young with the pattern.
- Fowler, [*Event Sourcing*](https://martinfowler.com/eaaDev/EventSourcing.html) (2005) — application state is derivable from the event log; complete rebuild is possible.
- Helland, [*Data on the Outside versus Data on the Inside*](https://www.microsoft.com/en-us/research/publication/data-on-the-outside-versus-data-on-the-inside/) (2005) — service data encapsulation and authoritative ownership.
- Kleppmann, [*Designing Data-Intensive Applications*](https://dataintensive.net/) (2017), Part III, "Derived Data" — systems of record versus derived data; derived data can be recreated.
- Richardson, [*Database per service*](https://microservices.io/patterns/data/database-per-service.html) — each service's data is private behind its API.
