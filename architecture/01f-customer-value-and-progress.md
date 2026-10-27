# 01f — Customer value is the measure of progress

*Working software is a leading indicator. Customer value is the outcome. Architecture is a means to that outcome, not the outcome itself.*

Source: Christopher Okhravi, [*Working Software Is Not The Primary Measure of Progress*](https://www.youtube.com/watch?v=rV0a-b_VhBg) (2024).

## The claim

The seventh Agile principle says:

> Working software is the primary measure of progress.

Okhravi argues this is backwards. Working software is necessary, but it is not sufficient. Software can work perfectly and still be useless. The primary measure is **customer value**.

That distinction is the whole note:

- **Working software** answers: *did we build it right?*
- **Customer value** answers: *did we build the right thing?*

Verification versus validation. Output versus outcome.

A working feature that nobody uses, that makes a task slower, or that solves a problem the customer does not have is not progress. It is inventory.

## Why “working software” is the wrong primary measure

Working software is a **leading indicator**. It tells you the team can build and ship. It does not tell you whether shipping changed anything for the customer.

It fails as a primary measure because:

- it measures delivery, not effect;
- it treats all working features as equally valuable;
- it can reward building before validating;
- it can hide waste: code that works but should not exist;
- it can make “we shipped” look like “we made progress”;
- it can miss the case where the right answer is not software at all.

Okhravi’s stronger point: if customer value is primary, then sometimes the correct decision is **not to build software**. A process change, a manual service, a spreadsheet, or buying an existing tool may deliver more value than a new system.

That does not make working software unimportant. It makes it a **necessary condition**, not the goal.

## The seven rules

Okhravi proposes seven rules for keeping decisions anchored to customer value. They are useful as a filter for architecture work too.

| Rule | What it means | Architecture implication |
| --- | --- | --- |
| **1. Never automate before value has been established** | Prove the workflow manually first. Automate repetition, not speculation. | Do not build a platform, pipeline, or abstraction for a process nobody has validated. Automate tests and delivery safety, but not hypothetical product features. |
| **2. Never work for too long before value has been established** | Shorten the time between starting and learning whether anyone cares. | Prefer a walking skeleton and vertical slices over a six-month platform build. Deploy early enough to learn. |
| **3. Plan minimally** | Plan enough to act and learn; do not pretend uncertainty is gone. | Use ADRs for irreversible or expensive decisions. Defer reversible details. Do not produce a design document that predicts a future you have not seen. |
| **4. No premature abstraction** | Do not generalize before you understand the variation. | Do not split into microservices, invent a shared kernel, or create extension points for use cases that do not exist. Wait for the third real use. |
| **5. No premature optimization** | Measure before optimizing. Optimize the bottleneck you have. | Do not distribute for hypothetical scale. Do not add caches, CQRS, or event sourcing before you can name the measured force. |
| **6. Never leave a mess** | Speed is not an excuse for code you cannot change. | Keep module boundaries, tests, observability, and explicit debt. “Customer value now” does not mean “dump the cost on the next person.” |
| **7. Never ask when you can test** | Prefer evidence to opinion. Run the experiment. | Prototype, spike, load-test, contract-test, or user-test before committing to a large design. An ADR can record the experiment and its result. |

Rule 6 is the important counterweight. Without it, “customer value” becomes an excuse for a big ball of mud. The argument is not “ship garbage fast.” It is “learn fast without making the codebase unable to learn again.”

## What this means for architecture

Architecture is not valuable in the abstract. A quality attribute matters only if it affects customer value, risk, or the cost of future change.

That changes how to read the [trade-off matrix](tradeoffs.md):

- A row is not “good” because it optimizes a quality attribute. It is good only if that attribute matters to someone.
- “Independent deployability” is not a value by itself. It is valuable if it shortens feedback, reduces coordination cost, or enables a real release cadence.
- “Scalability” is not a value by itself. It is valuable if the system will actually face the load, or if the cost of being wrong is high.
- “Consistency” is not a value by itself. It is valuable where the business cannot tolerate a stale or invalid state.
- “Simplicity” is usually a good default because it preserves the ability to change.

The architecture translation is:

> **Choose the simplest structure that satisfies the current value and preserves the options that future value may require.**

That is the same principle as “modular monolith first, extract when forced.” It is not indecision. It is sequencing.

## What I would not take from the video

This is a corrective, not a license to ignore design.

It does **not** mean:

- architecture does not matter;
- working software does not matter;
- every decision must ship a feature this week;
- non-functional requirements are optional;
- customers should design the architecture;
- all planning is waste;
- revenue is the only measure of value.

Reliability, security, accessibility, compliance, latency, and maintainability are all forms of customer value or risk reduction. They are not “technical extras” outside the value conversation.

The useful distinction is:

- **Customer value** is the goal.
- **Working software** is evidence that you can deliver it.
- **Architecture** is the set of decisions that determine how cheaply you can keep delivering it.

## Questions to ask before an architecture decision

1. Who is the customer, and what outcome changes for them?
2. What is the smallest thing that would test whether this is valuable?
3. Which quality attribute does this choice protect, and for whom?
4. What evidence do we have for the force: traffic, latency, team size, compliance, failure cost?
5. What is the cost of being wrong? Can we reverse it?
6. What mess are we leaving, and who will pay for it?
7. What can we test instead of debating?
8. If this choice works, what will we learn? If it fails, what will we learn?

## Relationship to the roadmap

- Day 1’s “it depends” is not relativism. The forces are derived from value and risk.
- Day 3’s modular monolith is a bet on learning boundaries before paying the distribution premium.
- Day 5’s outbox is justified by a concrete failure: a payment fact that must not be lost while a notification must not fail the payment.
- Day 8’s capstone should defend the design in terms of customer value, not just technical elegance.

## Sources

- Okhravi, [*Working Software Is Not The Primary Measure of Progress*](https://www.youtube.com/watch?v=rV0a-b_VhBg) (2024).
- [Principles behind the Agile Manifesto](https://agilemanifesto.org/principles.html) — the original seventh principle.
- Graham, [*Do Things That Don’t Scale*](https://paulgraham.com/ds.html) — the manual-first idea behind rule 1.
- Knuth, *Structured Programming with go to Statements* (1974) — the original “premature optimization” warning.
- Ries, *The Lean Startup* (2011) — validated learning and build-measure-learn.
- Perri, *Escaping the Build Trap* (2018) — outcomes over outputs.
- Forsgren, Humble & Kim, *Accelerate* (2018) — delivery performance as a means, not the end.

## Next

- [Trade-offs](tradeoffs.md) — the consolidated matrix this note reframes.
- [Modular monolith](01a-modular-monolith.md) — the default that avoids premature distribution.
- [Outbox pattern](01c-outbox-pattern.md) — a reliability choice justified by a concrete failure, not fashion.
- [Roadmap](../roadmap.md) — the 8-day plan.
