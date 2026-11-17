# 0001 — Keep a working notes and decision log

- **Date:** 2026-11-02
- **Status:** accepted
- **Owner:** Labeeb
- **Supersedes:** —
- **Superseded by:** —

## Context

Gild will involve product, architecture, data, and operational decisions that will be revisited. Chat history is useful in the moment, but it is not a durable project record. Without a written trail, the same questions get re-litigated and the reasoning behind a choice disappears.

We need a lightweight place to capture:

- what we learned;
- what we decided;
- why we chose it;
- what would make us revisit it.

## Decision

Keep a project-local workspace under `projects/gild/` with three parts:

- `notes/` for dated observations, research, and open questions;
- `decisions/` for numbered, ADR-style decision records;
- `reviews/` for review requests and outcomes.

Consequential decisions get a decision record and a row in the decision log. Notes remain the place for unfinished thinking.

## Why

- The “why” outlives the code and the chat transcript.
- A review can point at specific files instead of relying on memory.
- Revisit triggers make provisional decisions explicit.
- The format is lightweight enough to maintain during active work.
- It separates exploration from commitment: not every note is a decision.

## Alternatives considered

| Option | What it buys | What it costs | Why not chosen |
| --- | --- | --- | --- |
| Keep everything in chat | Zero setup | Lost context; hard to review; decisions are implicit | Does not survive the conversation |
| Use only an issue tracker | Good for execution | Poor at preserving rationale and alternatives | The tracker is for tasks, not the thinking trail |
| Write a full specification up front | Polished artifact | Slow; hides uncertainty; becomes stale | Too much ceremony for an evolving project |
| Notes plus numbered decision records | Durable trail with low overhead | Requires discipline to write at decision time | Chosen |

## Consequences

- **Easier:** reviewing decisions, onboarding another person, noticing contradictions, avoiding repeated debates.
- **Harder:** writing the record at the moment of decision instead of after the fact.
- **New risk:** the decision log becomes ceremonial or stale.
- **Operational cost:** low; plain Markdown files in the repository.
- **What we are not doing:** this is not a task tracker, a full specification, or a substitute for code comments.

## Revisit when

- More than one person needs to contribute regularly.
- The workspace starts duplicating the issue tracker.
- The code moves to another repository and the links stop being useful.
- Decision records are being written after the fact without the real alternatives.

## Links

- Workspace: [`../README.md`](../README.md)
- Decision template: [`_template.md`](_template.md)
- Review protocol: [`../reviews/README.md`](../reviews/README.md)
