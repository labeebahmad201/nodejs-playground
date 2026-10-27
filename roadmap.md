# Architecture Roadmap

A fast plan for learning application and system architecture through trade-offs, not memorized definitions.

> **Rule:** Don't study architectures. Study the forces each one optimizes for, and produce a trade-off artifact for each.

The running case study is the order example already in the repo:
[composition root example](fundamentals/oop/design-patterns/06-composition-root/main.ts).

---

## Goal

Be able to:

- compare architectures on concrete trade-offs;
- choose a sensible default for a business system;
- explain when a more complex architecture is justified;
- challenge an architecture proposal with specific questions;
- say "I would choose X because Y, and I would revisit it if Z."

The target is judgment, not vocabulary.

---

## Scope

### Deep dive

- Modular monolith
- Hexagonal / ports and adapters
- Microservices
- Event-driven architecture
- CQRS
- DDD strategic design and bounded contexts
- Distributed data and consistency
- Resilience and observability

### Trade-off awareness only

- Layered architecture
- Clean / onion architecture
- Vertical slice architecture
- Event sourcing
- Serverless
- SOA
- Actor model
- Microkernel
- Pipeline
- Space-based architecture

### Skip for now

- Kubernetes
- Service mesh
- Cloud certifications

Those are infrastructure and operations, not architecture fundamentals.

---

## Time budget

Each day is about **75–90 minutes**:

- 25 min reading
- 20 min notes
- 20 min diagram or small code sketch
- 10 min explaining it out loud

If a day slips, write the output from memory and move on. Do not read more to compensate.

---

## The 8-day plan

### Day 1 — Foundations and trade-off vocabulary

- [ ] **Learn:** architecture vs. design; quality attributes; coupling and cohesion at module scale; unit of deployment, ownership, change, consistency, and failure; context-dependent fit and the change you expect next; ADRs; C4 diagrams.
- [ ] **Read:** *Fundamentals of Software Architecture*, Part I. Skim the [ADR](https://adr.github.io/) and [C4](https://c4model.com/) docs, then the [C4 reference note](architecture/01b-c4-model.md).
- [ ] **Output:** `architecture/01-tradeoff-vocabulary.md`
  - the 12 trade-off questions;
  - a one-page ADR for a decision in the current project;
  - a blank trade-off matrix with columns: **Optimizes / Costs / Use when / Avoid when / Failure mode**.
- [ ] **Done when:** you can explain why "it depends" is a real answer, not a dodge, and why no architecture is universally best.

---

### Day 2 — Layered vs. hexagonal vs. clean/onion vs. vertical slice

- [ ] **Learn:** where dependencies point; where `new` lives; what is testable without I/O; why layered architecture leaks; how vertical slice differs.
- [ ] **Read:** the relevant style chapters in *Fundamentals of Software Architecture*; Cockburn's ports and adapters; Fowler on layering.
- [ ] **Output:** `architecture/02-application-structure.md`
  - comparison table for the four styles;
  - a sketch refactoring the existing order example into ports and adapters;
  - three questions to ask before choosing each style.
- [ ] **Done when:** you can explain the difference between layered, hexagonal, and clean without hand-waving.

---

### Day 3 — Modular monolith and DDD boundaries

- [ ] **Learn:** module vs. bounded context; context maps; ubiquitous language; transaction boundaries; why a modular monolith is not a layered monolith.
- [ ] **Read:** the [modular monolith reference note](architecture/01a-modular-monolith.md); DDD strategic design: bounded contexts, context maps, ubiquitous language.
- [ ] **Output:** `architecture/03-modular-monolith.md`
  - module map for an order system: Orders, Payments, Inventory, Notifications, Reporting;
  - bounded context map;
  - data ownership notes: which module owns which tables;
  - a paragraph on what would justify extracting a module.
- [ ] **Done when:** you can say what a module is responsible for without listing technical layers.

---

### Day 4 — Microservices and data ownership

- [ ] **Learn:** service granularity; independent deployability; distributed monolith; data ownership; synchronous vs. asynchronous integration; partial failure.
- [ ] **Read:** *Building Microservices*, early chapters; *Software Architecture: The Hard Parts* on granularity, data ownership, and distributed workflows.
- [ ] **Output:** `architecture/04-microservices.md`
  - microservices trade-off note;
  - "when to extract a service" checklist;
  - one proposed service boundary and the force that justifies it;
  - a list of what gets worse when you extract it.
- [ ] **Done when:** you can argue both for and against microservices in a specific scenario.

---

### Day 5 — Event-driven, CQRS, and event sourcing

- [ ] **Learn:** events as contracts; pub/sub; eventual consistency; idempotency; read/write models; event log as source of truth; why CQRS is not event sourcing.
- [ ] **Read:** the event-driven chapter; CQRS and event-sourcing material; the [outbox core note](architecture/01c-outbox-pattern.md), [implementation note](architecture/01d-outbox-implementation.md), and [idempotency note](architecture/01g-idempotency.md); [microservices.io](https://microservices.io/) patterns for outbox and saga.
- [ ] **Output:** `architecture/05-events-cqrs.md`
  - event flow: `OrderPlaced` → Inventory → Notification → Reporting;
  - comparison table: event-driven vs. CQRS vs. event sourcing;
  - the event contract and what happens if it changes;
  - where consistency is eventual, and where it must be strong.
- [ ] **Done when:** you can explain why adding events is also adding coupling.

---

### Day 6 — Distributed data and resilience

- [ ] **Learn:** CAP as partition behavior; consistency models; replication; partitioning; idempotency; retries; timeouts; circuit breakers; bulkheads; outbox; sagas; backpressure; observability.
- [ ] **Read:** *Designing Data-Intensive Applications*, chapter 1 and chapters 5–9; *Release It!* stability patterns; the [outbox core note](architecture/01c-outbox-pattern.md), the [external-calls-in-transactions anti-pattern](architecture/01e-external-calls-inside-transactions.md), and the [idempotency note](architecture/01g-idempotency.md).
- [ ] **Output:** `architecture/06-distributed-data.md`
  - failure-mode checklist;
  - one-page "distributed data rules";
  - a retry/timeout/idempotency policy for the order flow;
  - the blast radius of a Payment service outage.
- [ ] **Done when:** you can explain why "exactly once" is mostly a myth and what to do instead.

---

### Day 7 — Niche styles and organizational architecture

- [ ] **Learn:** serverless, SOA, actor model, microkernel, pipeline, space-based — enough to know their trade-off. Then Conway's law, bounded contexts, team ownership, Team Topologies.
- [ ] **Read:** skim the remaining style chapters; *Team Topologies* first half.
- [ ] **Output:** `architecture/07-other-styles-and-teams.md`
  - one row per niche style in the trade-off matrix;
  - team ownership map for the order system;
  - three Conway's law observations: what architecture does the current team structure produce?
- [ ] **Done when:** you can say "we are not using this because..." for each style, not just "we are not using it."

---

### Day 8 — Capstone: defend an architecture

**Scenario:** an e-commerce order system, three teams, growing traffic, audit requirements, async notifications, reporting needs.

**Default design:**

- modular monolith;
- hexagonal modules;
- one database, schema per module;
- outbox for reliable events;
- event-driven notifications and inventory;
- CQRS for reporting;
- no microservices yet.

- [ ] **Output:** `architecture/08-capstone-order-system.md`
  - C4 context and container diagrams;
  - module and bounded context map;
  - five ADRs:
    1. modular monolith over microservices;
    2. synchronous calls inside the monolith;
    3. outbox for integration events;
    4. CQRS only for reporting;
    5. what would trigger extracting Payments or Notifications;
  - a 2-minute spoken defense:
    - why not microservices now?
    - why not event sourcing?
    - why CQRS only for reporting?
    - why does this design serve customer value, not just technical elegance?
    - what would make you change your mind?
- [ ] **Done when:** you can defend the design and name the conditions under which it would be wrong.

---

## Artifacts

By the end:

- one [trade-off matrix](architecture/tradeoffs.md) covering every style;
- one capstone design with diagrams and ADRs;
- one "when to use / when not to use" sheet per major style;
- a 2-minute explanation for each of the six core styles.

That is more valuable than reading five books cover to cover.

---

## Success criteria

You should be able to:

- compare any two styles on five axes without notes;
- explain why microservices are not a default;
- explain why CQRS is not event sourcing;
- explain why events are coupling;
- explain why working software is a leading indicator, not the primary measure — customer value is;
- name the failure modes of each style;
- write an ADR with context, decision, consequences, and alternatives;
- say "I would choose X because Y, and I would revisit it if Z" — with specifics.

---

## If you want to go faster

**One-afternoon version:**

1. Read the completed trade-off matrix.
2. Do the Day 8 capstone design.
3. Write the five ADRs.
4. Explain it out loud for 10 minutes.

That gives you the vocabulary and the judgment. The rest is depth.

---

## Proposed output layout

```text
architecture/
  README.md
  01-tradeoff-vocabulary.md
  01a-modular-monolith.md
  01b-c4-model.md
  01c-outbox-pattern.md
  01d-outbox-implementation.md
  01e-external-calls-inside-transactions.md
  01f-customer-value-and-progress.md
  01g-idempotency.md
  01c-outbox-example/
    README.md
    main.ts
  tradeoffs.md
  02-application-structure.md
  03-modular-monolith.md
  04-microservices.md
  05-events-cqrs.md
  06-distributed-data.md
  07-other-styles-and-teams.md
  08-capstone-order-system.md
  adr/
    0001-composition-root.md
```

Start at [Day 1 — trade-off vocabulary](architecture/01-tradeoff-vocabulary.md). The order example from the composition-root note is the seed for the capstone.
