# Reviews

Review requests and review outcomes for Gild.

The purpose of a review is not to produce a verdict. It is to expose assumptions, contradictions, missing evidence, and decisions that are being made implicitly.

## How to ask for a review

Point at the files that matter and state the decision at stake.

```text
Review these files:
- README.md
- decisions/0003-use-postgres-for-trips.md
- notes/2026-11-04-dispatch-model.md

I am deciding whether dispatch state should stay in Postgres or move to Redis.
Focus on failure modes, operational cost, and reversibility.
Do not rewrite the decision; tell me what evidence is missing.
```

## What a review should read

1. `README.md` for the project scope and non-goals.
2. `decisions/README.md` for the current decision trail.
3. The specific decision records and notes named in the request.
4. Anything the decision links to.

## Review output format

- **What is strong** — the parts that are grounded in evidence.
- **Contradictions** — places where notes, decisions, and scope disagree.
- **Implicit decisions** — choices that were made without being recorded.
- **Missing evidence** — what would make the decision stronger.
- **Risks** — failure modes, operational costs, and irreversible parts.
- **Questions** — the smallest set of questions that would unblock the next step.
- **Suggested next decision** — what should be written down next, if anything.

## Review history

Name review outputs `YYYY-MM-DD-topic.md`, for example:

- `2026-11-05-dispatch-review.md`
- `2026-11-12-payments-review.md`

Keep the review even if the decision changes. It is part of the trail.

Use the [review template](_template.md) if it helps.
