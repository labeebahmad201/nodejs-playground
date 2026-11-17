# 04 — Microservices

*A microservice is a module with an independent release and a network boundary. The boundary buys deployment autonomy; the network charges latency, partial failure, and eventual consistency.*

This is the Day 4 note. The [modular monolith](../01a-modular-monolith.md) is the baseline; microservices are one way to change its deployment and failure boundaries, not the next maturity level. The running example is still the [order system](../../fundamentals/oop/design-patterns/06-composition-root/main.ts).

The question is not "are microservices good?" It is:

> Which boundary earns a network and a separate release?

If you cannot answer that with a concrete force, the answer is probably "none yet."

## The definition

The commonly cited definition comes from Lewis and Fowler:

> ...an approach to developing a single application as a suite of small services, each running in its own process and communicating with lightweight mechanisms, often an HTTP resource API. These services are built around business capabilities and independently deployable by fully automated deployment machinery.

Keep the parts that matter:

- **Organized around a business capability**, not a technical layer.
- **Independently deployable** — you can release it without releasing anything else.
- **Owns its data** — other services do not read or write its tables.
- **Communicates through an explicit contract** — an API, an event schema, or a message.
- **Runs in its own process** — which means the network is now part of the design.

"Micro" is about the **scope of responsibility**, not lines of code. A service that owns one coherent business capability can be large in code and still be a sensible service. A 200-line service that shares a database with four others is not a microservice in any useful sense.

### The two properties that change everything

A modular monolith already has modules, contracts, and data ownership. A microservice adds two things:

1. **An independent deployment unit.** One service can ship while the others stay still.
2. **A network boundary.** Calls cross a process boundary, so they can be slow, fail partially, duplicate, or arrive out of order.

Everything else follows from those two properties. If you remove independent deployment, you have a distributed monolith. If you remove the network, you have a modular monolith.

| Property | Modular monolith | Microservices |  |
| --- | --- | --- | --- |
| **Deployment** | One unit; one release train | Many units; independent releases |  |
| **Call** | In-process function call | Network call |  |
| **Transaction** | Local ACID transaction | Local transactions plus sagas, outbox, compensation |  |
| **Data** | Schema per module, usually one database | Database per service, no shared tables |  |
| **Failure** | One process can take everything down | One service can fail alone — if the caller handles it |  |
| **Debugging** | One stack trace | Distributed traces, correlation IDs, logs across services |  |
| **Change** | A code change in one deployable | A contract change across teams |  |
| **Cost** | Low operational overhead | A premium per service |  |

### What a microservice is not

| It is not | Why |
| --- | --- |
| **A layer** | `payments-service` is not a service layer. A service is a business capability with its own data and release. |
| **A class or a package** | Those are code boundaries. A service is a deployment and ownership boundary. |
| **A container** | A container is packaging. You can run a monolith in a container and a service without one. |
| **A REST endpoint** | An endpoint is an interface. A service can expose several, or use events and no HTTP at all. |
| **A database table** | A table is a persistence detail. One service may own several; one table may be a projection. |
| **Small by line count** | Size is not the defining property. A "nanoservice" can be small and still be a bad boundary. |
| **A team name** | A service usually has an owner, but a team is not a service and a service is not an org chart. |
| **SOA** | SOA is a broader, often ESB-centred style. Microservices is a narrower set of independently deployable services. They share ideas; they are not synonyms. |
| **The default** | The default in this repository is a modular monolith. A service must earn its operational cost. |

## The network is the design change

An in-process call is not free, but it is *simple* in a way a network call is not:

- it does not time out;
- it does not return "unknown";
- it does not serialize your objects;
- it does not fail because a load balancer, DNS server, TLS certificate, or firewall had a bad day;
- it participates in the same transaction;
- it produces one stack trace.

A remote call changes the shape of the problem:

| Concern | In-process | Remote |
| --- | --- | --- |
| **Failure** | Throws or returns | Throws, times out, returns an error, or succeeds after the caller gave up |
| **Latency** | Nanoseconds to microseconds | Milliseconds, with a long tail you do not control |
| **Atomicity** | One transaction can cover both sides | No shared transaction; you need a saga or compensation |
| **Duplication** | A retry is a second function call | A retry may be a second charge, email, or shipment |
| **Ordering** | The program order is the order | Messages can arrive late, twice, or out of order |
| **Change** | Compile-time contract | Versioned API or event contract; old consumers still run |
| **Debugging** | One trace | Many logs, many clocks, many services |

\`

The [fallacies of distributed computing](https://en.wikipedia.org/wiki/Fallacies_of_distributed_computing) are still the shortest checklist:

1. The network is reliable.
2. Latency is zero.
3. Bandwidth is infinite.
4. The network is secure.
5. Topology does not change.
6. There is one administrator.
7. Transport cost is zero.
8. The network is homogeneous.

Every one is false. A microservice design that assumes any of them is a design that will fail in production.

### A port does not hide distribution

Hexagonal architecture gives you a seam at the boundary. That seam is still valuable: you can replace a vendor, test the core without I/O, and keep the domain free of HTTP details.

But a port does **not** make the network disappear. The caller still has to answer:

- What happens on a timeout?
- Is the operation idempotent?
- What is the retry policy?
- What does the caller show the user while the outcome is unknown?
- How is the final state reconciled?

Those are not adapter details. They are part of the use case. Hiding them behind an interface without designing them is how a distributed system gets a green test suite and a production incident.

## What microservices optimize

Microservices are a real tool because they optimize real forces. The benefits are conditional, so name the precondition with the benefit.

| Benefit | What it buys | Precondition | What breaks it |
| --- | --- | --- | --- |
| **Independent deployability** | One team ships without waiting for another | A real deploy pipeline per service; contracts are backward compatible | Lockstep releases; shared database; coordinated migrations |
| **Independent scaling** | Scale the hot capability, not the whole app | The workload is separable and the bottleneck is measured | The service is chatty; scaling one service floods another |
| **Team autonomy** | A team owns code, data, deploy, and on-call | Clear ownership; platform support; Conway's law aligned | One team owns ten services; shared on-call; approval gates |
| **Failure isolation** | One capability fails without taking everything down | Timeouts, retries, circuit breakers, bulkheads, fallbacks | Synchronous call chains; unbounded retries; shared runtime |
| **Compliance boundary** | Regulated data lives in a separate trust boundary | Separate access control, audit, data residency, and operations | Shared database; shared secrets; shared admin access |
| **Runtime fit** | Use the right language or runtime for the job | The team can operate it; the interface is stable | Polyglot for its own sake; no shared observability |
| **Replaceability** | Swap an implementation behind a stable contract | Contract tests; versioning; a migration path | Shared domain model; consumers depend on internals |
| **Data ownership** | Each service evolves its schema independently | No cross-service joins; read models; clear source of truth | Shared tables; cross-service foreign keys; reporting on operational tables |

The strongest benefits are organizational as much as technical. A service boundary is a **sociotechnical** boundary: it decides who can change what without asking permission. That is why the same architecture can work for one team and fail for another.

## What they cost

Fowler calls the operational and coordination cost the [Microservice Premium](https://martinfowler.com/bliki/MicroservicePremium.html). It is not a one-time setup fee. It is a cost per service, per boundary, and per release.

| Cost | Why it appears | Common mitigation | Residual risk |
| --- | --- | --- | --- |
| **Operational surface** | Every service needs a pipeline, runtime, config, secrets, logs, metrics, alerts, and an owner | Platform team; golden paths; infrastructure as code | More things to patch, secure, and pay for |
| **Network latency** | Calls cross processes and possibly regions | Caching; batching; async; edge placement | Tail latency still exists; retries make it worse |
| **Partial failure** | A timeout does not tell you whether the other side committed | Idempotency keys; state machines; reconciliation | Some outcomes remain unknown until reconciled |
| **Distributed consistency** | No shared ACID transaction across services | Sagas; outbox; compensation; eventual consistency | Intermediate states are visible; compensation can fail |
| **Data duplication** | Each service needs its own copy or read model | Events; CDC; projections; source-of-truth rules | Stale data; reconciliation; more storage |
| **Contract evolution** | Old consumers keep running while producers change | Additive changes; versioning; consumer-driven contracts | Version sprawl; accidental breaking changes |
| **Debugging** | One request spans many services and clocks | Correlation IDs; distributed tracing; structured logs | Tracing is not free; gaps are still possible |
| **Testing** | Unit tests are local; integration is distributed | Contract tests; consumer-driven tests; testcontainers | End-to-end tests are slow and flaky; fakes drift |
| **Security** | Every service is a network endpoint | Zero trust; service identity; least privilege; mTLS | More surface area; misconfiguration |
| **Cognitive load** | More repos, more boundaries, more decisions | Strong ownership; documentation; service catalog | Coordination overhead; onboarding time |
| **Cost** | Idle capacity, cross-AZ traffic, observability, environments | Autoscaling; right-sizing; budget alerts | The bill is easier to grow than to shrink |

Kubernetes, a service mesh, and a full observability stack do not remove these costs. They automate parts of them and add their own operational surface. They are infrastructure choices, not architecture fundamentals; the roadmap deliberately skips them for now.

## The distributed monolith

A **distributed monolith** is a system that has the deployment topology of microservices and the coupling of a monolith.

It is the characteristic failure mode of a rushed extraction. You pay for the network and get none of the independence.

### Symptoms

- **Shared database or schema.** Two services read or write the same tables, or join across them.
- **Lockstep releases.** A change to one service requires a change to another, and they must deploy together.
- **Shared domain model.** A `common-domain` library contains the entities that every service imports.
- **Synchronous call chains.** One request calls A, which calls B, which calls C, and all three must be up.
- **No independent startup.** A service cannot run without another service being available.
- **Cross-service tests are the only tests.** You cannot test one service in isolation.
- **No contract versioning.** A producer changes a payload and hopes consumers notice.
- **One team owns everything.** The services are a deployment diagram, not an ownership model.

### A small example

```ts
class OrdersService {
  constructor(
    private readonly db: Pool,             // shared orders + inventory + payments
    private readonly inventory: InventoryClient,
    private readonly payments: PaymentClient,
  ) {}

  async placeOrder(orderId: string): Promise<void> {
    const order = await this.db.query("SELECT * FROM orders WHERE id = $1", [orderId]);

    // If inventory is down, Orders is down.
    await this.inventory.reserve(orderId, order.rows[0].sku);

    // If payments is down, the reservation is stuck.
    await this.payments.charge(orderId, order.rows[0].total_cents);

    // If this write fails, the charge already happened.
    await this.db.query("UPDATE orders SET status = 'paid' WHERE id = $1", [orderId]);
  }
}
```

This is not a microservice. It is a monolith split across processes:

- the database is shared;
- the call chain is synchronous;
- a failure in any dependency fails the request;
- the transaction spans a network call;
- there is no compensation;
- there is no idempotency;
- there is no independent deploy.

The distributed monolith is usually **worse than the modular monolith it came from**. The monolith had local calls and local transactions. The distributed version has network calls and distributed failures, without buying independent deployment.

### How it happens

1. A team extracts a service from a big ball of mud.
2. The new service still reads the old database because the data cannot be separated yet.
3. The old service calls the new one synchronously because "we need the answer now."
4. The new service calls back for customer data.
5. Both services share a `common` package so the types line up.
6. Releases are coordinated because the schema and the contracts move together.
7. The team concludes that microservices are overrated.

The conclusion is wrong. The extraction was incomplete. The boundary was a deployment boundary without a data or contract boundary.

### The fix

- Modularize first. A clean module is the precondition, not the output.
- Give the service its data. No shared tables, no cross-service joins.
- Replace synchronous chains with a deliberate mix of calls and events.
- Version the contract and test it from the consumer's side.
- Make one service deployable alone before adding the next.
- If you cannot get there, merge it back. A modular monolith is a better distributed monolith.

## Service granularity

The hardest question is not "how small?" It is "where is the boundary?"

A service boundary is simultaneously:

- a **business capability** boundary;
- a **transaction** boundary;
- a **data ownership** boundary;
- a **deployment** boundary;
- a **failure** boundary;
- an **ownership** boundary.

If those six do not line up, the service will be awkward. You will either share data, coordinate releases, or compensate for a transaction that wanted to be local.

### Decompose by capability, not by noun or layer

| Bad axis | Example | Why it fails |
| --- | --- | --- |
| **Technical layer** | `controllers-service`, `domain-service`, `persistence-service` | Every request crosses all of them; no independent business change |
| **Entity** | `order-line-service`, `customer-address-service` | Chatty calls; a single invariant spans several services |
| **Screen** | `checkout-page-service`, `admin-page-service` | UI changes drive the boundary; duplication and inconsistent rules |
| **Team** | `team-a-service`, `team-b-service` | The org chart changes; the business capability does not |
| **Framework** | `react-service`, `node-service` | A runtime choice is not a business boundary |

The useful axis is the **business capability** or **bounded context**: a coherent area of the business with its own language, rules, data, and reason to change.

### The four forces

A boundary needs a force. "It is a coherent noun" is not a force.

| Force | Question | Consequence |
| --- | --- | --- |
| **Change cadence** | Does this capability need to ship at a different rate? | Independent deploy |
| **Scaling profile** | Does it have a different load or latency curve? | Independent scaling |
| **Failure or trust boundary** | Must it fail alone, or sit behind extra compliance? | Independent runtime and controls |
| **Ownership** | Can one team own it end to end, including on-call? | Independent team and roadmap |

If none of these differ, a module inside the monolith is probably enough.

### The consistency question

The boundary must also answer:

- What must be **strongly consistent**? Keep it inside one service and one local transaction.
- What can be **eventually consistent**? That is a candidate for a separate service.
- What is the **compensation** if a later step fails?
- What does the caller do while the outcome is **unknown**?

A service boundary that cuts through a real invariant creates a distributed transaction. Sometimes that is necessary; often it means the boundary is wrong.

### Too coarse and too fine

| Granularity | Symptom | Cost |
| --- | --- | --- |
| **Too coarse** | One service owns orders, payments, inventory, and notifications | It is a monolith with a new name; one release train; one failure domain |
| **Too fine** | Many small services call each other for one request | Chatty network; distributed transactions; operational overhead; nanoservices |
| **About right** | One capability, one owner, one data boundary, one release cadence | Still has a network cost, but the cost buys something |

A useful test: **can you describe the service without the word "and"?** "Payments" is a capability. "Payments and fraud and notifications" is three reasons to change.

### Candidate boundaries in the order system

| Candidate | Force | Recommendation |
| --- | --- | --- |
| **Orders** | Core lifecycle; owns the order aggregate and its invariants | Keep in the monolith first. It is the consistency centre. |
| **Payments** | External provider, compliance, audit, trust boundary | Strong candidate when compliance demands a separate boundary. Extraction needs a saga and reconciliation. |
| **Inventory** | Reservation contention, stock accuracy, possible scaling | Keep as a module until contention or ownership forces a split. |
| **Notifications** | Async, spikey, failure should not fail checkout | Best first extraction: clean async seam, independent scaling, low consistency risk. |
| **Reporting** | Read-heavy, different query shape, does not belong in checkout | Build a read model or warehouse first; make it a service only if load or ownership requires it. |

The first extraction should be the **cleanest seam with the strongest force**, not the most exciting service.

## Data ownership

The rule is simple to state and hard to do:

> Each service owns its data. Other services use its contract, not its tables.

This is the [database per service](https://microservices.io/patterns/data/database-per-service.html) pattern. It does **not** necessarily mean a separate database server. It means a separate **ownership boundary**:

- separate schema and credentials at minimum;
- separate migrations;
- no cross-service joins;
- no cross-service foreign keys;
- no shared ORM entities;
- no service reading another service's tables "just for reporting."

A separate server is an operational choice. Separate ownership is the architectural rule. If two services share a schema on one server, they still have a shared failure domain and a coordinated migration, but the boundary can be a useful transitional step.

### Cross-service reads

When service A needs data owned by service B, there are four legitimate options:

| Pattern | Use when | Cost |
| --- | --- | --- |
| **API composition** | A needs the current answer now; the call is simple and bounded | Runtime coupling; latency; partial failure |
| **CQRS / read model** | A needs a query-shaped view and can tolerate staleness | Projection code; eventual consistency; rebuild plan |
| **Events** | A needs to react to a fact, not ask a question | Eventual consistency; duplicates; ordering; schema evolution |
| **Reporting warehouse / replica** | Analytics needs a stable, query-optimized view | Pipeline; freshness; data governance |

What A must not do is reach into B's tables. That is not integration; it is hidden coupling with a SQL accent.

### Duplicate data on purpose

In a monolith, normalization is cheap: join the tables. In microservices, a join across services is a network call or a read model. The usual answer is **deliberate duplication**:

- Orders keeps the customer's shipping address as it was at order time.
- Reporting keeps an `order_facts` table built from events.
- Notifications keeps a preference copy so it can send without calling Customer on the hot path.

The duplication is not a bug if you can answer:

- Who is the **source of truth**?
- How does the copy get updated?
- How stale may it be?
- How do you rebuild it?
- What happens when the source and the copy disagree?

### Reporting is the usual exception

Reporting is where data ownership usually breaks first. The answer is not "let reporting query the operational database." That couples reporting to every schema and puts analytical load on checkout.

Use a read model:

- consume domain events and build reporting tables;
- read from a replica with a published, stable view;
- feed a warehouse through CDC or events.

The operational services stay free to change, and reporting gets a model designed for questions rather than transactions. See [01a — Data ownership](../01a-modular-monolith.md#data-ownership) for the monolith version of the same rule.

## Transactions across services

In normal microservice design there is no shared ACID transaction across independently deployed services. Two-phase commit exists, but it is operationally expensive, couples availability, and is usually avoided. The practical choices are:

1. **Keep the invariant inside one service.** Best when the data really belongs together.
2. **Use a saga / process manager.** A sequence of local transactions with explicit state and compensation.
3. **Use a single database transaction across services.** This is usually a distributed monolith smell. If you keep it, record it as a deliberate coupling.

### Saga

A **saga** is a long-running business process made of local transactions. Each step has a compensating action for the steps that already succeeded.

```text
Order placed
  → Payment authorized
  → Inventory reserved
  → Order confirmed
  → Notification queued

If inventory reservation fails:
  → Refund payment
  → Cancel order
  → Notify customer
```

A saga is not a transaction. The intermediate states are visible, and the compensation can fail ([Richardson, *Saga*](https://microservices.io/patterns/data/saga.html)). That means:

- every step must be **idempotent**;
- every step must be **retryable**;
- the saga must store its **state**;
- a stuck saga needs an owner and an alert;
- compensation is a business decision, not a rollback.

| Coordination | How it works | Use when | Cost |
| --- | --- | --- | --- |
| **Orchestration** | A central process manager tells each service what to do | The workflow is complex; you need visibility and control | The orchestrator becomes a coupling point and a single place to change |
| **Choreography** | Services react to events; no central coordinator | The workflow is simple; loose coupling matters | The flow is implicit; harder to see, test, and debug |

Neither is universally better. Orchestration is easier to reason about; choreography is easier to decouple. Most systems use both, at different scales.

### Outbox and idempotency

A service cannot atomically write its database and publish an event. The [transactional outbox](../01c-outbox-pattern.md) solves the publication side:

1. Write the business row and the outbox row in one local transaction.
2. A relay publishes the outbox row.
3. Mark it published, or let the consumer deduplicate.

The consumer side needs [idempotency](../01g-idempotency.md):

- at-least-once delivery means duplicates are normal;
- a consumer inbox or a unique key makes the second delivery harmless;
- the key must identify the logical operation, not the attempt.

"Exactly once" is mostly a marketing phrase. End-to-end exactly-once delivery is not generally achievable across arbitrary services; the practical contract is **at-least-once delivery plus idempotent processing** ([Kleppmann, *DDIA*, ch. 11](https://dataintensive.net/); [Richardson, *Idempotent consumer*](https://microservices.io/patterns/communication-style/idempotent-consumer.html)).

## Synchronous vs asynchronous integration

This is the integration decision that most often decides whether a service boundary feels good or bad.

|  | Synchronous | Asynchronous |
| --- | --- | --- |
| **Shape** | Request/response | Event or message |
| **Coupling** | Runtime: both sides must be up | Temporal: producer can proceed while consumer is down |
| **Latency** | Caller waits | Caller does not wait |
| **Consistency** | Can return the current result | Eventual |
| **Failure** | Caller must handle timeout, retry, fallback | Broker must handle retry, dead-letter, ordering |
| **Debugging** | One call stack | Trace across messages and consumers |
| **Use when** | Caller needs the answer now; the operation is a query or a command whose result matters | Side effects can be eventual; multiple consumers; buffering; failure isolation |
| **Avoid when** | The caller can proceed without the answer, or the dependency is volatile and non-critical | The caller needs an immediate answer, or the workflow is simple and local |

A synchronous call chain is an availability chain. If A calls B and B calls C, a request needs all three to be healthy at the same moment. That is why a synchronous dependency turns a partial failure into a full request failure, and why retries need bounds: unbounded retries can amplify an outage into a cascading failure ([Nygard, *Release It!*](https://pragprog.com/titles/mnee2/release-it-second-edition/); [Google SRE, *Addressing Cascading Failures*](https://sre.google/sre-book/addressing-cascading-failures/)). Async integration breaks that temporal coupling, but it adds eventual consistency, duplicates, and a broker to operate.

Events are coupling too. An event schema is a public contract. If you change a field, every consumer may break. Event-driven architecture is not "no coupling"; it is a different coupling with a different failure mode. Day 5 takes this up in detail.

### Reliability is part of the contract

A remote call needs an explicit policy:

- **Timeout** — never wait forever.
- **Retry** — only for transient failures, with backoff and jitter, and only if the operation is idempotent.
- **Circuit breaker** — stop hammering a failing dependency.
- **Bulkhead** — isolate pools or workers so one slow dependency does not consume everything.
- **Backpressure** — reject or queue when the system is saturated.
- **Fallback** — return a degraded answer when the business can tolerate it.

These are not optional polish. They are documented stability patterns, not folklore: Nygard's *Release It!* covers circuit breakers and bulkheads; the Google SRE book covers cascading failure and load shedding; the AWS Builders' Library covers timeouts, retries, and backoff with jitter ([Nygard](https://pragprog.com/titles/mnee2/release-it-second-edition/); [Google SRE](https://sre.google/sre-book/addressing-cascading-failures/); [AWS Builders' Library](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)). They are how a service boundary survives a bad day. Day 6 covers the distributed-systems side.

### Contracts and versioning

An API or event is a public contract. Treat it like one:

- prefer **additive** changes;
- never reuse a field with a new meaning;
- version when you must, and run old and new consumers side by side;
- test from the **consumer's** side, not only the producer's;
- use consumer-driven contract tests where the coupling is real;
- publish a schema for events, not just a TypeScript type in a shared package.

A shared `common` package with the domain entities is not a contract. It is a distributed monolith's source code. Share stable primitives such as IDs and money if you must; do not share the aggregate.

## Partial failure: the ambiguous outcome

The defining microservices bug is not "the service is down." It is:

> The provider did the work, but the response never arrived.

The caller now has three possible truths:

1. the operation did not happen;
2. the operation happened and succeeded;
3. the operation happened and failed.

A timeout collapses all three into "I don't know." If the caller retries blindly, it can charge the card twice, send the email twice, or ship twice.

This is a structural property of distributed systems, not a bug in a particular client library. A timeout is a local decision; it does not cancel the remote work. The network can lose the response after the remote side committed, and no amount of retrying can tell you which happened without an idempotency key, a dedupe record, or a reconciliation query ([Kleppmann, *DDIA*, ch. 8](https://dataintensive.net/); [Helland, *Life Beyond Distributed Transactions* (2007)](https://www.ics.uci.edu/~cs223/papers/cidr07p15.pdf)). The retry policy is therefore part of the contract, not an afterthought: bound it, back it off, add jitter, and make the operation safe to repeat ([AWS Builders' Library, *Timeouts, retries, and backoff with jitter*](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)).

### Run the lab

The runnable proof is `order-flow.test.ts`:

```sh
node --test architecture/04-microservices/order-flow.test.ts
```

Type-check it without the rest of the repository:

```sh
npx tsc --noEmit \
  --target esnext --module nodenext --moduleResolution nodenext \
  --strict --skipLibCheck --types node \
  --allowImportingTsExtensions --verbatimModuleSyntax --erasableSyntaxOnly \
  architecture/04-microservices/order-flow.ts \
  architecture/04-microservices/order-flow.test.ts
```

The service uses a **stable idempotency key** for the logical charge:

```ts
const idempotencyKey = `order:${order.id}:charge`;

for (let attempt = 1; attempt <= this.#maxAttempts; attempt++) {
  try {
    const paymentId = this.#payments.charge({
      idempotencyKey,
      cardToken,
      amountCents: order.totalCents,
    });

    this.#orders.markPaid(order.id, paymentId);
    return;
  } catch (error) {
    if (error instanceof PaymentTimeout) {
      if (attempt < this.#maxAttempts) continue;
      this.#orders.markPaymentUnknown(order.id);
      throw error;
    }

    this.#orders.markPaymentFailed(order.id);
    throw error;
  }
}
```

The key is built from the order, not from the attempt. A retry with a new key is a new charge; a retry with the same key is the same logical charge. The provider deduplicates it and returns the original result.

That only works if the provider honors the key. If it does not, you need a local payment-intent record plus a reconciliation API, or a provider that supports idempotency. The key must also survive a process restart, so store it with the order or payment attempt; deriving it from a stable business identifier is the simplest version.

The test fake charges the card and then throws a timeout on the first call. On the retry, the provider recognizes the key and returns the existing payment:

```ts
test("retries after a timeout without charging twice", () => {
  const orders = new InMemoryOrders([order()]);
  const payments = new FakePaymentProvider();
  payments.dropResponseAfterChargeOnce();
  const service = new PlaceOrder(orders, payments);

  service.execute("1", "tok_test");

  assert.equal(orders.statusOf("1"), "paid");
  assert.equal(payments.chargeCount, 1);
  assert.equal(payments.attempts, 2);
});
```

The other tests make the distinctions explicit:

| Test | Lesson |
| --- | --- |
| `a declined card leaves the order failed, not paid` | A definite failure is not an unknown outcome. |
| `an exhausted timeout leaves the outcome explicit` | When retries run out, the order becomes `payment_unknown`; reconciliation owns the next step. |
| `a new idempotency key is a new charge` | The key must identify the logical operation, not the attempt. |

### The state machine

A remote payment is a state machine, not a boolean:

```text
pending
  ├─ charge succeeds ──────────────▶ paid
  ├─ charge is declined ──────────▶ payment_failed
  └─ timeout / no response ───────▶ payment_unknown
                                      │
                                      ├─ reconciliation finds success ─▶ paid
                                      └─ reconciliation finds no charge ─▶ retry or fail
```

The important state is `payment_unknown`. It is not a bug; it is the honest representation of missing information. A system that has no `unknown` state will lie to the user or charge twice.

That is why the microservices version of a transaction is not just a saga. It is a saga plus:

- idempotent steps;
- durable state;
- a reconciliation path;
- an operator who can see a stuck workflow.

## When to extract a service

Extraction is a migration, not a rewrite. Do it when a concrete force makes independent deployment worth the operational cost.

### The force

At least one of these should be true, and you should be able to point at evidence:

- **Independent deployment cadence.** One capability needs to ship much more often than the rest.
- **Independent scaling.** One workload has a different load or latency curve.
- **Ownership and team autonomy.** A team can own the service end to end, including on-call and data.
- **Failure isolation.** A failure in one capability must not take down another, and in-process bulkheads are not enough.
- **Compliance or data residency.** Regulated data needs a separate trust boundary.
- **Different runtime or language.** The capability needs a runtime the monolith cannot reasonably host.
- **A measured release bottleneck.** The monolith's deploy train is the constraint, and you can show the cost.

"Microservices are best practice" is not a force. "We might need to scale someday" is not a force. A clean module contract is what makes later extraction possible; an event bus is not a substitute for a boundary.

### The preconditions

- [ ] The capability is a real module with a public contract and private internals.

- [ ] The module owns its data; there are no cross-module joins or shared tables.

- [ ] The contract is versioned and tested from the consumer's side.

- [ ] The service can be deployed, rolled back, and observed on its own.

- [ ] There is a CI/CD pipeline, secrets management, and a service catalog entry.

- [ ] There is distributed tracing and an on-call owner.

- [ ] The consistency plan is explicit: local transaction, saga, outbox, compensation, reconciliation.

- [ ] The migration plan is explicit: strangler, branch by abstraction, dual run, or backfill.

- [ ] There is a success metric and a rollback path.

- [ ] There is a plan to merge it back if the force disappears.

If several are missing, the extraction is a distributed monolith in progress.

### Do not extract when

- the code is a big ball of mud;
- the module has no data ownership;
- the service would share a database with the monolith;
- the only reason is "microservices are modern";
- the team cannot operate another runtime;
- the consistency requirements need a local transaction and there is no saga plan;
- you cannot measure the bottleneck you are trying to fix.

### The first extraction in the order system

The best first candidate is **Notifications**, not Orders or Payments.

| Why Notifications first | Why not the others yet |
| --- | --- |
| It is already async: the order does not need the email to succeed. | Orders is the consistency centre; extracting it first splits the core invariant. |
| A provider outage should not fail checkout. | Payments has a stronger compliance force, but a harder consistency problem. |
| Traffic is spikey and can scale independently. | Inventory has contention, but a module may contain it. |
| The data is mostly its own: preferences, templates, delivery log. | Reporting should be a read model or warehouse before it is a service. |
| A failed notification can be retried and dead-lettered. | A failed payment needs compensation and reconciliation. |

A sensible sequence is:

```text
modular monolith
  → in-process module
  → outbox event
  → separate worker deployment
  → independent service
  → split data ownership
```

You do not have to jump to the end. A separate worker with its own queue is often enough to isolate the failure and scaling profile without paying for a full service boundary.

### What gets worse when you extract Notifications

Be specific. The point of the list is to make the trade-off honest.

- Another deploy pipeline, runtime, config, secrets, and dependency update stream.
- An event contract that must be versioned; old consumers keep running.
- Duplicate or late notifications; the consumer must be idempotent.
- A broker to operate, monitor, and secure.
- Distributed tracing across the order and notification services.
- Local development now needs a broker or a contract-test harness.
- On-call for a new service; someone must own the dead-letter queue.
- Data duplication for preferences and templates.
- End-to-end tests become slower and flakier; contract tests matter more.
- More cloud spend: another service, another environment, more logs.
- A new failure mode: the order succeeds but the notification never arrives.

Those costs are acceptable if the force is real. They are not acceptable just because the diagram looks modern.

### The migration path

- **Strangler fig.** Put the new service in front of one route or one event stream, then move traffic gradually.
- **Branch by abstraction.** Put an interface in front of the old implementation; swap the implementation behind it.
- **Anti-corruption layer.** Translate between the old and new models instead of sharing them.
- **Outbox / CDC.** Publish changes reliably while both sides run.
- **Dual writes with reconciliation.** Transitional only; dual writes are not a consistency strategy.

Extract the module with the cleanest seam and the strongest force. Do not start with the most coupled capability because it hurts the most.

## Worked scenario: argue both sides

**Scenario.** An e-commerce order system has three teams: Checkout, Fulfillment, and Growth. It handles 20,000 orders a day, with a 10× peak on sale days. Notifications spike during the peak. Payments are regulated and audited. Reporting queries are slowing checkout. The current system is a modular monolith with modules for Orders, Payments, Inventory, Notifications, and Reporting, one database with a schema per module, and an outbox.

### The case for microservices

- **Growth needs to ship notifications daily.** Checkout ships weekly. Independent deployment removes the release train.
- **Notification spikes should not affect checkout.** A separate service with its own queue and workers isolates the load and the provider outage.
- **Payments need a compliance boundary.** Separate access control, audit, and data residency are easier to argue with a separate service.
- **Reporting has a different scaling profile.** A read model or service can be scaled without touching checkout.
- **Failure isolation.** An email provider outage should degrade notifications, not orders.

### The case against

- **20,000 orders a day is small.** A modular monolith with a separate worker can handle it comfortably.
- **The core invariant is cross-capability.** Order, payment, and inventory states are tightly related; distributing them adds sagas and compensation.
- **The operations team is small.** Five services means five pipelines, five dashboards, five on-call rotations, and five security surfaces.
- **The boundaries are still being learned.** The domain is changing; a network boundary makes it expensive to move a concept.
- **The distributed monolith risk is high.** If the services share the database or deploy in lockstep, the split makes things worse.
- **The cost is immediate; the benefit is speculative** until the release bottleneck or compliance requirement is measured.

### The decision

Start with the modular monolith and extract **one** service:

1. Keep Orders, Payments, and Inventory as modules. Keep their invariants local.
2. Extract Notifications behind the existing outbox. It is async, failure-isolated, and spikey.
3. Build a reporting read model before making Reporting a service.
4. Keep Payments inside until compliance requires a separate trust boundary; then extract it with a saga, idempotency, and reconciliation.
5. Write an ADR with the force, the costs, and the revisit trigger.

**Revisit when:**

- the release train is a measured bottleneck for a team;
- notification volume or provider failures exceed what the worker can isolate;
- compliance requires a separate payment boundary;
- a team can own a service end to end, including on-call;
- the data ownership and contract tests are already in place.

This is the answer the roadmap asks for: not "microservices good" or "microservices bad," but "this boundary, this force, this cost, this trigger."

## Decision checklist

Use these before approving an extraction.

**The force**

- [ ] What concrete force requires a separate deployment?

- [ ] Is it measured, or is it a prediction?

- [ ] Could a modular monolith plus a separate worker satisfy it?

- [ ] What happens if we do nothing for six months?

**The boundary**

- [ ] Is this a business capability or bounded context?

- [ ] Can I describe it without "and"?

- [ ] Does it own its data and migrations?

- [ ] Can it change and deploy without another service?

- [ ] Can it fail without taking down the core flow?

- [ ] Is it too fine-grained or chatty?

**The data**

- [ ] Who is the source of truth for each entity?

- [ ] What must be strongly consistent?

- [ ] What can be eventually consistent?

- [ ] How do consumers read data they do not own?

- [ ] What is the compensation or reconciliation path?

- [ ] Can the read model be rebuilt?

**The integration**

- [ ] Is each call synchronous or asynchronous, and why?

- [ ] What happens on a timeout?

- [ ] Is every retryable operation idempotent?

- [ ] What is the retry, timeout, and circuit-breaker policy?

- [ ] How are API and event contracts versioned?

- [ ] Are there consumer-driven contract tests?

**The operations**

- [ ] Can one request be traced across services?

- [ ] Can one service be deployed and rolled back alone?

- [ ] Who is on-call for it?

- [ ] Where are the logs, metrics, and alerts?

- [ ] How are secrets and service identity managed?

- [ ] What does it cost per month?

- [ ] What gets worse when we extract it?

- [ ] What would make us merge it back?

If you cannot answer the last two, you have not finished the trade-off.

## Trade-off matrix row

| Style or decision | Optimizes | Costs | Use when | Avoid when | Failure mode |
| --- | --- | --- | --- | --- | --- |
| **Microservices** | Independent deployability; independent scaling; team autonomy; failure isolation; compliance boundaries; runtime fit; replaceable services; data ownership | Network latency and partial failure; distributed consistency; data duplication; contract/versioning; many pipelines and dashboards; tracing; testing; security surface; coordination; microservice premium | Multiple teams need independent releases; parts scale differently; a capability needs a compliance, failure, or runtime boundary; boundaries and data ownership are proven; platform and on-call exist | Small team or product; boundaries still unknown; strong consistency across capabilities; no observability, CI/CD, or on-call; a modular monolith can satisfy the force | Distributed monolith; chatty services; cascading failure; inconsistent data; lockstep releases; nanoservices |

This row is also collected in the [consolidated trade-off matrix](../tradeoffs.md).

## References

These are the sources behind the inline citations, plus the further reading for this note.

- Lewis & Fowler, [*Microservices: a definition of this new architectural term*](https://martinfowler.com/articles/microservices.html) (2014).
- Fowler, [*Microservice Trade-Offs*](https://martinfowler.com/articles/microservice-trade-offs.html) (2015).
- Fowler, [*Microservice Premium*](https://martinfowler.com/bliki/MicroservicePremium.html) (2015).
- Fowler, [*Microservice Prerequisites*](https://martinfowler.com/bliki/MicroservicePrerequisites.html) (2014).
- Fowler, [*Monolith First*](https://martinfowler.com/bliki/MonolithFirst.html) (2015).
- Newman, [*Building Microservices*](https://samnewman.io/books/building_microservices_2nd_edition/) (2nd ed., 2021).
- Newman, [*Monolith to Microservices*](https://samnewman.io/books/monolith-to-microservices/) (2019).
- Ford, Richards, Sadalage & Dehghani, *Software Architecture: The Hard Parts* (2021), for granularity, data ownership, and distributed workflows.
- Richardson, [microservices.io pattern catalog](https://microservices.io/patterns/), especially [Database per service](https://microservices.io/patterns/data/database-per-service.html), [Saga](https://microservices.io/patterns/data/saga.html), [API composition](https://microservices.io/patterns/data/api-composition.html), [CQRS](https://microservices.io/patterns/data/cqrs.html), and [Idempotent consumer](https://microservices.io/patterns/communication-style/idempotent-consumer.html).
- Kleppmann, [*Designing Data-Intensive Applications*](https://dataintensive.net/) (2017), especially ch. 8 (“The Trouble with Distributed Systems”) for partial failure and ch. 11 (“Stream Processing”) for exactly-once and idempotence.
- Helland, [*Life Beyond Distributed Transactions: An Apostate’s Opinion*](https://www.ics.uci.edu/~cs223/papers/cidr07p15.pdf) (2007), for unknown outcomes and the limits of distributed transactions.
- Nygard, [*Release It!*](https://pragprog.com/titles/mnee2/release-it-second-edition/) (2nd ed., 2018), for timeouts, circuit breakers, bulkheads, and stability patterns.
- Google SRE, [*Addressing Cascading Failures*](https://sre.google/sre-book/addressing-cascading-failures/), for failure amplification, retries, and load shedding.
- AWS Builders’ Library, [*Timeouts, retries, and backoff with jitter*](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/), for retry budgets and jitter.
- Deutsch, [*The Fallacies of Distributed Computing*](https://en.wikipedia.org/wiki/Fallacies_of_distributed_computing).
- Fowler, [*What do you mean by Event-Driven?*](https://martinfowler.com/articles/201701-event-driven.html) (2017).
- Evans, [*Domain-Driven Design*](https://www.domainlanguage.com/ddd/) (2003), for bounded contexts and ubiquitous language.
- [01a — Modular monolith](../01a-modular-monolith.md), [01c — Outbox](../01c-outbox-pattern.md), and [01g — Idempotency](../01g-idempotency.md) for the patterns this note builds on.

## Next

- [Event Storming](event-storming/README.md) — the workshop that finds the process, language, and aggregate boundaries before you extract services; includes a local canvas and a runnable aggregate example.
- [Event Storming — the complete article](event-storming/article/event-storming-the-complete-guide.md) — the long-form guide with diagrams, facilitation checklists, and the board-to-code mapping.
- [Roadmap — Day 5: Event-driven, CQRS, and event sourcing](../../roadmap.md#day-5--event-driven-cqrs-and-event-sourcing) — the next boundary: events as contracts, eventual consistency, and read models.
- [01c — Transactional outbox](../01c-outbox-pattern.md) — reliable publication across a service boundary.
- [01g — Idempotency](../01g-idempotency.md) — safe retries and duplicate handling.
- [02d — Coupling and testability](../02d-coupling-and-testability.md) — the seams that make the failure paths testable.
- [Trade-offs](../tradeoffs.md) — the consolidated matrix.
- [Roadmap](../../roadmap.md) — Day 5 and the rest of the plan.