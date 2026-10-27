# 01h — Practice provenance and context

*A practice is a response to a context. Its popularity is evidence of a community, not evidence of fit.*

DDD, C4, ADRs, microservices, MVP loops, and “move fast” advice did not appear in a vacuum. They were shaped by the problems, constraints, and incentives of the communities that produced and promoted them.

That matters because a practice can be excellent in the context that produced it and a tax in another. The useful question is not “Is this best practice?” It is “What did this practice assume about the world, and do those assumptions hold here?”

## The claim

Architecture practices carry their context with them:

- a regulatory regime;
- the cost of failure;
- the funding horizon;
- the stability of the team and the domain;
- who the customer is and how they buy;
- how many teams must coordinate;
- what the conference circuit rewards.

When those forces differ, the same practice can be right in one place and wrong in another.

## What this is not

This is **not** a claim that one country or culture is better at software.

A common observation is that European architecture conferences often reward methodical risk control, while US product and engineering conferences often reward speed, scale, and shipping stories. Treat that as a **hypothesis about incentives**, not a law about people.

The lazy version is a stereotype:

> “Europe is methodical and slow; the US is fast and reckless.”

The useful version is a context map:

> “This practice assumes high failure cost, strong regulation, long-lived teams, and heavy coordination. Which of those assumptions hold in our system?”

Use the forces directly. Geography is only a proxy for them.

## The forces behind the culture

| Force | Pushes toward methodical | Pushes toward speed |
| --- | --- | --- |
| **Cost of failure** | Payments, health, safety, public infrastructure | Content, experiments, internal tools |
| **Regulation** | Audits, data residency, compliance, traceability | Low-regulation, low-risk products |
| **Funding horizon** | Long-lived platform, public sector, enterprise | Startup runway, uncertain product |
| **Domain stability** | Stable, well-understood domain | New or rapidly changing domain |
| **Customer access** | Procurement, committees, contracts | Direct users, fast feedback |
| **Coordination** | Many teams, shared dependencies | Small team, one owner |
| **Failure visibility** | Public, contractual, or safety-critical | Private, reversible, low-cost |
| **Product uncertainty** | Low: optimize the known process | High: learn what the product should be |

The methodical style is a risk-management strategy. The speed style is a learning strategy. Each is rational under different constraints. Neither is a personality trait.

## The conference filter

Conferences are a selection filter, not a fitness function. A talk is more likely to be accepted when it is:

- novel;
- a clean story;
- delivered well;
- backed by a recognizable company;
- useful to the audience’s current aspiration;
- supported by a vendor or consultancy.

That filter is not evil. It is just not the same as “this will work in your system.” The failure mode is **conference-driven architecture**: adopting a practice because it was legible on stage, not because its assumptions match the problem.

Ask:

- Who benefits from this practice being popular?
- What failure cases are missing from the talk?
- Is this a story from a company with a different scale, regulation, or funding model?
- Would this practice still be recommended if it were not fashionable?

## Two styles, two contexts

| Practice | Context it tends to fit | Context where it can become a tax |
| --- | --- | --- |
| **DDD strategic design** | Complex, long-lived domain; access to domain experts; many rules and language boundaries | Simple CRUD; unknown domain; no domain expert; a short-lived prototype |
| **ADRs and C4** | Multiple audiences; long-lived decisions; onboarding; audits; distributed systems | Solo prototype; no one will maintain the diagrams; the decision is cheap to reverse |
| **Microservices** | Independent ownership, scaling, and failure isolation; a platform team can operate them | Small team; unclear boundaries; no operational capability; a distributed monolith |
| **MVP and fast iteration** | High product uncertainty; cheap failure; direct customer feedback | Payments, health, safety, or regulated data; failure is expensive or irreversible |
| **Heavy upfront modeling** | Stable, regulated, high-cost-of-error domain | Discovery-stage product; the model will change next week |
| **Rigid change control** | High compliance, audit, or safety needs | A market where speed of learning is the constraint |

The point is not that one column is good and the other is bad. The point is that the columns describe different **constraints**, and the constraints decide.

## Speed and stability are not always a zero-sum trade-off

It is tempting to turn this into “fast or safe.” That is too simple.

High-performing organizations often improve speed and stability together through automation, small batches, fast feedback, and good observability. The trade-off is not always “go fast or be safe.” It is often:

- which risks are we taking?
- which risks are we buying down?
- what are we learning, and at what cost?
- which failure is cheap enough to tolerate?
- which failure would be catastrophic?

That is why “move fast” is not a universal virtue and “methodical” is not a universal virtue. Each is a bet about which failure matters.

## Questions to ask of a practice

1. What context produced this practice?
2. What does it assume about failure cost, regulation, team size, funding horizon, domain stability, and customer access?
3. Which of those assumptions hold here?
4. What does it optimize? What does it sacrifice?
5. Is it popular because it fits, or because it is legible at a conference?
6. Are we using “methodical” to avoid deciding, or “fast” to avoid thinking?
7. What would we have to change to adopt it safely?
8. What is the smallest experiment that would tell us whether it fits?

## In the order system

The same system can contain both styles:

- **Payments** — high failure cost, compliance, audit. Be methodical: idempotency, outbox, state machines, ADRs, reconciliation.
- **Notifications** — lower failure cost, high change, direct customer feedback. Be faster: a simple worker, a small experiment, a tight feedback loop.
- **Reporting** — different read and write shapes. Use a read model or CQRS only where the load or model actually diverges.
- **Checkout** — a strong consistency boundary. Keep the invariant local until a concrete force justifies a saga or a service.

That is not inconsistency. It is fitting the practice to the failure cost and change rate of each capability.

## What I would not take from this

- Not “Europe is slow; the US is fast.”
- Not “methodical is always better.”
- Not “speed is always better.”
- Not “culture excuses skipping rigor.”
- Not “a conference talk is evidence of fitness.”
- Not “every practice is equally valid.” Context explains a choice; it does not make all choices equal.

## Sources

- Conway, [*How Do Committees Invent?*](http://www.melconway.com/Home/Committees_Paper.html) (1968), for the link between organization and design.
- Evans, [*Domain-Driven Design*](https://www.domainlanguage.com/ddd/) (2003), for the context DDD assumes.
- Ries, *The Lean Startup* (2011), for validated learning under uncertainty.
- Perri, *Escaping the Build Trap* (2018), for outcomes over output.
- Forsgren, Humble & Kim, *Accelerate* (2018), for speed and stability as a socio-technical system, not a simple seesaw.
- Skelton & Pais, *Team Topologies* (2019), for team context and cognitive load.
- Fowler, [*Microservice Trade-Offs*](https://martinfowler.com/articles/microservice-trade-offs.html) (2015).
- Brooks, [*No Silver Bullet*](https://www.cs.unc.edu/techreports/86-020.pdf) (1986).

The Europe/US conference observation is a hypothesis from experience, not a sourced empirical claim. The note uses it only to ask better questions about context.

## Next

- [01 — Trade-off vocabulary](01-tradeoff-vocabulary.md) — the 12 questions and the “it depends” formula.
- [01a — Modular monolith](01a-modular-monolith.md) — fit before distribution.
- [01f — Customer value](01f-customer-value-and-progress.md) — the outcome the practice should serve.
- [Trade-offs](tradeoffs.md) — the consolidated matrix.
