# 0002 — Recommendation engine: hybrid, per job, not per buyer

- **Date:** 2026-11-05
- **Status:** accepted
- **Owner:** —
- **Supersedes:** —
- **Superseded by:** —

## Context

Buyers are shown a list of recommended professionals. Something has to decide **which professionals and in what order**.

The tempting default is to precompute a ranked list for every buyer over every professional and keep it fresh, so the request path is a single lookup. That is the approach most teams reach for first, and it is the one we considered and rejected.

The force behind the decision: recommendations are only meaningful relative to a **job** ("who fits this job?"), not to a buyer in the abstract. The same buyer hiring a designer and a backend engineer should get different lists. So the unit of work is the job, not the buyer.

## Decision

Two phases with different cost profiles:

1. **Candidate generation — background, asynchronous.**
   For each **job**, build a small pool (~200–500) of plausible professionals using hard filters: skill overlap, availability, rate range, location/timezone, not banned, not on an active contract.
2. **Ranking — at request time, cheap.**
   Re-rank that pool with fresh signals: rating, completion rate, response time, price fit, recency, plus a small exploration budget. Return the top N.

The cache key is **`(buyer, job)`**. If the buyer is browsing without a job, fall back to a "for you" pool built from their declared preferences and history.

## Why

- **The full matrix is quadratic.** 1M buyers × 100k professionals = 10¹¹ pairs. Even top-500 per buyer is 500M rows (~50 GB of derived data), and one professional profile edit invalidates a million entries.
- **Almost all of it is wasted.** A buyer looks at a handful of jobs and a few dozen profiles. Precomputing the rest is storage and compute spent on lists nobody will ever open.
- **Per-job is one to two orders of magnitude smaller** in practice: open jobs × candidates, not buyers × professionals.
- **Freshness at the right layer.** Candidate pools can lag by minutes; ranking is recomputed on every request from a small pool, so the visible order reflects current rating, price, and availability.
- **On-demand-only is not enough.** Scoring 100k professionals per page view is slow, expensive, and non-deterministic, and it gets worse exactly when traffic grows.

## Alternatives considered

| Option | What it buys | What it costs | Why not chosen |
| --- | --- | --- | --- |
| A. Precompute every buyer × professional | Trivial reads | Quadratic growth; 10¹¹ pairs; ~50 GB even for top-500; every profile edit invalidates a million rows | Cost grows with the product of both sides, and most precomputed lists are never read |
| B. Compute on demand for every request | Always fresh; no storage | Scores 100k professionals per page view; slow, expensive, non-deterministic; gets worse with success | Request path pays for the whole search |
| C. Hybrid: precompute candidate pools per job, re-rank on request | Bounded storage, cheap reads, fresh ordering | Results can be minutes stale; needs incremental invalidation | Chosen — the right trade-off at this stage |

## Consequences

- **Easier:** bounded storage and compute; ranking can change without a full rebuild; the same pool can serve multiple sort orders.
- **Harder:** incremental invalidation on profile, review, and availability changes; keeping the pool fresh for newly posted jobs.
- **New risk:** stale pools show professionals who just became unavailable. Mitigate by re-checking hard constraints at request time.
- **Operational cost:** a background worker and a small read store, plus a nightly full rebuild.
- **What we are not doing:** a full buyer × professional ranking matrix; synchronous recomputation on page view; a single global "top professionals" list.

## Revisit when

- open jobs × candidates starts to approach the cost of the full matrix;
- ranking latency on the request path exceeds the budget;
- product needs a single global ranking or cross-job personalization;
- stale pools cause a visible failure (e.g. recommending unavailable professionals).

## What this is in Event Storming terms

- The recommendation engine is a **policy + read model**, not a domain aggregate.
- `RecommendationsGenerated` / `RecommendationListRefreshed` are internal technical steps — **not** domain events, and they do not belong in the business timeline.
- The green box on the board is the read model: "Recommended professionals for a job". The purple boxes are the policies that react to business events.

## What feeds it

**Explicit (declared)** — cold start and candidate generation:

- `BuyerInterestsSelected`
- `BuyerBudgetRangeSet`
- `BuyerProjectTypeSelected`
- `BuyerPreferencesUpdated`

**Implicit (behavioural)** — ranking once there is history:

- `ProfessionalSaved` / `ProfessionalUnsaved`
- `SearchPerformed`, profile views
- `BidPosted`, `ProposalViewed`, `Hired`
- `ReviewSubmitted`, `ContractCompleted`

## Triggers

| Trigger | Action |
| --- | --- |
| `ProfessionalProfileUpdated`, `SkillsChanged`, `AvailabilityChanged` | refresh that professional's features (incremental) |
| `ReviewSubmitted`, `ContractCompleted` | update reputation features |
| `JobPosted`, `JobEdited` | generate the candidate pool for that job |
| `BuyerInterestsSelected`, `BuyerPreferencesUpdated` | recompute the buyer's context |
| `ProfessionalSaved` / `Unsaved` | adjust ranking weights |
| Nightly | full rebuild of features and pools |
| Request | re-rank the cached pool, return top N |

## Open questions

- Do we rank per job, or per buyer with an optional job context? (Currently: per job, with a "for you" fallback.)
- How much behavioural history before implicit signals outweigh declared preferences?
- Where does the exploration budget live — ranking, candidate generation, or a separate promotion slot?
- Do we expose "why this was recommended"? It affects trust and the features we must store.

## Links

- Related notes: `../notes/2026-11-02-kickoff.md`
- Related decisions: `0001-keep-a-working-notes-and-decision-log.md`
- Big-picture map review: `../../../architecture/04-microservices/event-storming/gild-big-picture-review.md`
