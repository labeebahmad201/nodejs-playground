# Event Storming Notes

Short notes on Event Storming practice.

The full guide — Big Picture, Process Modeling, Software Design, notation, and the local canvas — lives in `architecture/04-microservices/event-storming/`.

This folder is for the smaller insights that come up while applying the method: a correction, a decision rule, a pattern, or a worked example.

## Notes

- [Read models without domain events](read-models-without-domain-events.md) — some information needs have no event behind them. Capture them, do not invent events, and assign API ownership to the context that owns the data.

## What belongs here

- One insight per note.
- A concrete example.
- A rule, checklist, or decision guide.
- Links to the deeper guide or the DDD notes.

## What does not belong here

- A full Event Storming tutorial. That is the guide's job.
- A project-specific decision log. That belongs in `projects/`.
- A meeting transcript with no conclusion.

## Naming

Name the note after the insight, not the date:

- `read-models-without-domain-events.md`
- `events-are-not-commands.md`
- `where-does-the-read-model-live.md`

A date in the filename is for a project note, not a reusable practice note.
