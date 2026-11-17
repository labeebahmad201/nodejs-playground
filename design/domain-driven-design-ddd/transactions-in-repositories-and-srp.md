# Transactions in repositories and the single responsibility principle

*An aggregate has to be persisted atomically. That does not make the repository the owner of the transaction. The aggregate boundary defines **what** must commit together; a unit of work decides **who** begins, commits, and rolls back. Keep those two decisions separate and the SRP question mostly answers itself.*

## The question

Two rules collide:

1. A repository method should not open and commit its own transaction. The caller decides when a unit of work starts and ends.
2. An aggregate is a consistency boundary. If it is made of a root and two child entities, it must be saved as one unit — otherwise a crash can leave the root persisted without its children.

So: **should `save()` be transactional when it persists a whole aggregate? And if it is, does the repository now have more than one reason to change?**

The short answer: the repository may need to *write* several tables, and it may need to *participate* in a transaction. It should not *own the transaction policy of the use case*. Those are different responsibilities, and the SRP smell appears when they are merged into one class.

That is also the position Milan Jovanović argues in [*Where Do Transactions Belong in Clean Architecture?*](https://milanjovanovic.tech/blog/transactions-clean-architecture):

> "Transactions belong in the application layer, because the use case defines what must succeed or fail together. […] Repositories are the wrong place. A repository sees one aggregate type at a time, and it cannot know whether the current operation is standalone or part of a larger unit."

## Three decisions people conflate

| Decision | Question it answers | Belongs to |
| --- | --- | --- |
| **Consistency scope** | Which writes must be true or false together? | The aggregate boundary (domain) |
| **Transaction control** | Where does the unit of work begin, commit, and roll back? | Application service / unit of work |
| **Persistence mechanics** | Which tables, statements, and mappings write the aggregate? | Repository implementation |

The aggregate boundary tells you that the root and its two children must share a commit. It says nothing about which object calls `BEGIN`. That is an orchestration decision, and orchestration is not persistence. Martin Fowler's definition makes the aggregate the load/save unit: an aggregate is "a cluster of domain objects that can be treated as a single unit," and "you request to load or save whole aggregates. Transactions should not cross aggregate boundaries" ([*DDD_Aggregate*](https://martinfowler.com/bliki/DDD_Aggregate.html), 2013). Vaughn Vernon states the consistency side: "A properly designed Aggregate is one that can be modified in any way required by the business with its invariants completely consistent within a single transaction" ([*Effective Aggregate Design Part II*](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_2.pdf), 2011).

Vladimir Khorikov draws the operational line between the two decisions:

> "Declaring database changes and then committing these changes are two separate decisions, and should be processed as such. […] enlisting a data change in the current transaction and then committing or rolling that transaction back are the decisions you want to make separately."
>
> — [*How to handle unique constraint errors*](https://khorikov.org/posts/2020-11-08-unique-constraint-errors/), Enterprise Craftsmanship, 2020

A root plus two children is **one aggregate, one save, one unit of work**. The number of tables or entities does not change the number of transactions. Writing three tables inside one transaction is exactly what an aggregate repository is for.

## The repository contract can promise atomicity

There is nothing wrong with the port saying:

> `save(order)` persists the entire aggregate or nothing.

That promise is about the *result*. The implementation can keep it in two ways:

- **Enlist:** receive a transaction context from the caller and write inside it.
- **Own the boundary as a default:** open a transaction only when no transaction is already active.

The first is composable. The second is convenient but hides policy. Which one you choose is a design decision; neither is "transaction logic leaking into the repository" by itself.

Microsoft's .NET microservices guidance can sound like it disagrees: "the transactional area (that is, the updates) must always be controlled by the repositories and the aggregate roots" ([*Designing the infrastructure persistence layer*](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/infrastructure-persistence-layer-design)). Read in context, that sentence is about the **update channel** — all writes go through the repository that owns the aggregate — not about where `BEGIN` is called. The same page separates the two concerns: "These multiple persistence operations are performed later in a single action when your code from the application layer commands it. The decision about applying the in-memory changes to the actual database storage is typically based on the Unit of Work pattern."

What *is* a leak is the repository deciding the transaction scope for a whole use case, or committing when the caller expected to keep writing.

## Why "no transaction in the repository" is still a good default

- **Composability.** A use case may need to write an aggregate and an outbox row, or (deliberately) two aggregates. If every repository call commits, those writes cannot be atomic.
- **One place to reason about failure.** `commit` and `rollback` should have a single owner. If three repositories each commit, there are three failure points.
- **Testability.** A fake repository does not need to simulate transactions.
- **Nested-transaction surprises.** Calling `transaction()` inside another `transaction()` often means savepoints, or a silent join, depending on the driver. Assuming the inner rollback undoes the outer work is a classic bug.
- **Policy is separate from storage.** Isolation level, retry, and timeout belong to infrastructure, not to the mapping code.

Vladimir Khorikov makes the composability point concretely: "In real-world projects, you will almost always have scenarios where you need to update more than one aggregate at once. […] Therefore, you can't delegate this `SaveChanges()` responsibility to any particular repository, it should be performed separately" ([*Crossing aggregate boundaries*](https://khorikov.org/posts/2022-06-13-crossing-aggregate-boundaries/), 2022).

But notice what this rule is *not* saying. It is not saying a repository must issue one statement per call. It is saying the repository should not own the commit decision of the use case.

## The shape that keeps both properties

### The ports

```ts
// Opaque to the domain. The infrastructure decides what it really is.
interface TransactionContext {}

interface UnitOfWork {
  transaction<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}

interface OrderRepository {
  findById(id: OrderId, tx?: TransactionContext): Promise<Order | null>;
  save(order: Order, tx?: TransactionContext): Promise<void>;
}
```

The optional `tx` is pragmatic: callers inside a unit of work pass it; callers that do not have one leave it out. Some teams make it required inside the transaction scope and offer a separate convenience method. The important part is that the repository *accepts* a transaction instead of inventing one.

### The application service owns the use case

```ts
class PlaceOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly outbox: Outbox,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(command: PlaceOrderCommand): Promise<void> {
    await this.uow.transaction(async (tx) => {
      const order = Order.create(command);
      await this.orders.save(order, tx);
      await this.outbox.append(order.pullEvents(), tx);
    });
  }
}
```

The application service decides that the order and its event commit together. The repository maps the aggregate. The outbox writes its row. All three participate in one transaction, but only one of them owns it.

That is Fowler's Unit of Work in practice: it "maintains a list of objects affected by a business transaction and coordinates the writing out of changes and the resolution of concurrency problems" ([*Unit of Work*](https://martinfowler.com/eaaCatalog/unitOfWork.html), PoEAA, 2003). The use case is the scope in which that list makes sense; a single repository cannot see the list.

### If you want a single-aggregate save to be convenient: use a decorator

This is the key move for the SRP question. You can give callers an atomic `save()` without putting transaction policy in the mapping code:

```ts
class TransactionalOrderRepository implements OrderRepository {
  constructor(
    private readonly inner: OrderRepository,
    private readonly uow: UnitOfWork,
  ) {}

  findById(id: OrderId): Promise<Order | null> {
    return this.inner.findById(id);
  }

  save(order: Order): Promise<void> {
    return this.uow.transaction((tx) => this.inner.save(order, tx));
  }
}
```

Now there are two classes with two reasons to change:

- `PostgresOrderRepository` changes when the schema or mapping changes.
- `TransactionalOrderRepository` changes when the transaction policy changes.

Neither changes for the other's reason. That is the SRP-clean version of "the repository saves the aggregate atomically." It is also the Decorator pattern applied to a cross-cutting concern. Microsoft's guidance notes that a repository abstraction "provides ease of extending behavior through patterns like Decorators or Proxies. For instance, cross-cutting concerns like caching, logging, and error handling can all be applied using these patterns rather than hard-coded in the data access code itself" ([*Designing the infrastructure persistence layer*](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/infrastructure-persistence-layer-design)). Transaction demarcation is such a concern.

If a caller already has a transaction, compose the decorator differently or skip it and pass the context down. What you should not do is let the inner repository check for an ambient transaction *and also* implement its own commit policy in the same class.

### Ambient transactions

In Node.js you can carry the transaction with [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html) so callers do not pass `tx` explicitly. ORMs such as [Prisma's interactive transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions#interactive-transactions), [TypeORM's query runner](https://typeorm.io/transactions), and [Knex's transaction object](https://knexjs.org/guide/transactions.html) can be wrapped this way.

```ts
// Sketch: the unit of work stores the active tx in async context.
async transaction<T>(work: () => Promise<T>): Promise<T> {
  return this.storage.run(this.driver.begin(), async () => {
    try {
      const result = await work();
      await this.current().commit();
      return result;
    } catch (error) {
      await this.current().rollback();
      throw error;
    }
  });
}
```

This is convenient, but it is implicit control flow: a repository call behaves differently depending on whether a transaction happens to be active. That is acceptable when the ORM already works this way, but it is still policy — write it down and test it, especially the nested case.

## SRP: reasons to change, not lines of code

SRP is routinely read as "one class does one thing." Martin's own clarification is narrower and more organizational: **"This principle is about people."** In [*The Single Responsibility Principle*](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html) (Clean Coder Blog, 2014), he defines a responsibility by asking who would request the change, and restates the rule as:

> "Gather together the things that change for the same reasons. Separate those things that change for different reasons."

In *Clean Architecture* (2017, ch. 7) he reduces it to: "A module should be responsible to one, and only one, actor." His `Employee` example has exactly the shape of the repository question: `calculatePay()` answers to the CFO, `reportHours()` to the COO, and `save()` to the CTO — one class, three actors. The count that matters is the number of people who can force an edit, not the number of injected dependencies.

For an aggregate repository, list who can force a change:

| Change | Actor | Where it should live |
| --- | --- | --- |
| The aggregate gains a field, rule, or child entity | Team that owns the aggregate | Aggregate + mapper |
| The table schema or query changes | Persistence/DBA | Repository implementation |
| Isolation level, retry, savepoint, timeout change | Platform/infrastructure | Unit of work |
| A use case changes which writes must commit together | Application/use-case owner | Application service |

If all four land in `PostgresOrderRepository`, that class answers to four actors. That is the SRP problem, and it is real.

But look at what causes it. It is not the presence of a `uow` dependency. Depending on an injected abstraction is normal; you do not change the class when the abstraction's implementation changes. The class gains a second reason to change only when it **decides when to begin and commit** — because the policy is now inside it, and a policy change forces an edit there.

So the dividing line is:

- Repository **accepts** a transaction context → it is a participant. One responsibility: persistence.
- Repository **starts and commits** a transaction → it is an orchestrator. It has persistence plus transaction policy.

A dependency on `UnitOfWork` is not automatically a violation. Calling `uow.transaction(...)` inside the repository *is* a policy decision, and that is what the decorator above extracts.

## SRP violation vs. collaborator

A common objection is: "the repository depends on a transaction abstraction, so it has an extra responsibility." But the application service depends on the same abstraction, and nobody calls that a violation. So the dependency cannot be the problem.

The difference is **whose job the collaborator is doing**:

| Class | Collaborator | What it does there | Verdict |
| --- | --- | --- | --- |
| Application service | `UnitOfWork` | Defines the use case's commit boundary | Aligned. Orchestration is the service's job. |
| Repository | `TransactionContext` parameter | Writes inside a boundary someone else chose | Aligned. Persistence participates. |
| Repository | `UnitOfWork` | Decides the commit boundary of a use case | Borrowed. A persistence class is making an orchestration decision. |

A **collaborator** is an object the class talks to. A **responsibility** is what the class is accountable for. They are not the same thing. A collaborator normally supports the class's single responsibility; it does not create one. But a collaborator can also be used to perform someone else's responsibility — and that is what adds a reason to change.

The test is not "does this class call a transaction?" It is:

> **Does the collaborator help this class do its own job, or does it take over a decision that belongs to another actor?**

That is Martin's actor question asked at the call site: the reason to change is the person who requested the decision, not the object that carries it out ([*The Single Responsibility Principle*](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html)).

A `ReportGenerator` that calls an injected `EmailSender` now generates and sends reports: two jobs. A `ReportDelivery` class whose whole purpose is delivery calls the same `EmailSender` and has one job. Identical dependency, different accountability. SRP follows the accountability, not the dependency.

### Two independent axes

The confusion comes from collapsing two questions:

|  | Decision belongs to this class | Decision belongs to another actor |
| --- | --- | --- |
| **Concrete detail** (Prisma, driver) | Fragile, but not an SRP problem by itself | Worst case: infrastructure coupling *and* borrowed policy |
| **Injected abstraction** (`UnitOfWork`) | Clean | **Still an SRP violation** |

This is the part worth remembering:

> **An abstraction hides the mechanics; it does not transfer ownership of the decision.**

That is an application of Martin's actor test rather than a separate rule: the abstraction changes the mechanism, while the actor test asks who is entitled to request the change.

Using `UnitOfWork` instead of `prisma.$transaction` buys you testability, a swappable implementation, and no hard dependency on Prisma. Those are real benefits. It does **not** make transaction policy the repository's responsibility if that policy belongs to the use case owner.

That is why the application service is different. Its single responsibility *is* use-case orchestration, and the commit boundary is part of that orchestration. There, `UnitOfWork` is a collaborator doing the class's own job. In the repository, the same collaborator is doing someone else's job.

### So is it acceptable?

Sometimes, yes — and it is better to say so than to pretend there is no trade-off:

- If one team owns the aggregate, its persistence, and its transaction policy, and those change together, calling `uow.transaction` inside a single-aggregate `save()` is a defensible pragmatic choice.
- It stays defensible only while the save is the whole unit of work, and only if the behavior is explicit and overridable.
- It stops being defensible when the repository is silently deciding the commit boundary for a use case that also writes an outbox row, a second aggregate, or anything else.

ABP Framework is a working example of the pragmatic variant: a repository method starts a transactional unit of work when none exists, but "if you call an application service method […] the repositories don't begin a new UOW, but participates to the current unit of work" ([ABP *Unit of Work* documentation](https://docs.abp.io/en/abp/latest/Unit-Of-Work)). The ambient application-service scope wins, so the default never overrides the use case.

The abstraction is not what makes it acceptable. **The absence of a second actor is.**

## Is three entities one transaction or three?

One aggregate is one unit. The fact that it spans three tables is an implementation detail:

```text
orders            (root)
order_lines       (child)
order_discounts   (child)
```

One `save(order)` → one transaction → three statements. Correct.

The dangerous shape is different:

```ts
await orderRepository.save(order);       // commits
await inventoryRepository.reserve(id);   // commits separately
```

Now there are two transactions. If the second fails, the first is durable. That is the problem the "no transaction in the repository" rule is trying to prevent. It is not prevented by removing transactions from `save(order)`; it is prevented by one unit of work spanning both calls.

That analysis assumes the entities belong to one aggregate. If they belong to two, the answer changes.

## What if the three entities belong to two aggregates?

A transaction that spans two aggregates is **usually a smell**. It does not make the aggregate concept meaningless — each aggregate still enforces its own invariants — but it suspends the *transaction boundary* that gives the aggregate much of its operational value. For that use case, the two aggregates behave as one unit: they share locks, failure modes, and commit timing. The consistency boundary is still in the model; the transaction boundary is no longer aligned with it.

Vaughn Vernon is direct about the default:

> "Both the referencing aggregate and the referenced aggregate must not be modified in the same transaction. Only one or the other may be modified in a single transaction."
>
> — [*Effective Aggregate Design Part II*](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_2.pdf), 2011

He goes further: "If you are modifying multiple instances in a single transaction, it may be a strong indication that your consistency boundaries are wrong." Martin Fowler's version is the one-liner: "Transactions should not cross aggregate boundaries" ([*DDD_Aggregate*](https://martinfowler.com/bliki/DDD_Aggregate.html)). Microsoft's tactical DDD guidance says the same in design terms: "Use eventual consistency across aggregates. When a business process spans multiple aggregates, use domain events rather than a single transaction" ([*Use Tactical DDD to Design Microservices*](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-domain-driven-design)).

### Why it is usually a smell

- **It re-couples independent lifecycles.** The aggregate boundary exists so two concepts can change, fail, and scale independently. A shared transaction couples them again for that use case.
- **It widens the lock.** Microsoft's warning is concrete: "When you combine them, you force unrelated updates to compete for the same locks" ([same guidance](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-domain-driven-design)). Wider locks mean more contention and more deadlock surface.
- **It merges failure modes.** A rollback in one aggregate now undoes work in the other, even when the business considers the two changes independent. The more aggregates in the transaction, the harder the failure is to reason about.
- **It blocks distribution.** Two aggregates in one database can share a local transaction today; the same two aggregates in different services or databases cannot. Microsoft puts it plainly: "In a distributed application, that approach doesn't work across boundaries" ([same guidance](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-domain-driven-design)). The design quietly assumes the aggregates will never be split.
- **It often hides a modeling question.** Either the rule really spans both aggregates — in which case the boundary may be wrong and the smallest set should be merged — or it can be eventual. Vernon says it "may be a strong indication that your consistency boundaries are wrong," and possibly "a missed modeling opportunity."

### When it can be acceptable

Not never. Vernon himself has a section called "Reasons To Break the Rules," listing UI convenience and batch operations, the lack of technical mechanisms for eventual consistency, imposed global transactions, and query performance ([same paper](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_2.pdf)).

In a relational database, Vladimir Khorikov argues that mutating more than one aggregate in one transaction is often less friction than pub/sub and still gives the same consistency guarantees ([*Crossing aggregate boundaries*](https://khorikov.org/posts/2022-06-13-crossing-aggregate-boundaries/)). That is a real counterweight. But notice what it does not say: it does not say a repository should own `SaveChanges()` — Khorikov says the opposite — and it does not make cross-aggregate atomicity free. It trades pub/sub complexity for lock scope and coupling.

The point is not that the rule is absolute. The point is that the exception must be **named, local, and deliberate** — not the default that happens because two repository calls shared a connection.

### If it is not acceptable, design the gap

Use a domain event, an outbox, or a saga. Vernon's rule for the asynchronous path is the same rule applied per step: "Each of the subscribers executes in a separate transaction, obeying the rule of aggregate to modify just one instance per transaction" ([same paper](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_2.pdf)). For the mechanics, see [Cross-aggregate transactions and rollback](cross-aggregate-transactions-and-rollback.md).

### Rule of thumb

**One aggregate per transaction by default.** If a use case needs two, ask in order:

1. Is the invariant real, or are these two rules that can be briefly inconsistent?
2. If it is real, is the boundary wrong? Merge only the smallest set that contains the invariant.
3. If it cannot be merged and cannot be eventual, make the shared transaction an explicit, documented exception in one place.
4. If it can be eventual, use domain events, an outbox, and idempotent handlers.

A cross-aggregate transaction does not "defeat the whole purpose" of the aggregate in the model. It defeats the purpose of the aggregate **as a transaction boundary** — which is the property that makes it operationally useful.

## Decision guide

Ask these in order:

1. **Does this call write exactly one aggregate?**
   - Yes: an atomic `save()` is correct. Implementing it with an internal transaction is acceptable if it is explicit, documented, and does not commit an outer transaction.
   - No: you need a unit of work, and you should question the boundary. See [Cross-aggregate transactions and rollback](cross-aggregate-transactions-and-rollback.md).

2. **Does the use case write anything else that must commit with the aggregate?**
   - Outbox event, audit row, idempotency key: pass the same transaction context.
   - Another aggregate: deliberate cross-aggregate transaction, or a saga.

3. **Will callers need to compose writes?**
   - Yes: repository accepts `tx`; the application service or a decorator owns the boundary.
   - No: a transaction-per-save default is fine, but make it overridable.

4. **Are there multiple data sources?**
   - A local transaction cannot span them. Use outbox plus a saga; do not pretend otherwise.

As a closing heuristic, Jovanović's rule is hard to improve: "If you find `BeginTransaction` in a controller or a repository today, move the boundary to the handler" ([*Where Do Transactions Belong in Clean Architecture?*](https://milanjovanovic.tech/blog/transactions-clean-architecture)).

## Common mistakes

- **Two repositories, two transactions.** Atomicity is assumed but not present.
- **Auto-commit ORM calls.** `repository.save()` or `SaveChanges()` silently commits per call; the second call is a second transaction. Milan Jovanović puts the consequence directly: "The moment a repository saves inside itself, the use case loses the ability to compose multiple changes into one atomic commit" ([*Where Do Transactions Belong in Clean Architecture?*](https://milanjovanovic.tech/blog/transactions-clean-architecture)).
- **Nested transactions without savepoints.** An inner rollback does not undo outer work; the application believes it does.
- **Repository calls `commit()`.** The caller can no longer add writes to the same unit.
- **Confusing "atomic aggregate write" with "transaction policy for the use case."** The first is the repository's contract; the second is orchestration.
- **Putting the repository inside the aggregate** to "keep the transaction close to the invariant." That is the much worse version of the same mistake. See [Repositories do not live in aggregates](repositories-do-not-live-in-aggregates.md).
- **Using a distributed transaction for a basic invariant.** Usually a sign the aggregate boundary is wrong.

## Summary

- The aggregate boundary defines the **scope** of atomicity. A unit of work defines **control** of it.
- A repository may write several tables for one aggregate. That is still one transaction and one unit of work.
- A **collaborator** is not a **responsibility**. The application service and the repository can depend on the same `UnitOfWork`; only one of them is doing its own job.
- An abstraction hides transaction mechanics. It does not move ownership of the commit decision.
- `save()` should be atomic per aggregate, but the repository should not decide the use case's commit boundary.
- Transaction-per-save is an acceptable **explicit default** for single-aggregate use cases; it is a bug when it silently makes two calls non-atomic.
- A transaction across two aggregates is usually a smell. It does not erase the aggregate, but it suspends the transaction boundary that makes the aggregate operationally useful.
- The default is one aggregate per transaction. If two aggregates genuinely need atomicity, merge the smallest set or make the exception explicit; otherwise design the gap with events, an outbox, or a saga.
- SRP counts **actors**, not dependencies. Accepting an injected transaction abstraction is fine; deciding when to begin and commit is a second responsibility.
- A transactional decorator or a unit of work keeps mapping and transaction policy in separate classes.
- Three entities in one aggregate are one transaction. Two repositories without a shared unit of work are two.

## See also

- [Repositories do not live in aggregates](repositories-do-not-live-in-aggregates.md)
- [God aggregates and transaction boundaries](god-aggregates-and-transaction-boundaries.md)
- [Cross-aggregate transactions and rollback](cross-aggregate-transactions-and-rollback.md)
- [Aggregate root IDs and foreign keys](aggregate-root-ids-and-foreign-keys.md)
- [Repositories](../../fundamentals/08-repositories/README.md)
- [Aggregates](../../fundamentals/07-aggregates/README.md)
- [Outbox pattern](../../architecture/01c-outbox-pattern.md)
