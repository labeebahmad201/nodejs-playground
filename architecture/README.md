# Architecture

*Notes for the [8-day architecture roadmap](../roadmap.md). The goal is judgment about trade-offs, not memorized style names.*

> There is no perfect architecture. There is only fit for the problem, the forces, and the change you expect next.

## Day 1

- [01 — Trade-off vocabulary](01-tradeoff-vocabulary.md) — architecture vs design, quality attributes, coupling and cohesion, the 12 trade-off questions, contextual fit, ADRs, and C4.
- [ADR-0001 — Use a composition root](adr/0001-composition-root.md) — a worked one-page decision record from the existing order example.

## Day 2

- [02 — Layered architecture](02-layered-architecture.md) — technical layering, closed versus open layers, dependency direction, the sinkhole, and when layered is the right default.
- [02 — Layered nuances](02-layered-nuances.md) — the 42-nuance catalog: rule, correct snippet, anti-pattern, and proof for each.
- [02a — Big ball of mud](02a-big-ball-of-mud.md) — the anti-pattern behind boundary erosion, why layer-first layout hides the capability boundary, and how to get out without a rewrite.
- [02c — One request, end to end](02c-end-to-end-slice.md) — controller, use case, application service, domain service, repository port, adapter, and aggregate in one runnable slice, plus when the use-case contract is worth its cost.
- [Layered architecture lab](02-layered-example/README.md) — 42 runnable TypeScript nuances, an end-to-end slice, and a `node:test` proof for each.

## Trade-offs

- [Consolidated trade-off matrix](tradeoffs.md) — one row per style or decision: optimizes, costs, use when, avoid when, failure mode.

## Reference notes

These expand topics that came up during Day 1 and are reference material for the later days. They are not extra reading to finish first.

- [01a — Modular monolith](01a-modular-monolith.md) — one deployable, explicit module boundaries, data ownership, enforcement, failure modes, and when to extract a service.
- [01b — C4 model](01b-c4-model.md) — context, container, component, and code diagrams, with the order system as the worked example.
- [01c — Outbox pattern](01c-outbox-pattern.md) — reliable event publication, at-least-once delivery, idempotency, relay ownership, and when the outbox is worth its cost.
- [01d — Outbox implementation](01d-outbox-implementation.md) — table shape, relay mechanics, ownership, ordering, monitoring, and the full Payment → Notification walkthrough.
- [01e — External calls inside a transaction](01e-external-calls-inside-transactions.md) — the anti-pattern that outbox and state machines are designed to avoid.
- [01f — Customer value is the measure of progress](01f-customer-value-and-progress.md) — working software as a leading indicator, customer value as the outcome, and seven rules for keeping architecture decisions honest.
- [01g — Idempotency](01g-idempotency.md) — safe retries, idempotency keys, consumer inboxes, and why at-least-once delivery makes it mandatory.
- [01h — Practice provenance and context](01h-practice-provenance.md) — why a practice’s popularity is not evidence of fit, and how to read methodical versus speed-oriented advice without turning it into a stereotype.

## Examples

- [Outbox example](01c-outbox-example/main.ts) — a runnable example showing exactly where the API calls and transaction boundaries are.

## Running example

The order example from the composition-root note is the seed for the capstone:

- [main.ts](../fundamentals/oop/design-patterns/06-composition-root/main.ts)
- [composition-root.md](../fundamentals/oop/design-patterns/06-composition-root/composition-root.md)
