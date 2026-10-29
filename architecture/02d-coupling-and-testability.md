# 02d — Coupling and testability

*Coupling decides whether your code has a place to cut. A **seam** is that place: a dependency you can replace without editing the code under test.*

This note uses one order workflow twice. The first version constructs its own database, payment client, and mailer. The second receives them. The behavior is the same; what changes is whether the failure paths can be tested at all.

The runnable proof is [`order-service.test.ts`](02d-coupling-and-testability/order-service.test.ts):

```sh
node --test architecture/02d-coupling-and-testability/order-service.test.ts
```

## The code that can't be tested

```ts
class PlaceOrderService {
  placeOrder(orderId: string, cardToken: string): void {
    const db = new PostgresConnection("postgres://prod-db:5432/orders");
    const order = db.query("SELECT * FROM orders WHERE id = $1", [orderId]);

    const stripe = new StripeClient(process.env.STRIPE_KEY!);
    stripe.charge(cardToken, order.totalCents);

    const mailer = new SmtpMailer("smtp.company.com");
    mailer.send(order.customerEmail, "Your order is confirmed");

    db.query("UPDATE orders SET status = 'paid' WHERE id = $1", [orderId]);
  }
}
```

How do you test "the order gets marked paid"? You need a Postgres server, a real Stripe key, and an SMTP server. Running the test can charge a real card. It is slow, it needs secrets, and it fails for reasons unrelated to your logic.

The more important problem is what you **cannot** test: the interesting paths. What happens if the charge fails? Does the order stay unpaid? To find out, you would have to make Stripe fail on purpose — and there is no seam that lets you do that.

**Why it is untestable:** the method is glued to three concrete things *and creates them itself*. Nothing can be swapped out.

## The same logic, with seams

```ts
interface OrderRepo {
  find(id: string): Order;
  markPaid(id: string): void;
}

interface Payments {
  charge(token: string, cents: number): void;
}

interface Notifier {
  sendOrderConfirmation(order: Order): void;
}

class PlaceOrderService {
  readonly #repo: OrderRepo;
  readonly #payments: Payments;
  readonly #notifier: Notifier;

  constructor(repo: OrderRepo, payments: Payments, notifier: Notifier) {
    this.#repo = repo;
    this.#payments = payments;
    this.#notifier = notifier;
  }

  placeOrder(orderId: string, cardToken: string): void {
    const order = this.#repo.find(orderId);
    this.#payments.charge(cardToken, order.totalCents);
    this.#repo.markPaid(orderId);
    this.#notifier.sendOrderConfirmation(order);
  }
}
```

Same behavior. But the dependencies arrive from outside, so a test can hand it stand-ins. The stand-ins are ordinary classes; you do not need a mocking framework:

```ts
test("marks the order paid after charging", () => {
  const repo = new FakeRepo([{ id: "1", totalCents: 500, customerEmail: "a@b.c" }]);
  const service = new PlaceOrderService(repo, new FakePayments(), new FakeNotifier());

  service.placeOrder("1", "tok_test");

  assert.equal(repo.statusOf("1"), "paid");
});

test("does not mark paid if the charge fails", () => {
  const repo = new FakeRepo([{ id: "1", totalCents: 500, customerEmail: "a@b.c" }]);
  const payments = new FakePayments();
  payments.failNext("card declined");
  const service = new PlaceOrderService(repo, payments, new FakeNotifier());

  assert.throws(() => service.placeOrder("1", "tok_test"), /card declined/);
  assert.equal(repo.statusOf("1"), "pending");
});
```

Two things just changed. The tests run in microseconds with no network. And the second test — the one that matters, the failure case — became **possible**. It was not possible before.

That is the real payoff of loose coupling: not just faster tests, but tests you could not write at all.

## The other direction: tests that assert the wiring

Loose coupling can be taken too far. This test passes, but it is a trap:

```ts
service.placeOrder("1", "tok_test");

expect(payments.charge).toHaveBeenCalledWith("tok_test", 500);
expect(repo.markPaid).toHaveBeenCalledWith("1");
expect(notifier.sendOrderConfirmation).toHaveBeenCalledTimes(1);
```

It asserts **how** the code is written, not **what** it achieves. Batch the two database calls, add a retry around the charge, or reorder two independent steps — the behavior is still correct, but the test goes red in three places. You end up maintaining the test against refactors instead of using it to catch bugs.

The fix is not "fewer seams." It is **assert on outcomes, not internal call sequences**. `assert.equal(repo.statusOf("1"), "paid")` survives any refactor that preserves the behavior.

Interaction assertions are not always wrong. They are appropriate when the interaction *is* the behavior: the shape of an outbound HTTP request, a published event, a payment API call, a protocol contract. The trap is asserting the private choreography between your own objects.

## Coupling is not the enemy — coupling to *volatile* things is

You are coupled to `Math.round` and `Array.prototype.map` all day. It never hurts. They are stable, they need no network, and they do not fail at 2 a.m. You do not fake them.

The coupling that wrecks testability is coupling to things that are **volatile**:

- databases and queues;
- HTTP APIs and third-party SDKs;
- the wall clock and random numbers;
- the filesystem and the environment;
- UI frameworks and process globals.

The rule is not "decouple everything." It is: **put seams at the volatile edges and leave the stable interior tightly knit.** A value object calling another value object is fine. A service constructing a `StripeClient` is not.

## Three more forms of coupling that bite

### Hidden dependency: the clock

```ts
generateMonthlyReport() {
  const now = new Date(); // invisible input
  // ...
}
```

You cannot test "what happens on the last day of the month" without waiting until the last day of the month. Pass `now: Date` (or a `Clock`) and the behavior becomes ordinary input.

### Reaching through object graphs

```ts
if (order.getCustomer().getAddress().getCountry() === "DE") {
  addVat(order);
}
```

To test this VAT rule you must build an order, then a customer, then an address. Every time the rule needs another field, every test's setup grows. You are coupled to **structure**. Extract a pure function — `vatRateFor(country: string)` — and test it with a string.

### Temporal coupling

```ts
const service = new OrderService();
service.init(); // forget this and get a confusing runtime error later
service.run();
```

Every test now has to remember the ritual, and forgetting it produces a failure far from the cause. Do the setup in the constructor, or expose a factory that returns an object that is already ready.

## The short version

| Symptom in the test | What is coupled | Fix |
| --- | --- | --- |
| Needs a real DB, API, or SMTP server | Method constructs its own dependency | Inject it through the constructor |
| Cannot test the failure path | No seam to make the dependency fail | Inject it, then fake the failure |
| Breaks on refactors that preserve behavior | Test asserts call order | Assert on end state |
| Fails only on certain dates | Hidden `new Date()` | Pass a `Clock` or `now` |
| Huge setup to reach one field | Reaching through object graphs | Pass the value, or extract a pure function |
| Fails mysteriously when calls are reordered | Temporal coupling | Construct ready-to-use objects |

## What this is not

- **Not "inject everything."** Stable values and pure functions do not need a seam. Over-injection makes the graph harder to read and can hide a simple calculation behind three interfaces.
- **Not "mock everything."** Prefer a small fake that behaves like the real thing over a mock that records calls. The fake lets you assert outcomes; the mock often locks in the implementation.
- **Not "zero coupling."** Some coupling is necessary. The question is whether it is explicit, stable, and pointed in a direction you can change.
- **Not "a container is required."** Constructor parameters and a composition root are enough. A DI container is optional automation, not the pattern.
- **Not "all interaction tests are bad."** Assert the interaction when the interaction is the contract. Do not assert private choreography.

## Questions to ask

- Does this code need a real database, network, clock, or filesystem to run?
- Which dependency is volatile, and where is its seam?
- Can I make the dependency fail in a test without editing the code under test?
- Does the test assert an outcome, or does it assert the internal call sequence?
- Is the dependency injected as a contract, or constructed as a concretion?
- Is the seam owned by the code that needs it, or shaped by the vendor?
- Am I injecting a stable value that should just be passed or computed?
- Does the test survive a refactor that preserves behavior?

## Sources

- Michael Feathers, *Working Effectively with Legacy Code* (2004), chapter 4 — the definition of a seam and the distinction between object seams and link seams.
- Martin Fowler, [*Mocks Aren't Stubs*](https://martinfowler.com/articles/mocksArentStubs.html) (2007) and [*Test Double*](https://martinfowler.com/bliki/TestDouble.html) — fakes, stubs, mocks, and the difference between state and interaction verification.
- Gerard Meszaros, *xUnit Test Patterns* (2007) — test doubles, fixtures, and the costs of brittle tests.
- Mark Seemann, [*Composition Root*](https://blog.ploeh.dk/2011/07/28/CompositionRoot/) (2011) — where concrete choices belong.
- Parnas, [*On the Criteria To Be Used in Decomposing Systems into Modules*](https://www.cs.colostate.edu/~france/CS314/Readings/Parnas-decomposition.pdf) (1972) — information hiding and change-based boundaries.
- This repository — [What coupling is](../fundamentals/oop/00-what-is-coupling.md), [Seam](../fundamentals/oop/strategy-polymorphism/40-seam.md), [Testability and anti-patterns](../fundamentals/oop/strategy-polymorphism/41-testability-and-anti-patterns.md), [Hexagonal architecture](02b-hexagonal-architecture.md#testing-both-sides-of-the-port).

## Next

- [02b — Hexagonal architecture](02b-hexagonal-architecture.md) — the full ports-and-adapters version of the same seam.
- [02c — One request, end to end](02c-end-to-end-slice.md) — the same order workflow with ports, an aggregate, and a composition root.
- [06 — Composition root](../fundamentals/oop/design-patterns/06-composition-root/composition-root.md) — where the concrete choices are made.
- [Trade-offs](tradeoffs.md#the-matrix) — the matrix this decision belongs to.
