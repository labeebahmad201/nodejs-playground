# 02a — Big ball of mud

*A big ball of mud is the absence of enforced boundaries — not the presence of a bad folder layout.*

The term comes from Brian Foote and Joseph Yoder's 1997 paper, [*Big Ball of Mud*](http://www.laputan.org/mud/). They called it the de-facto standard architecture: the one most systems actually have, as opposed to the one on the slide. This note defines it, explains why a layer-first layout makes it more likely, and describes how to get out without a rewrite.

## The definition

> A BIG BALL OF MUD is haphazardly structured, sprawling, sloppy, duct-tape and bailing wire, spaghetti code jungle.

> Information is shared promiscuously among distant elements of the system, often to the point where nearly all the important information becomes global or duplicated.

> The overall structure of the system may never have been well defined. If it was, it may have eroded beyond recognition.

Three properties do the work:

1. **No enforced structure.** The system may have a diagram, but nothing in the code or CI makes the diagram true.
2. **Promiscuous information sharing.** State, models, tables, and helpers are reachable from everywhere. The important information becomes global or duplicated.
3. **Expedient repair.** Each change is locally reasonable and globally corrosive. Foote and Yoder's summary: organization "is dictated more by expediency than design."

The paper's image is a shantytown: cheap materials, unskilled labor, no infrastructure, no overall plan, but it satisfies an immediate local need. That is why it persists. **The mud works** — for a while, at the scale it was built for.

## What it is not

| It is not | Why |
| --- | --- |
| **Messy code** | Messy code is a local smell: a long function, a bad name, duplicated logic. A big ball of mud is a *global* property: no boundary survives. You can have clean files inside a mud, and ugly files inside a well-structured system. |
| **A monolith** | A monolith is one deployment unit. A modular monolith is a monolith with enforced boundaries. The mud is about boundaries, not deployment. |
| **Layered architecture** | A layered system has a structure — technical layers. It becomes mud when the layer rules and every implicit capability boundary erode. Layering is a risk factor, not the definition. |
| **Legacy code** | Legacy code can be old and well-structured. Age is not the variable. Enforced boundaries are. |
| **A microservices problem or a monolith problem** | Distributed mud exists. If services share tables, models, or release trains, you have the same ball of mud with network calls. |
| **A temporary phase** | Controlled chaos is normal early, while the domain is unknown. The problem is when the chaos is never consolidated. Foote and Yoder: "it's okay if the system looks at first like a BIG BALL OF MUD, at least until you know better." |

The last row matters: **mud is not a moral failure.** It is what happens when time, cost, turnover, and change beat structure. The paper is explicitly sympathetic to the people in the swamp. The question is not "who is to blame?" It is "is there a boundary left to defend, and who owns it?"

## The forces that produce it

Foote and Yoder name the forces that make mud rational:

- **Time** — architecture is a long-term investment; the deadline is now.
- **Cost** — good architecture is expensive, and the return arrives later.
- **Experience** — the domain is often not understood until after the first version.
- **Skill and turnover** — institutional memory leaves with people.
- **Visibility** — only the people who build the system see its inside; the outside sees a working product.
- **Complexity** — the software reflects the domain, and the domain is messy.
- **Change** — architecture is a hypothesis about which changes will be confined; the world mocks the hypothesis.
- **Scale** — "good ideas don't always scale."
- **Organization** — per Conway's law, the system reflects the communication structure that built it.

Two accelerants are worth adding for a layered codebase:

- **A layout that hides the capability boundary** (next section).
- **No fitness function** — nothing fails when a forbidden dependency is introduced.

## Why layer-first layout makes it more likely

When every controller lives in `controllers/`, every service in `services/`, and every model in `models/`, the top-level view tells you **what kind of code a file is**, not **what capability it serves**.

That has three consequences:

1. **The capability is invisible.** To understand one feature, you open five folders and reconstruct the story yourself. There is no place that says "this is Orders."
2. **The boundary has no home.** There is no folder to make private, no `index.ts` to act as a contract, and no obvious place to put an architecture test. The rule "Orders must not import Payments" has nowhere to live.
3. **Shared code grows in the gaps.** A `models/` folder becomes the place where every capability's entities meet. A `utils/` folder becomes a dumping ground. The shared model is the first sign that the capability boundary was never real.

Extraction is where the bill arrives. Pulling one capability out means:

- finding its pieces across every folder;
- untangling the shared models it uses;
- separating the tables it writes from the tables other capabilities write;
- finding the transactions that span it and deciding what happens to atomicity;
- keeping the old path working while the new one is built.

The file hunt is the visible cost. **The hidden coupling is the real one.** The layer layout is a map, not a boundary. A `controllers/` folder with `controllers/orders/` and `controllers/payments/` and enforced imports is not mud. A `modules/` folder where everything imports everything is mud. **The boundary is the rule, not the folder.**

## How to recognize it

Ask these against the actual dependency graph, not the diagram:

- [ ] Can I name the modules as business capabilities, without naming a technical layer?
- [ ] Can I change one capability without touching another?
- [ ] Can I delete a feature and know exactly what to delete?
- [ ] Does any shared `models/` or `utils/` get imported by most of the system?
- [ ] Are there dependency cycles between capabilities?
- [ ] Do unrelated features share tables or migrations?
- [ ] Do unrelated features ship in the same release train because of a shared transaction?
- [ ] Does onboarding require a guide to the mud rather than a map?
- [ ] Is there any CI rule that fails when a forbidden import appears?

A "yes" to the first three and "no" to the last is a healthy structure. A "no" to the first three and a "yes" to the rest is a mud, regardless of how the folders are named.

The social symptom is worth naming too: when only a few people can navigate the system, they become indispensable, and the organization starts to reward swamp navigation over architecture. Foote and Yoder observed exactly this: "swamp guides become more valuable than architects."

## Getting out

The paper offers three options: keep it healthy, reconstruct it, or surrender. For a system with business value, reconstruction is usually the last resort, not the first.

1. **Don't rewrite first.** A rewrite from a mud reproduces the mud, because the forces that produced it are still in the room. Modularize first; extract later.
2. **Draw the capability map.** Name the modules as business capabilities. If you cannot, you have found the first missing decision.
3. **Give each boundary a home.** A module folder with a public `index.ts`, private internals, and owned data. Layers live *inside* it.
4. **Make the rule executable.** Architecture tests in CI — `dependency-cruiser`, ArchUnit, Nx module boundaries, Packwerk, Spring Modulith. A boundary that is only in a document is a wish.
5. **Stop cross-boundary data access.** One writer per table, schema per module, contracts or read models for the rest.
6. **Use the strangler fig.** Move one capability at a time behind a seam; keep the old path alive until the new one is proven.
7. **Alternate expansion and consolidation.** Foote and Yoder's "keep it working" is not an excuse to skip consolidation; it is a reason to schedule it.

The mud is stable because it is locally cheap. Getting out requires paying a cost that is globally rational and locally unrewarded, which is why it needs an owner and a budget, not just a diagram.

## Trade-off row

| Anti-pattern | What it seems to optimize | Costs | Use when | Avoid when | Failure mode |
| --- | --- | --- | --- | --- | --- |
| **Big ball of mud** | Short-term speed; local freedom; no coordination cost | Hidden coupling; change amplification; extraction cost; onboarding drag; no safe deletion | Never deliberately; it emerges under deadline, turnover, and drift | Any system expected to live longer than the patch that created it | Everything talks to everything; shared models and tables; no boundary survives; rewrite or strangler only |

This row is also collected in the [consolidated trade-off matrix](tradeoffs.md#anti-patterns).

## Decision checklist

- [ ] Can I name the capabilities, not the layers?
- [ ] Does each capability own its data and its public contract?
- [ ] Is the boundary enforced by CI, or only by convention?
- [ ] Is shared code a small stable kernel, or a dumping ground?
- [ ] Can I extract one capability without a coordinated release?
- [ ] Do I know which transaction spans capabilities, and why?
- [ ] Is there a consolidation budget, or only a feature budget?
- [ ] Would a new engineer find the map, or need a guide?

If the last answer is "a guide," the mud is already shaping the org.

## Sources

- Foote & Yoder, [*Big Ball of Mud*](http://www.laputan.org/mud/) (PLoP '97, 1997) — the definition, the forces, and the patterns: Throwaway Code, Piecemeal Growth, Keep It Working, Shearing Layers, Sweeping It Under the Rug, Reconstruction.
- Parnas, [*On the Criteria To Be Used in Decomposing Systems into Modules*](https://www.cs.colostate.edu/~france/CS314/Readings/Parnas-decomposition.pdf) (1972), for information hiding and change-based decomposition.
- Evans, [*Domain-Driven Design*](https://www.domainlanguage.com/ddd/) (2003), for bounded contexts and model boundaries.
- Fowler, [*Monolith First*](https://martinfowler.com/bliki/MonolithFirst.html) (2015), for why extraction from a mud is the expensive path.
- Skelton & Pais, [*Team Topologies*](https://teamtopologies.com/key-concepts) (2019), for Conway's law and stream-aligned ownership.
- [dependency-cruiser](https://github.com/sverweij/dependency-cruiser), [ArchUnit](https://www.archunit.org/), [Nx module boundaries](https://nx.dev/features/enforce-module-boundaries), and [Packwerk](https://github.com/Shopify/packwerk) — ways to make a boundary executable.

## Next

- [02 — Layered architecture](02-layered-architecture.md) — the layout that hides the capability boundary, and what it costs.
- [01a — Modular monolith](01a-modular-monolith.md) — the shape that gives the boundary a home.
- [Trade-offs](tradeoffs.md#anti-patterns) — the consolidated matrix, including this anti-pattern.
