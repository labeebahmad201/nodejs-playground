# Lessons from Eberhard Wolff's DDD example

Source: [Domain-Driven Design: A Complete Example](https://www.youtube.com/watch?v=f91ubquN3Tc) — Eberhard Wolff, JCON EUROPE 2024. The talk follows an e-commerce example from event storming through bounded contexts, the core domain, team topologies, and technical design.

## DDD is iterative, not a waterfall

The talk moves from abstract to concrete, but the work is not a waterfall. Repeat the steps, change the level of abstraction, and expect to revise the model as you learn. Software development is a learning process; you will not get it right the first time.

## Event storming builds a shared understanding

Domain experts know the domain but not how to structure it as software. Engineers know how to structure knowledge but not the domain. You need both, and event storming gives them a way to collaborate without formal notation.

- Write domain events in the past tense on orange stickies: `Order accepted`, `Parcel left the warehouse`.
- Start with chaotic exploration: produce as many events as possible.
- Enforce a timeline: remove duplicates, discuss gaps, decide what must happen before what.
- Separate parallel work into swim lanes, such as invoicing and delivery.
- Mark pivotal events.

A pivotal event is a point after which the world is different: new objects appear and old ones disappear. `Order accepted` ends the shopping cart and starts the order; the cart is gone. A pivotal event does not have to require compensation. Compensation is a separate concern; the test is whether the model has changed.

Event storming is low-tech, lets many people contribute in parallel, and makes it obvious how people interact. But the artifact is not the goal. The goal is a shared understanding of the domain. That also means getting the right people in the room: people with vision and people who know the day-to-day work.

## Bounded contexts are discovered, not mechanically cut

Swim lanes suggest candidates for subdomains; pivotal events and changes in vocabulary suggest where a new bounded context may be needed. Both are indicators, not mechanical cuts. A pivotal event does not automatically justify a new model. `Parcel left the warehouse` changes what matters — the products stop mattering and the parcel becomes the subject — but whether that deserves a separate context is a judgment call.

The same word can mean different things in different contexts. In the example, the customer who pays the invoice is not the customer who receives the delivery. One is a company in Hamburg; the other is a person near Ramstein. Calling both "the customer" hides the difference. Bounded contexts let you say "the customer in invoicing" and "the customer in delivery."

The ubiquitous language has to live in the code, in the database, and in the way people talk. A term that exists only in a glossary is not ubiquitous.

Good boundaries localize change. If delivery changes, the delivery context changes, not the whole system.

## The core domain is a business decision

The core domain is the motivation for the product. It is the part that deserves the most attention, the best model, and the most careful design. Other parts are supporting or generic and should not get the same investment.

You cannot identify the core domain from the code or from the architecture. Ask the domain experts. In the example, the company cares about delivering quickly and reliably, so delivery is the core domain; order processing and invoicing support it. "I don't know" is a valid answer, and the right next step is to ask someone who does.

## Team topologies connect the model to the organization

Wolff prefers team topologies over classic strategic design because it acknowledges more fracture planes and more kinds of teams.

- **Stream-aligned teams** deliver value end to end and map naturally to bounded contexts.
- **Enabling teams** help other teams for a limited time, for example with architecture.
- **Platform teams** provide self-service infrastructure such as Kubernetes or CI.
- **Complicated-subsystem teams** take on a high-cognitive-load area behind an API, such as delivery optimization.

Fracture planes are not only bounded contexts. Location is one: if people are in different cities, a team per location may make more sense than distributing every team across both.

The team types are not an org chart. Drawing the chart does not change how people collaborate. Architecture has to enable teams, not control them. Real organizations may impose governance or other constraints; compromises are normal, but make them explicit.

## Technical design is a hierarchy of responsibilities

The tactical patterns build on each other. Dependencies point downward: services use aggregates, aggregates use entities and value objects, not the other way around.

| Pattern | Responsibility |
| --- | --- |
| Entity | Identity, lifecycle, and behavior. |
| Value object | No identity; immutable value; equality by attributes. |
| Domain event | Something that happened and matters to the domain. |
| Aggregate | A consistency boundary of entities and value objects; the root guards invariants. |
| Repository | The illusion of a collection of aggregates; hides persistence; no generic query interface. |
| Factory | Creates complex value objects and aggregates. |
| Service | Logic that does not fit one entity or aggregate, often spanning several aggregates. |

An aggregate is not just a cluster of objects; it is a boundary. The root is the only entry point, and it keeps everything inside consistent. A repository is not a generic DAO; it offers the access paths the domain needs. A service is not a dumping ground; it holds logic that genuinely does not belong to one aggregate. `Schedule delivery` is the example: it needs the customer and the delivery, so it cannot live in either.

## Choose DDD deliberately

For less complex systems, two alternatives are often enough:

- **Transaction script** — one procedure per request, reading and writing the database directly. Simple and easy to follow when the logic is simple.
- **Table model** — one instance handles the business logic for all rows in a table or view. Closely tied to the database.

Choosing DDD means knowing what you are not choosing. If the requirement is only "show this data," a transaction script may be the right tool. If the conversation turns into business rules — can we deliver to this customer? — technical design may be justified.

## Keep context dependencies honest

Bounded contexts have dependencies too. In the example, the order process uses delivery and invoicing to forward order information; delivery and invoicing do not depend on order processing.

Architecture management tools can check these dependencies, but the point is not enforcement. A violation means either the team did not understand the architecture or the architecture is wrong. Both are reasons to talk, not to add a gate.

## Technology serves the model

The DDD concepts are framework-agnostic. Plain objects persisted with JPA are a valid implementation. Libraries such as jMolecules can express DDD concepts directly, but the model should not be shaped by the framework.

## Source

- Eberhard Wolff, [Domain-Driven Design: A Complete Example](https://www.youtube.com/watch?v=f91ubquN3Tc), JCON EUROPE 2024.
- [Session page](https://2024.europe.jcon.one/sessions) — Cinema 7, 14 May 2024.
- [Eberhard Wolff](https://ewolff.com/).
