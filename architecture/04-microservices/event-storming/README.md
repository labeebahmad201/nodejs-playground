# Event Storming: From Big Picture to Aggregates and Code

*Event Storming is a workshop format for exploring a complex business domain before deciding how to build it. It produces a timeline of domain events, the commands and policies around them, and a short list of boundaries and open questions. The board is a thinking tool; the decisions are the output.*

This folder contains four things:

- this guide;
- the long-form article in [article/event-storming-the-complete-guide.md](article/event-storming-the-complete-guide.md), with diagrams;
- a [local canvas](#run-the-canvas) for building a board in the browser;
- a runnable aggregate example in [`order-aggregate.ts`](order-aggregate.ts).

The guide is deliberately practical. It answers three questions:

1. What are the levels of Event Storming, and when do I use each one?
2. How do I run a session, especially as a solo developer?
3. How do I turn the board into aggregates and code?

The short version:

```text
Big Picture      → discover the process and the language
Process Modeling → discover the rules and exceptions
Software Design  → discover the aggregates and boundaries
```

Do not skip straight to aggregates. The most common failure is designing a beautiful aggregate around a process nobody actually agreed on.

## Why Event Storming exists

Most software decomposition starts with technical categories: controllers, services, repositories, frameworks. That feels productive because those categories are familiar. But two controllers are not cohesive just because they are both controllers. Two services are not a boundary just because they both use a database. A `String` in one context has nothing to do with a `String` in another context.

The hard part of a complex domain is not typing the code. It is agreeing on:

- what actually happens;
- who decides;
- which rules are real;
- which words mean different things in different parts of the business;
- where one process ends and another begins.

Event Storming starts from the business facts and the language people use. It deliberately postpones technical choices until the domain has shown you a boundary. That is the point: you are problem-focused before you are solution-focused. Alberto Brandolini created the format; the practical summary from Qlerify describes it as a way to collaboratively explore a complex business domain rather than jump to a data model ([Brandolini, *Introducing Event Storming*](https://ziobrando.blogspot.com/2013/11/introducing-event-storming.html); [Qlerify, *Event Storming – The Complete Guide*](https://www.qlerify.com/post/event-storming-the-complete-guide)).

It is not anti-technical. It is a way to make the technical choices later, with better evidence.

## The one rule: events are facts

The building block is the **domain event**: something that happened and matters to the business.

A good domain event is:

- **in the past tense** — `Order placed`, not `Place order`;
- **in business language** — `Payment captured`, not `PaymentService.charge() returned 200`;
- **a fact** — it already happened; it cannot be rejected;
- **relevant** — someone in the business cares that it happened.

| Good domain event | Why |
| --- | --- |
| `Order placed` | A business fact with a clear meaning. |
| `Payment captured` | The money moved; the business cares. |
| `Proposal accepted` | A decision changed the state of the relationship. |
| `Milestone approved` | Work was accepted and payment can be released. |

| Not a domain event | What it actually is |
| --- | --- |
| `Customer clicked Pay` | A UI interaction. |
| `orders row updated` | A persistence detail. |
| `Payment service called` | A technical step. |
| `Email sent` | Sometimes a domain event — only if the business cares about the email itself. |
| `Kafka message consumed` | Infrastructure. |

The timeline is the backbone. If you cannot put two events in order, that is not a failure; it is a **hotspot** — a question for the business. The disagreement is often more valuable than a fake consensus.

## The three levels

Event Storming is not one workshop. It is a family of workshops at different zoom levels. The Qlerify guide summarizes the three most common variations; Brandolini's original work describes the same progression from broad discovery to software design ([Qlerify](https://www.qlerify.com/post/event-storming-the-complete-guide); [Brandolini](https://www.eventstorming.com/)).

| Level | Question | Scope | Typical group | Notation added | Output |
| --- | --- | --- | --- | --- | --- |
| **Big Picture** | What happens in this business, and where does it hurt? | The whole domain or value stream | 5–20 people, mixed business and IT | Events, people, systems, hotspots, opportunities | A shared timeline, top problems, candidate contexts |
| **Process Modeling** | How does this one process work, including its exceptions? | One end-to-end process | 4–8 people | Commands, policies, read models | A happy path, alternative paths, explicit rules |
| **Software Design** | What are the aggregates and boundaries we will build? | One bounded context | 3–6 people | Aggregates, bounded contexts, optional UI sketches | Aggregate boundaries and command/event APIs |

A note on the name: “Big Picture process modeling” is not a fourth level. **Big Picture** is the broad map of the business; **Process Modeling** is the detailed model of one process inside it. If you are unsure which one you need, ask whether you are still discovering *where the process is* or already designing *how one process works*.

The progression is a zoom, not a checklist:

```text
Big Picture discovers contexts.
Process Modeling discovers rules.
Software Design discovers aggregates.
```

### The steps at a glance

**Big Picture**

1. Frame the scope and the decision the session should unblock.
2. Write domain events in parallel, with no order.
3. Put them on one left-to-right timeline.
4. Add people, systems, hotspots, and opportunities.
5. Walk through the timeline, reverse-check it, and vote on the top problems.

**Process Modeling**

1. Pick one process with a clear start and end.
2. Map the happy path first.
3. Add the commands, policies, and read models.
4. Add the important exceptions and failure paths.
5. Keep the unresolved questions as hotspots.

**Software Design**

1. Pick one bounded context, not the whole business.
2. Replace the systems you own with aggregates.
3. Group each aggregate’s commands and events.
4. Write the invariants and the state machine.
5. Decide which cross-aggregate rules are policies or process managers.
6. Map each aggregate to code and record the boundary decision.

You can stop at any level. A Big Picture session that produces a shared map and a top-three problem list has done its job. You do not need to turn every board into code.

### A notation cheat sheet

Colors are a memory aid, not the model. The local canvas uses these types:

| Note | Meaning | Mainly used in |
| --- | --- | --- |
| **Domain event** | A business fact in the past tense. | All levels |
| **Command** | An intent to change state; it can be rejected. | Process Modeling, Software Design |
| **Policy** | A reaction: “Whenever X happens, then do Y.” | Process Modeling, Software Design |
| **Read model** | The information a person or system needs to make a decision. | Process Modeling, Software Design |
| **Person** | A role that makes a decision or performs an action. | Big Picture, Process Modeling |
| **External system** | A black box outside your boundary. | Big Picture, Process Modeling |
| **Aggregate** | A consistency boundary that accepts commands and emits events. | Software Design |
| **Bounded context** | A boundary where one language and model apply. | Software Design |
| **Hotspot** | A question, conflict, unknown, or disagreement. | All levels |
| **Opportunity** | An idea that could improve the process. | Big Picture |

Some teams also use UI sketches in Software Design. They are optional; the core model is events, commands, policies, and aggregates.

## Level 1: Big Picture

**Use it when** the scope is large or unclear, or when different departments need a shared view. It is the right starting point for a new product, a kickoff, a migration, or a domain you do not yet understand.

**Do not use it when** you already have one narrow process with a clear start and end. Go to Process Modeling instead.

### Before the session

1. **Frame the question.** Are we mapping the current state or designing a future state? What decision should this session unblock? What is out of scope?
2. **Invite the people who disagree.** A room full of engineers will produce an engineering model. You need people who do the work, make the decisions, and handle the exceptions. Five to ten people is a good default; up to twenty is possible.
3. **Prepare the wall.** You need a long horizontal space, sticky notes, and markers. A digital board works for a solo session or a distributed team, but the physical wall is still the best way to keep a group in the same conversation.
4. **Write the legend.** Show the notation before people start. Keep the explanation short; introduce concepts when they become relevant.

### The workshop

1. **Chaotic exploration.** Ask everyone to write domain events only, in parallel, for 20–30 minutes. No order. No commands. No aggregates. Quantity beats polish. If someone hesitates, ask: “What happens in your work?” “Do you receive payments?” “Are contracts signed?”
2. **Enforce the timeline.** Put every event on one left-to-right timeline. Expect disagreement. Choose the most likely order, not a perfect one. Use **pivotal events** as anchors, **swimlanes** for parallel roles or departments, and a **reverse narrative** (“for this to be paid, what must have happened before?”) to find missing events.
3. **Add people and systems.** Who acts? Which systems are involved? Mark external systems as black boxes. This is where you discover that a “simple” process crosses five departments and two vendors.
4. **Mark hotspots and opportunities.** A red hotspot is a problem, conflict, or unknown. A green opportunity is an idea. Do not solve them in the room. Capture them and move on.
5. **Walk through the board.** Ask participants to narrate the timeline in turns, 5–10 minutes each. The group challenges gaps and contradictions. This is where most of the learning happens.
6. **Vote on the top problems.** Give each participant two or three votes. The goal is not to model everything; it is to agree on what to fix or explore next.

### After the session

- Photograph or export the board.
- Type up the events and hotspots while the context is fresh.
- List the candidate bounded contexts; do not turn them into services yet.
- Write the top questions as notes or ADRs.
- Decide whether the next session is Process Modeling or Software Design.

### Solo version

You can run Big Picture alone. Use two hats: the domain expert and the engineer. Set a timer, write 30–50 events without editing, then sort them. The local canvas is enough:

```sh
node architecture/04-microservices/event-storming/server.ts
```

Open <http://127.0.0.1:4310>, start with domain events, and use the AI prompt button to ask for missing events, ambiguous terms, and candidate contexts.

## Level 2: Process Modeling

**Use it when** you have one process with a clear start and end, and you need to understand the rules, decisions, and exceptions. This is the level that turns a timeline into something you can design.

Pick a process such as:

- “From order placed to order confirmed.”
- “From job posted to the first milestone paid.”
- “From invoice received to payment scheduled.”

### Happy path first

Start with the most common successful path. Do not start with every edge case. The happy path gives you the spine; exceptions are branches from it.

Then add the most important alternatives:

- the request is rejected;
- the customer changes their mind;
- an external system times out;
- a payment fails;
- a human overrides the rule;
- the process is cancelled halfway through.

You do not need every edge case. A handful of important alternatives is usually enough to expose the real design.

### The grammar

Process Modeling has a precise, repeatable grammar:

```text
Event → Policy → Command → System → Event
```

If a human makes the decision, insert the person and the read model:

```text
Event → Policy → Person → Read Model → Command → System → Event
```

This is not bureaucracy. It forces you to name:

- **who** reacts;
- **what** they need to see;
- **what** they decide;
- **what** changes as a result.

### The vocabulary

| Element | What it is | What it is not |
| --- | --- | --- |
| **Command** | An intent to change state, in the imperative: `Place order`, `Capture payment`. It can be rejected. | A fact. `Order placed` is an event. |
| **Policy** | A reaction or rule: “Whenever `Order placed`, then `Reserve inventory`.” | A command. It explains *why* the command happens. |
| **Read model** | The information needed to make a decision: price, stock, contract status, payment history. | Necessarily a database table. It can be a screen, a query, or a report. |
| **System** | A black box that receives a command and produces an event. | Necessarily something you build. External systems stay black boxes. |
| **Hotspot** | A question, conflict, or unknown. | A failure of the workshop. It is often the most useful output. |

### A worked order flow

Start with the events:

```text
Order placed → Payment captured → Inventory reserved → Order confirmed → Notification queued
```

Add the commands and policies:

```text
Place order
  → Order
  → Order placed

Order placed
  → Policy: when order placed, reserve inventory
  → Reserve inventory
  → Inventory
  → Inventory reserved

Payment captured + Inventory reserved
  → Policy: when payment captured and inventory reserved, confirm order
  → Confirm order
  → Order
  → Order confirmed

Order confirmed
  → Policy: when order confirmed, send notification
  → Send notification
  → Notifications
  → Notification queued
```

Now add the hotspot that the happy path hides:

```text
Capture payment
  → Payment provider
  → Payment captured
  → ... but the response is lost.

Hotspot: did the charge happen?
Policy: when payment is unknown, reconcile with the provider.
Event: Payment unknown.
```

This is the connection to the [microservices note](../README.md#partial-failure-the-ambiguous-outcome). The Event Storming board exposes the ambiguous outcome before you choose a retry policy, an idempotency key, or a reconciliation job.

### What the grammar exposes

| If you get stuck… | Ask… |
| --- | --- |
| You cannot name the event | “What would a domain expert say happened?” |
| You cannot name the command | “Who or what decided to make that happen?” |
| You cannot name the policy | “What happens automatically next?” |
| You cannot name the read model | “What does the person need to see before deciding?” |
| You cannot name the system or aggregate | “What state must be loaded to say yes or no?” |
| One command has two owners | You have found a boundary problem, not a naming problem. |

A vague command such as `Check order` is usually a sign that you are missing a read model or hiding a state change. If it is only reading, model the read model. If it changes state, rename it: `Mark order as checked`.

## Level 3: Software Design

**Use it when** you have chosen one bounded context and you need to decide what the code will look like inside it. This is not the whole business. It is one context, one language, one model.

The key move is simple:

> Replace the systems you own with **aggregates**. Keep the systems you do not own as external systems.

In a Process Modeling board, a pink `Payment provider` system is a black box. If you are building the payment capability yourself, that pink note becomes a yellow `Payment` aggregate. If Stripe owns it, it stays pink.

### What an aggregate is

An **aggregate** is a cluster of entities and value objects treated as one unit for consistency, accessed only through its **aggregate root**. The root is the gatekeeper: it enforces the invariants that must always hold, and it is the unit you load, save, and reference from the outside ([Evans, *Domain-Driven Design*](https://www.informit.com/store/domain-driven-design-tackling-complexity-in-the-heart-of-9780321125217); [Fowler, *DDD_Aggregate*](https://martinfowler.com/bliki/DDD_Aggregate.html)).

The practical rules:

- **One root per aggregate.** Outsiders hold only the root’s ID.
- **The root enforces invariants.** Rules that must be true at all times live inside the boundary.
- **One aggregate per transaction.** Load the aggregate, change it, save it as one unit.
- **Reference other aggregates by ID.** `Order.customerId`, not `Order.customer`.
- **Keep aggregates small.** A large aggregate means more contention, more loading, and more reasons to change.
- **Cross-aggregate consistency is a policy or process manager.** If two aggregates must change atomically, the boundary is probably wrong, or the workflow needs a saga.

Vaughn Vernon’s *Effective Aggregate Design* is the long version of the same advice: find the smallest consistency boundary that protects the invariant, and do not turn the whole model into one giant aggregate ([Vernon, *Effective Aggregate Design*](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf)).

### Finding aggregates: five tests

Use the board, not your imagination. For each candidate aggregate, ask:

1. **State test.** What state must be loaded to accept or reject this command? That state belongs to the aggregate.
2. **Invariant test.** What must be true immediately after the command? That rule belongs to the root.
3. **Transaction test.** What must commit together? That is the aggregate boundary.
4. **Language test.** Can you name the aggregate without the word “and”? `Order` is a boundary; `OrderAndPayment` is two reasons to change.
5. **Lifecycle test.** Does the aggregate have a clear lifecycle — created, changed, closed — or is it just a table with a name?

If a command needs data from two aggregates to decide, you have three options:

- the rule belongs in one aggregate, and the other aggregate only supplies a fact;
- the rule is a policy that reacts to an event and issues a command;
- the boundary is wrong.

Do not solve it by making a mega-aggregate. That trades a distributed problem for a concurrency and coupling problem.

### Candidate aggregates in the order flow

| Candidate | Commands | Events | Invariant | Verdict |
| --- | --- | --- | --- | --- |
| **Order** | `PlaceOrder`, `ConfirmOrder`, `CancelOrder` | `OrderPlaced`, `OrderConfirmed`, `OrderCancelled` | Cannot confirm an empty order; cannot change a confirmed order. | Aggregate |
| **PaymentAttempt** | `CapturePayment`, `MarkPaymentUnknown`, `MarkPaymentFailed` | `PaymentCaptured`, `PaymentUnknown`, `PaymentFailed` | One logical charge per order; unknown is a real state. | Aggregate |
| **InventoryReservation** | `ReserveInventory`, `ReleaseInventory` | `InventoryReserved`, `InventoryReleased` | Cannot reserve more than available; release is idempotent. | Aggregate |
| **OrderSummary** | — | — | — | Read model, not an aggregate |
| **Notification** | `SendNotification` | `NotificationQueued`, `NotificationSent` | At-least-once delivery; duplicate sends are harmless. | Separate worker or context |

Why are `Order` and `PaymentAttempt` separate? The payment provider has its own failure and reconciliation lifecycle. The order only needs the result. Why is `InventoryReservation` separate? Stock contention is a different consistency boundary. Why is `OrderSummary` not an aggregate? It has no invariants and no commands; it is a query-shaped view.

The cross-aggregate rule “confirm when payment is captured and inventory is reserved” is a **policy** or **process manager**, not a method that reaches into three aggregates. The order aggregate can expose `confirm()`, but the policy decides when to call it.

### Bounded context vs aggregate vs service

These three words are often used as if they were interchangeable. They are not.

| Concept | Question it answers | Example |
| --- | --- | --- |
| **Bounded context** | Where does this word mean one thing? | `Payments` has its own meaning of “capture”, “refund”, and “settled”. |
| **Aggregate** | What must be consistent in one transaction? | `PaymentAttempt` protects the one-charge-per-order invariant. |
| **Service** | What has an independent release and failure boundary? | A `payments` service, if a force justifies the network and operational cost. |

A bounded context can be a module inside a modular monolith. A microservice is a deployment choice, not the definition of a context. The [microservices note](../README.md) makes the same point: a service boundary must earn its network and operational cost.

## From board to code

The board is not the code. It is the source of names, rules, and boundaries. The mapping is direct:

| Board note | Code artifact | Example |
| --- | --- | --- |
| **Domain event** | Immutable event type or record | `PaymentCaptured` |
| **Command** | Method, use-case input, or message | `capturePayment(paymentId)` |
| **Aggregate** | Class/module with state and invariants | `Order` |
| **Policy** | Event handler, process manager, or saga | `WhenPaymentCaptured → confirmOrder` |
| **Read model** | Query or projection | `OrderSummary` |
| **External system** | Port plus adapter | `PaymentProvider` |
| **Hotspot** | ADR or open question | “What if the response is lost?” |
| **Bounded context** | Module or service boundary | `payments/` |

### The steps

1. **Export the board.** Use Markdown or JSON. Keep the export next to the notes or decision record.
2. **Choose one bounded context.** Do not design the whole company in one pass.
3. **List each aggregate’s commands and events.** A table is enough.
4. **Draw the state machine.** What states can the aggregate be in? Which commands move it?
5. **Turn invariants into guards.** A guard is a check that throws or rejects the command.
6. **Write command methods that return events.** The aggregate decides; it does not publish.
7. **Keep persistence and messaging outside.** Load the aggregate, call the command, save the aggregate and an outbox row in one transaction, then publish.
8. **Write policies as event handlers.** A simple policy calls one command. A multi-step policy becomes a process manager or saga with durable state.
9. **Write read models as projections.** They answer a question; they do not enforce invariants.
10. **Record boundary decisions as ADRs.** A hotspot is not resolved by a comment in the code.

### Event Storming is not event sourcing

A domain event is a fact. It does not follow that you must store every event and rebuild state from an event log. You can:

- store the aggregate’s current state in a normal table;
- write an outbox row in the same transaction;
- publish the event;
- let consumers build read models.

Event sourcing is a separate persistence choice. It is useful when the history is the source of truth, but it is not required by Event Storming. The board gives you the events; the storage decision is yours. The [outbox pattern](../../01c-outbox-pattern.md) is the usual bridge between a state-stored aggregate and reliable event publication.

### The application service

The aggregate stays small. The application service coordinates:

```text
load aggregate
  → call command method
  → save aggregate + outbox row in one local transaction
  → publish the outbox row
```

The policy/process manager is another application service:

```text
consume event
  → load the aggregate that must react
  → call the command
  → save + outbox
```

If the policy spans several steps, it needs durable state, timeouts, retries, and compensation. That is a [saga](../README.md#saga), not a hidden `try/catch` in a controller.

## A small code example

The runnable example is in [`order-aggregate.ts`](order-aggregate.ts), with tests in [`order-aggregate.test.ts`](order-aggregate.test.ts).

The shape is:

```ts
const { order } = Order.place("1", 4_200);

order.capturePayment("pay_1");
order.recordInventoryReserved();
order.confirm();
```

The aggregate exposes commands and returns events. It does not know about HTTP, the database, the payment provider, or the message broker.

| Command | Guard | Event |
| --- | --- | --- |
| `PlaceOrder` | Total must be positive. | `OrderPlaced` |
| `CapturePayment` | Allowed from `pending_payment` or `payment_unknown`; not after a definite failure. | `PaymentCaptured` |
| `MarkPaymentFailed` | Not after a successful payment. | `PaymentFailed` |
| `MarkPaymentUnknown` | Only from `pending_payment`. | `PaymentUnknown` |
| `RecordInventoryReserved` | Idempotent; the second call returns no events. | `InventoryReserved` |
| `ConfirmOrder` | Requires `paid` and `inventoryReserved`. | `OrderConfirmed` |

Run it:

```sh
node --test architecture/04-microservices/event-storming/order-aggregate.test.ts
```

The tests are short on purpose. They show the point of the aggregate: the rules are in one place, and the failure paths are explicit.

## Apply it to the Upwork clone

The same method works for the [Upwork clone](../../../projects/upwork-clone/README.md). Start with Big Picture events, not with a service diagram.

### Big Picture events

```text
Job posted
Proposal submitted
Proposal withdrawn
Proposal accepted
Contract started
Milestone funded
Work submitted
Milestone approved
Payment released
Dispute opened
Dispute resolved
Review left
```

### Candidate contexts

| Candidate context | Why it might be its own context |
| --- | --- |
| **Identity** | Clients, freelancers, roles, verification. |
| **Jobs and proposals** | The marketplace conversation before a contract. |
| **Contracts** | The agreement, milestones, and deliverables. |
| **Payments and escrow** | Funding, release, refunds, fees, provider integration. |
| **Disputes** | Evidence, decisions, and payment holds. |
| **Messaging** | Conversations, notifications, attachments. |
| **Search** | Discovery and ranking; a different read model. |
| **Reviews** | Reputation and trust. |

These are candidates, not services. Start with a modular monolith; extract a service only when a force appears. The [microservices note](../README.md) explains what “force” means.

### A first process model

| Step | Command | Aggregate | Event | Policy |
| --- | --- | --- | --- | --- |
| Client posts a job | `PostJob` | `Job` | `JobPosted` | — |
| Freelancer submits a proposal | `SubmitProposal` | `Proposal` | `ProposalSubmitted` | When submitted → notify the client. |
| Client accepts a proposal | `AcceptProposal` | `Job` / `Proposal` | `ProposalAccepted` | When accepted → start a contract. |
| Client funds a milestone | `FundMilestone` | `Contract` | `MilestoneFunded` | When funded → hold the funds in escrow. |
| Freelancer submits work | `SubmitWork` | `Milestone` | `WorkSubmitted` | When submitted → notify the client. |
| Client approves the milestone | `ApproveMilestone` | `Milestone` | `MilestoneApproved` | When approved → release payment. |
| Payment is released | `ReleasePayment` | `Escrow` / `Payment` | `PaymentReleased` | When released → notify both sides. |

### Hotspots to capture early

- Who owns the money while a milestone is funded: the platform or the payment provider?
- What happens when a milestone is rejected but the freelancer has already done the work?
- Can a freelancer withdraw a proposal after the client has viewed it?
- What is the source of truth for contract status: the contract, the milestone, or the payment?
- How does a dispute change the payment release policy?
- What happens if the payment provider times out during a release?

These are better as open questions than as guesses in code. Write them down, then resolve the ones that block the next slice.

## A solo session plan

You do not need a room full of people to get value. You need three sessions and a willingness to separate the roles.

### Session 1 — Big Picture (60–90 minutes)

- Write 30–50 events for the Upwork flow.
- Put them on one timeline.
- Add the people and external systems.
- Mark every hotspot.
- Pick the three most important problems.
- Export the board to `projects/upwork-clone/notes/`.

### Session 2 — Process Modeling (60 minutes)

- Pick one end-to-end process, such as “job posted → first milestone paid”.
- Write the happy path.
- Add three exceptions: proposal withdrawn, milestone rejected, payment timeout.
- Add the commands, policies, and read models.
- Do not add aggregates yet.

### Session 3 — Software Design (60 minutes)

- Pick one bounded context, such as Contracts or Payments.
- Replace the systems you own with aggregates.
- Group each aggregate’s commands and events.
- Write the invariants.
- Decide which cross-aggregate rules are policies or process managers.
- Write an ADR for the boundary.

After each session, ask:

> What did we learn that we did not know before?
> What is still a hotspot?
> What is the next decision?

If the answer is “nothing”, the session was probably a diagramming exercise, not Event Storming.

## Common mistakes

| Mistake | Symptom | Fix |
| --- | --- | --- |
| **Starting with aggregates** | The board is a class diagram with sticky notes. | Go back to events and the timeline. |
| **Technical events** | `Row inserted`, `API called`, `Message consumed`. | Ask what a domain expert would say happened. |
| **Commands as events** | `Place order` on an orange note. | Commands are intents; events are facts. |
| **Policies as commands** | `Reserve inventory` is labeled a policy. | A policy is “whenever X, then Y”; the command is the action. |
| **One aggregate per service** | The service boundary is drawn before the invariants are known. | Find the consistency boundary first; deployment comes later. |
| **One aggregate per table** | Every table gets its own aggregate. | An aggregate is a consistency boundary, not a schema. |
| **Mega-aggregate** | `OrderAndPaymentAndInventory` accepts every command. | Split it; use a policy or saga for cross-aggregate rules. |
| **Modeling every edge case** | The session never ends. | Model the happy path and the important alternatives. |
| **One person writes** | The board reflects one person’s model. | Give everyone a marker; rotate the narrator. |
| **Board as spec** | The diagram is treated as final. | The board is a thinking tool; decisions go in ADRs. |
| **Event Storming = event sourcing** | The team thinks it must store every event. | The board produces events; persistence is a separate choice. |
| **Skipping domain experts** | The model is technically neat and business-wrong. | Invite the people who do the work. |
| **Resolving hotspots by guessing** | A red note disappears without a decision. | Keep it open, assign an owner, and write the question down. |

## Checklist

Before you leave the board:

- [ ] Every event is past tense and business-readable.
- [ ] Every event has a cause: a command, a policy, or an external system.
- [ ] Every command has an actor and can be rejected.
- [ ] Every policy is phrased “whenever X, then Y”.
- [ ] Every read model answers a real decision.
- [ ] Every hotspot is written down, with an owner if possible.
- [ ] Each aggregate has one clear invariant and a lifecycle.
- [ ] Cross-aggregate rules are policies or process managers, not mega-aggregates.
- [ ] Bounded contexts are named by language, not by technical layer.
- [ ] The next boundary decision is written as an ADR.

## Run the canvas

```sh
node architecture/04-microservices/event-storming/server.ts
```

Open <http://127.0.0.1:4310>.

Use another port if 4310 is taken:

```sh
PORT=4400 node architecture/04-microservices/event-storming/server.ts
```

There are no dependencies to install. The server uses only `node:http` and `node:fs`.

### What you can do

- Add a note from the palette on the left: domain events, commands, policies, read models, people, external systems, aggregates, bounded contexts, hotspots, or opportunities.
- Drag a note by its colored header.
- Drag the board background to pan around the canvas.
- Click the type badge on a note to cycle through note types.
- Edit the note body in place.
- Delete a note with the `×` button.
- Export the board as JSON or Markdown.
- Import a previously exported JSON board.
- Copy an AI review prompt containing the current board.

### A useful first session

1. Start with **domain events** only. Use past tense and business language: `Order placed`, `Payment captured`, `Inventory reserved`.
2. Put them left to right in time order.
3. Add the **commands** that cause the events.
4. Add **policies** for reactions: “When X happens, then Y.”
5. Add **people** and **external systems** where they make the flow clearer.
6. Mark **hotspots** where the domain experts disagree or the outcome is unclear.
7. Only then look for **aggregates** and candidate **bounded contexts**.

The point is not to produce a perfect diagram. The point is to expose the words, rules, exceptions, and disagreements that the code will eventually have to model.

### Notes

- The sample board is an order flow, including the partial-failure hotspot: payment succeeds but the response is lost.
- `localStorage` is per browser and per origin. Opening the app on a different port gives you a different board.
- For a multi-person workshop, use a shared board such as Miro or Qlerify. This page is intended for solo exploration, a local first draft, and quick iteration.
- The exported JSON is deliberately simple: `{ version, exportedAt, notes }`.

## References

These are the sources behind the inline citations, plus the further reading for this note.

- Brandolini, [*Introducing Event Storming*](https://ziobrando.blogspot.com/2013/11/introducing-event-storming.html) (2013), the original blog post.
- Brandolini, [*Introducing Event Storming*](https://leanpub.com/introducing_eventstorming) (Leanpub book), the long-form treatment.
- Brandolini, [eventstorming.com](https://www.eventstorming.com/), for the workshop format and community resources.
- Qlerify, [*Event Storming – The Complete Guide*](https://www.qlerify.com/post/event-storming-the-complete-guide) (2025), a practical summary of the three levels, notation, and facilitation steps. Qlerify is a vendor; use it as a guide, not as the primary source.
- Evans, [*Domain-Driven Design: Tackling Complexity in the Heart of Software*](https://www.informit.com/store/domain-driven-design-tackling-complexity-in-the-heart-of-9780321125217) (2003), for bounded contexts, aggregates, and ubiquitous language.
- Fowler, [*BoundedContext*](https://martinfowler.com/bliki/BoundedContext.html), for the linguistic boundary.
- Fowler, [*DomainEvent*](https://martinfowler.com/eaaDev/DomainEvent.html), for the event vocabulary.
- Fowler, [*DDD_Aggregate*](https://martinfowler.com/bliki/DDD_Aggregate.html), for the aggregate definition.
- Vernon, [*Effective Aggregate Design*](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf) (2011), for choosing small aggregate boundaries.
- [Aggregates](../../../fundamentals/07-aggregates/README.md), the fundamentals note in this repository.
- [04 — Microservices](../README.md), for the service-boundary, data-ownership, and partial-failure context this guide feeds into.
- [Order flow lab](../order-flow.ts), for the distributed failure version of the payment flow.

## Next

- [04 — Microservices](../README.md) — from a boundary to a service, and the cost of the network.
- [Aggregates](../../../fundamentals/07-aggregates/README.md) — the consistency boundary in code.
- [Domain events](../../../fundamentals/10-domain-events/README.md) — events as a modeling tool.
- [Upwork clone](../../../projects/upwork-clone/README.md) — the project where this board will be used.
