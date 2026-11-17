# Decision Log

One record per consequential decision. The record explains **why**, not just what.

## How to add a decision

1. Copy [`_template.md`](_template.md) to `NNNN-short-title.md`.
2. Use the next number in sequence: `0001`, `0002`, ...
3. Fill in the context, decision, alternatives, consequences, and revisit trigger.
4. Add a row to the table below.
5. If a decision replaces an older one, mark the older record `superseded by NNNN` and link both ways.

## Status values

- **proposed** — written down, not agreed yet.
- **accepted** — current direction.
- **rejected** — considered and rejected.
- **superseded** — replaced by a later decision.
- **deprecated** — no longer relevant.

## Log

| # | Date | Decision | Status | Why | Revisit when |
| --- | --- | --- | --- | --- | --- |
| [0001](0001-keep-a-working-notes-and-decision-log.md) | 2026-11-02 | Keep a working notes and decision log | accepted | The reasoning behind decisions should survive chat history | Multi-person contribution, or the log starts duplicating the issue tracker |
| [0002](0002-recommendation-engine-precompute-vs-on-demand.md) | 2026-11-05 | Recommendation engine: hybrid, per job, not per buyer | accepted | A buyer × professional matrix grows quadratically and most of it is never read | Candidate cost approaches the full matrix, or stale pools cause visible failures |

## Good decision triggers

Write a record when the choice:

- affects more than one module or team;
- is expensive to reverse;
- changes data ownership or consistency;
- changes a public contract;
- introduces a new runtime, database, broker, or vendor;
- depends on an assumption that might stop being true.

## Review questions

When reviewing a decision, ask:

- Is the context still true?
- Is the decision stated clearly enough to act on?
- Are the alternatives real alternatives, or straw men?
- Does the “why” reference evidence rather than preference?
- What would make us reverse it?
- Is the revisit trigger concrete?
