# Conway's Law

*Any system designed by an organization ends up shaped like that organization's communication
structure. The seams between modules land where people actually talk to each other — so if you
want a different architecture, change who talks to whom.*

## The law

Melvin E. Conway, *How Do Committees Invent?* (1968):

> The basic thesis of this article is that organizations which design systems (in the broad
> sense used here) are constrained to produce designs which are copies of the communication
> structures of these organizations.

Designing a system means splitting it into parts and agreeing on their interfaces. Agreement
needs communication, and communication only flows along the paths the organization provides.
So module boundaries land where team boundaries are — not where the ideal architecture would
put them.

## Why it happens

Not politics, not incompetence — coordination economics. Every interface between modules costs
conversation, and conversation is cheapest within a team. So boundaries get drawn where
communication is cheapest, and interfaces only get specified where it's unavoidable.

## What it looks like

```text
org chart                     what ships
Platform team               → gateway/
Payments team               → payments/ service
Web team                    → web/ app
Mobile team                 → mobile/ app
```

Nobody decided "four services" — the handoff points drew the seams. A system's boundaries are
usually an accurate map of its organization's real communication paths.

## Nuance

- It mirrors **communication**, not the official org chart — contractors, de-facto ownership,
  and informal channels are what actually ships.
- The first design is the clearest copy. Later redesigns inherit old shapes until the org
  changes — "rewrite it, get the same system."
- You can't escape the law, only aim it. Pick the system boundaries you want first, then draw
  team boundaries to match (Team Topologies). Doing this deliberately is the **Inverse Conway
  Maneuver** (LeRoy & Simons, 2010).
- This is the same force behind the actor framing in
  [the SRP note](../32-solid/01-srp) — at system scale it draws service boundaries; at class
  scale it draws the boundary between responsibilities. When roles change, the architecture
  has to follow.
- Role changes aren't equal: a role merge leaves over-separated code (fine); a role split
  creates a two-actor module — a new SRP violation with no code change.

## One-line summary

**A system's structure mirrors the communication structure of the organization that built it
— interfaces land where conversations happen — so aim the law deliberately: shape teams to
get the architecture you want.**

## References

- Melvin E. Conway — *How Do Committees Invent?* (Datamation, 1968) —
  <https://www.melconway.com/Home/Committees_Paper.html>
- Wikipedia — *Conway's Law* — <https://en.wikipedia.org/wiki/Conway%27s_law>
- Martin Fowler — *Conway's Law* (bliki; source of the Inverse Conway Maneuver attribution) —
  <https://martinfowler.com/bliki/ConwaysLaw.html>
- Jonny LeRoy & Matt Simons — article coining "Inverse Conway Maneuver" (Cutter IT Journal,
  December 2010)
- Matthew Skelton & Manuel Pais — *Team Topologies* (2019)
