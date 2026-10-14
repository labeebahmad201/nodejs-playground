# Domain services

*A **domain service** is an operation of the domain that doesn't naturally belong to any single
entity or value object — it needs several of them, or a piece of domain knowledge that isn't any
one object's job. It's still **domain logic**: stateless, expressed in the language of the business.*

Part of the language-agnostic [`fundamentals/`](../) track. Compare with the infrastructure
collaborators in `06-collaborators`.

## The problem it solves

Sometimes a business operation is real domain behavior, but it fits nowhere:

- It spans **multiple** entities/value objects (`transfer money from A to B`).
- It's a rule about the domain itself, not about one object's data.
- Putting it on one entity would give that entity knowledge of others it shouldn't have.

That's exactly what a domain service is for.

```ts
// Not natural on Account from OR to — it needs both.
class TransferService {
  transfer(from: Account, to: Account, amount: Money): void {
    if (from.balance.lessThan(amount)) throw new InsufficientFundsError();
    from.withdraw(amount);
    to.deposit(amount);
  }
}
```

`Account` owns its own `withdraw`/`deposit` rules; the *coordination* across two accounts is the
domain service's job.

## Key traits

| Trait | Meaning |
| --- | --- |
| **Stateless** | no instance data — it's a set of operations |
| **Domain logic** | uses the ubiquitous language, holds business rules |
| **Cross-object** | concerns several entities/value objects |
| **Named on purpose** | if you can't name it without "helper/manager/util", it's probably not one |
| **Not infrastructure** | it doesn't talk to the DB/HTTP itself — that's a collaborator |

## Three kinds of service (don't mix them)

| Service | Contains | Example |
| --- | --- | --- |
| **Domain service** | domain rules spanning objects | `TransferService`, `PricingService` |
| **Application service** | orchestration / a use case | `PlaceOrderHandler` (load → call domain → save → publish) |
| **Infrastructure service** | technical capability | `SmtpMailer`, `PostgresRepo`, `Clock` |

A domain service holds **business rules**; an application service just **orchestrates** (fetch,
invoke domain, persist, publish) and holds no domain logic. Distinguishing them keeps rules in the
model and I/O at the edges.

```ts
// Application service: orchestration only.
class PlaceOrderHandler {
  constructor(private orders: OrderRepository, private pricing: PricingService) {}

  async handle(cmd: PlaceOrder) {
    const order = new Order(cmd.id);
    for (const line of cmd.lines) order.addLine(line.sku, line.price, line.qty);
    order.total = this.pricing.price(order);   // domain service does the thinking
    await this.orders.save(order);             // collaborate with infra
  }
}
```

## When to create one

Ask, in order:

1. Does it belong on a single entity or value object? → put it there.
2. Does it need several domain objects? → **domain service**.
3. Does it just load, call, save, publish? → **application service**.

Reaching for a domain service first, when the logic actually belongs on an entity, is a common
mistake — it leads to the **anemic domain model** (`05-entities`).

## Guidance

- **Stateless.** If it holds state, it's probably an entity or a poorly placed service.
- **Operate on domain objects, don't own them.** Take entities/value objects as parameters; don't
  store them.
- **Name it in the ubiquitous language** — `TransferService`, not `AccountHelper`.
- **Keep I/O out.** A domain service should be testable without a database; collaborators are
  injected only when genuinely needed (e.g. a domain clock).
- **Prefer a value object or entity if it fits.** A service is the fallback, not the default.

## Pitfalls

- **Service explosion / logic leakage.** "Services" that actually hold an entity's own rules produce
  an anemic model and scatter behavior.
- **Fat application services.** Application services that accumulate business rules should push them
  down into entities/value objects/domain services.
- **Stateless-ness violated.** A "service" with mutable fields is hiding an entity.
- **Infrastructure in disguise.** A domain service that opens a DB connection is really an
  infrastructure service.

## One-line summary

**A domain service is a stateless operation that expresses a domain rule spanning several
entities/value objects — genuine business logic that doesn't fit on any one object — as opposed to
an application service that merely orchestrates a use case or an infrastructure service that
provides a technical capability.**

## References

- Eric Evans — *Domain-Driven Design* (2003), ch. 5 "A Model Expressed in Software" (Services)
- Martin Fowler — *AnemicDomainModel* — <https://martinfowler.com/bliki/AnemicDomainModel.html>
- Martin Fowler — *Service Layer* (PoEAA) — <https://martinfowler.com/eaaCatalog/serviceLayer.html>
- Related: `05-entities`, `06-collaborators`, `04-value-objects`
