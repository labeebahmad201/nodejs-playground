# Gild — Working Notes

This is the thinking trail for Gild: product notes, architecture notes, decisions, and the reasons behind them.

It is deliberately separate from the application code. The code can live beside this folder or in another repository; this folder answers **what we are building, why we chose it, and what we would revisit**.

## Layout

```text
gild/
├── README.md          ← this file: purpose, conventions, review protocol
├── notes/             ← research, observations, open questions, meeting notes
│   ├── README.md
│   └── _template.md
├── decisions/         ← one record per consequential decision
│   ├── README.md      ← decision log / index
│   └── _template.md
└── reviews/           ← AI or human review requests and outcomes
    ├── README.md
    └── _template.md
```

## How to use it

### Notes

Capture notes while the context is fresh. Use `notes/YYYY-MM-DD-topic.md`.

A note is for:

- what you learned;
- what you observed;
- options you are considering;
- questions you cannot answer yet;
- links to screenshots, spikes, or external references.

A note is not a decision. If it changes the direction of the project, promote it to a decision record.

### Decisions

When a choice is consequential or hard to reverse, add `decisions/NNNN-short-title.md` and add a row to the decision log in `decisions/README.md`.

A good decision record answers:

- What was the context?
- What did we decide?
- Why this option instead of the alternatives?
- What does it make easier or harder?
- When should we revisit it?

### Reviews

When you want a review, ask for it explicitly and point at the relevant files. A useful request looks like:

> Review `decisions/0003-use-postgres-for-trips.md` and `notes/2026-11-03-dispatch.md`. I am trying to decide whether to keep dispatch state in Postgres or move it to Redis. Focus on failure modes, operational cost, and what would make the decision reversible.

The review protocol is in `reviews/README.md`.

## What belongs here

- Product scope and non-goals.
- Domain language and bounded-context candidates.
- Architecture options and trade-offs.
- Data ownership and consistency decisions.
- Failure modes and operational assumptions.
- Build-versus-buy decisions.
- Security, privacy, and compliance assumptions.
- Questions that are still unresolved.

## What does not belong here

- A full task tracker. Use the issue tracker for execution.
- A duplicate of the code. Link to code instead.
- A polished specification that hides the uncertainty.
- Decisions without a reason. “Because it is popular” is not a reason.
- A decision log that is only updated after the fact. Write the record when the decision is made, even if it is provisional.

## Decision log

- Decision log
- Decision template

## Review history

- Reviews

## Current status

The workspace starts with:

1. A kickoff note for product scope and non-goals.
2. Decision 0001, which records why this workspace exists.
3. A review protocol in `reviews/README.md`.

The next useful entries are the first real product constraints, the first architectural boundary, and the assumptions that would change the design if they are wrong.