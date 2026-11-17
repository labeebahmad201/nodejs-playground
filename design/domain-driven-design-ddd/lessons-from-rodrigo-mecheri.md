# Lessons from Rodrigo Mecheri: domains, subdomains, and the operating model

Source: [Domains, Subdomains, and Bounded Contexts in DDD](https://rodrigomecheri.dev/blog/domains-and-subdomains-in-ddd/) — Rodrigo Mecheri, 15 Oct 2026.

The article is a clean restatement of the strategic side of DDD: what a domain is, how subdomains differ from bounded contexts, and why a decomposition is not a service diagram. Its most useful contribution is the insistence that **boundaries are contingent** — they depend on the business, its operating model, and its rules, not on a universal template.

The article covers the three concepts, contingency, the capability tests, warning signs, and the decision sequence. The **reference vs consistency vs cohesion** framing, the **Conway/organizational layer**, and the **greenfield "author the operating model"** step are extensions from our discussion, not claims from the article. They are marked where they appear.

## The three concepts

| Concept | Main question | Belongs to | Typical outcome |
| --- | --- | --- | --- |
| **Domain** | What business are we in? | Problem space | Shared understanding of the business area |
| **Subdomain** | Which distinct capability are we examining? | Problem space | A decomposition of business responsibilities |
| **Bounded context** | Where is this model and language valid? | Solution space | An explicit model boundary and integration contract |

A subdomain is a **business problem, not a software component**. It can be implemented as a module in a monolith, a group of components, or one or more services. DDD does not prescribe a deployment architecture just because a business area has been identified.

## Decomposition is not universal

The article's central claim:

> This is an illustrative decomposition, not a universal model. The boundaries depend on the actual business, its operating model, and the rules that distinguish one responsibility from another.

Two consequences follow.

1. There is no canonical subdomain list you can copy from a book. An e-commerce catalog/payment/fulfillment split is an example, not a standard.
2. Classification is contextual and temporary. A generic capability can become core when strategy changes, and a former differentiator can become generic as the market matures.

## Reference is not cohesion

The most common wrong test is *"can this exist without that?"*

- A bid cannot exist without a job.
- A payment cannot exist without a contract.
- A review cannot exist without a person and a contract.
- A message cannot exist without two people.

If referential dependency were the criterion, the entire marketplace would be one subdomain — the same size as the domain. That serves no purpose.

Three relationships get conflated:

| Relationship | Test | What it tells you |
| --- | --- | --- |
| **Reference** | "can't exist without" | aggregate/ID relationships — not subdomains |
| **Consistency** | "must change in the same transaction" | same aggregate or bounded context |
| **Cohesion** | "same language, rules, owner, reason to change" | same subdomain |

The bid passes consistency and cohesion: accepting it must close the job and reject competing bids, and it speaks the sourcing language. Payment and review fail cohesion even though they pass reference: they have their own ledgers, rules, experts, and reasons to change. The job is upstream; the contract or party is the real anchor.

## What anchors a subdomain

The article's test:

> If two activities use different rules, change for different reasons, or require different experts, they may belong to different subdomains.

A subdomain is a **coherent business capability**: an area of responsibility with its own

- **language** — a term means something specific here;
- **rules and invariants** — decisions that must stay consistent;
- **decision rights** — who can decide;
- **expertise** — a body of knowledge;
- **change driver** — it changes for its own reasons, at its own rate;
- **strategic value** — core, supporting, or generic.

The practical question is not *"which department owns it?"* but *"would a different expert, using different words, make different decisions here, for different reasons?"*

## What maps to what

The mapping runs from the business outward, not from departments inward:

| Layer | Anchored to | Department's role |
| --- | --- | --- |
| **Domain** | the business / market / problem space | none |
| **Subdomain** | business capabilities (language, rules, decisions, expertise, change driver, strategic value) | evidence / proxy only |
| **Bounded context** | model invariants, language boundaries, contracts | loose alignment |
| **Team** | communication structures, coordination cost, ownership | **primary** |
| **Service** | deployment, scaling, operational needs | indirect |

You do not map subdomains to departments. You map departments to **ownership of bounded contexts**. A department is a coordination container that can hold one capability or five; it can also split one capability across two departments. That is why "one department = one subdomain" fails in both directions.

## Conway belongs one layer lower

Conway's Law is descriptive: systems tend to mirror the communication structures of the organizations that build them. The "should" is the **Inverse Conway Maneuver**: shape the organization to get the architecture you want.

The org chart therefore maps most directly to the **team/service** layer, loosely to bounded contexts, and only indirectly to subdomains. Deriving subdomains from the org chart couples the model to an accident of history; every reorg becomes a re-architecture. Subdomains should outlive org charts.

The overhead worry is real, but it is a *different dial*. **"Don't split the team" does not mean "don't split the model."** You can keep several distinct subdomains and bounded contexts inside one team and one modular monolith. Coordination cost comes from splitting teams and deployments, not from naming capabilities.

> Business boundaries and deployment boundaries are related, but they are not interchangeable. — the article

## Greenfield: author the operating model

In an existing company, the operating model can be observed. In greenfield, it has to be **authored**. That is the step most DDD introductions skip.

**You do not discover subdomains in greenfield; you author the operating model and then read the subdomains off it.**

A useful instrument is a **provisional business story**: a one-page description of how the fictional (or target) business divides work. It should be falsifiable and rule-rich, not just boxes. At minimum it answers:

- Who are the actors, and what outcomes do they buy?
- What are the value streams?
- Which functions exist, and what does each **decide**, **own**, and get **measured on**?
- What rules and invariants does each function enforce?
- What would each function refuse to own?
- What external constraints apply — regulation, payment providers, identity/KYC, trust and safety?

Define responsibilities by **decision rights and outcomes**, not task lists. A team that "does reviews" is organized around activity; a team that "owns trust and safety outcomes" is organized around decisions. Subdomain seams follow the second.

Keep the story provisional. In a learning project, "fictional" is fine. In a real greenfield product, it is a hypothesis to validate with prospective customers and domain experts — you are doing product discovery and DDD at the same time, and invented rules may not match the market.

Some seams are environment-imposed rather than org-chosen: payments has a PSP/escrow/compliance seam, identity has KYC/OTP, trust has moderation. A fictional org cannot wish those away.

## Sizing the decomposition

The goal is neither maximum boxes nor one box.

- **Over-decomposition** creates integration overhead, distributed monoliths, and apparent parallelism with hidden coordination cost.
- **Under-decomposition** creates a god subdomain, a god aggregate, and change that requires coordinated edits across unrelated features.
- **The right granularity matches the decisions you need to make.** If the only decision is "what do we build next," a coarse map is enough. If the decision is "where do we invest versus buy," you need the core/supporting/generic split.

## One subdomain, several bounded contexts

A subdomain is problem space; how many bounded contexts realize it is solution space. The mapping is **not one-to-one in either direction**.

A **complex subdomain may need more than one bounded context**, because a single model cannot stay internally consistent across all of its concerns. The article's example: fulfillment may use separate models for warehouse planning and last-mile delivery, because the language and the optimization rules differ. Same capability, different models.

The trigger is **model complexity**, not feature count:

- different vocabulary or rules inside the same capability;
- different invariants or consistency needs;
- different optimization goals;
- different rates of change or different experts inside the subdomain;
- the point where the model stops being internally consistent.

Plausible marketplace examples:

- **Payments** → authorization/capture, ledger/payouts, and fraud/risk may diverge into separate contexts if their rules, providers, and change drivers differ.
- **Fulfillment** → warehouse planning and last-mile delivery, as in the article.
- **Identity** → authentication, verification/KYC, and access policy may separate as each grows.

The test is not *"how many contexts should this subdomain have?"* It is *"where does this model stop being internally consistent?"*

The reverse is also allowed: several **simple** subdomains may initially share one bounded context or module, provided their models stay clear and their changes do not interfere. That is the modular-monolith hedge. Shared context between unrelated subdomains becomes a smell when their language diverges.

Two cautions:

- Multiple contexts per subdomain is for a **complex single capability that needs multiple models**, not a license to bundle unrelated capabilities.
- If you split teams by context anyway, the subdomain label is decorative; the real decomposition happened at the context level.

"Complexity" here means **model complexity**, not code volume. A small feature with rich rules can justify its own context; a large but simple CRUD area may not.

## Warning signs that a boundary is wrong

From the article:

- the same term has conflicting meanings in different workflows;
- one model accumulates optional fields needed by unrelated features;
- a small business change requires coordinated edits across many modules;
- multiple areas write the same data without clear ownership;
- teams must understand each other's internal rules to make routine changes;
- a service mostly forwards calls and has no cohesive business responsibility.

These are prompts to return to the business rules, not proof that a particular refactor is correct.

## A practical sequence

1. Describe the business outcome without naming technologies.
2. Identify capabilities, rules, decisions, and domain experts.
3. Classify subdomains by current business strategy.
4. Find where terminology or rules require independent models.
5. Define ownership and contracts between those models.
6. Only then choose modules, data stores, processes, and deployments.

The sequence is iterative. Implementation knowledge can reveal a mistaken assumption about the domain.

## Applied to Gild

A plausible first lens for the marketplace:

| Subdomain | Anchor | Notes |
| --- | --- | --- |
| **Sourcing** | Jobs + Bids | Candidate merge: the acceptance invariant (close the job, reject competing bids) binds them. Seam is `BidAccepted` → Contracting. |
| **Contracting** | Contract, milestones | The commitment that carries money and obligations. |
| **Payments** | Contract/ledger | PSP, escrow, refunds, payouts, compliance. Environment-imposed seam. |
| **Reputation** | Party/contract | Reviews, ratings, moderation. Outlives the job and aggregates into profiles. |
| **Identity** | Account | KYC/OTP, verification, access. |
| **Messaging** | Conversation | Notifications and communication. |
| **Disputes** | Contract/payment | Trust and safety, resolution, arbitration. |

Jobs + Bids together is defensible because of a shared transaction. Reviews, Payments, and Disputes are separate even though they reference the job or contract, because they have their own rules, experts, and change drivers.

A subdomain in this table can itself need several bounded contexts. **Payments**, for instance, may split into authorization/capture, ledger/payouts, and fraud/risk if those concerns diverge in language, invariants, or provider constraints. One subdomain does not imply one model.

None of this is final. The domain expert — in a greenfield project, that may be the founder or product owner — decides how the business is portrayed, and the story is revised as the business is learned.

## Carry into our work

- **A subdomain is a business capability, not a department and not a service.** Departments show up at the ownership/team layer.
- **Do not group by reference.** "Can't exist without" collapses everything into one box. Group by consistency and cohesion.
- **A shared transaction is the strongest merge signal.** Jobs + Bids share one; Payments and Reviews do not.
- **Keep the model seams even when you consolidate the team.** One team and one modular monolith can own several contexts.
- **One subdomain can need several bounded contexts.** Complexity, not feature count, drives the split: separate the models where language, invariants, or optimization rules stop agreeing.
- **In greenfield, write the operating model first.** A rule-rich, falsifiable business story is the missing input that makes boundary decisions defensible and revisable.
- **Record the "why" next to the boundary.** The rationale is what makes the decomposition a design decision rather than an arbitrary split.

## See also

- [Subdomains and bounded contexts](subdomains-and-bounded-contexts.md)
- [Bounded contexts, microservices, and teams](bounded-contexts-microservices-and-teams.md)
- [Lessons from Rico Fritzsche: what "domain" means in DDD](lessons-from-rico-fritzsche.md)
- [Lessons from Eberhard Wolff's DDD example](lessons-from-eberhard-wolff.md)
- [Analytics as a bounded context](analytics-as-a-bounded-context.md)
