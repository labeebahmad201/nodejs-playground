# 08 — Testing the composition root

*The composition root is allowed to know concretions. You do not test it by mocking every
constructor; you test the edge by running it.*

## The problem

A composition root is the one place that says:

```ts
const orders = new PostgresOrderRepository(db);
const mailer = new SmtpMailer(config.smtp);
const service = new OrderService(orders, mailer, new SystemClock());
```

A test that mocks every constructor and asserts the exact order of those `new` calls is brittle. It
duplicates the root, breaks whenever the wiring changes, and still does not prove that the
application works.

The root is not where the interesting logic lives. It is where the concrete choices are made. The
coupling to those concretions is deliberate; the test's job is to exercise that coupling, not to
erase it.

## The move: separate composing from running

Do not unit-test `main()`. Extract the graph-building part:

```ts
// composition.ts
export interface App {
  service: OrderService;
  orders: InMemoryOrderRepository;
  mailer: ConsoleMailer;
}

export function composeApplication(): App {
  const orders = new InMemoryOrderRepository();
  const mailer = new ConsoleMailer();
  const clock = new SystemClock();
  const service = new OrderService(orders, mailer, clock);

  return { service, orders, mailer };
}
```

```ts
// main.ts
import { composeApplication } from "./composition.ts";

const app = composeApplication();
await app.service.placeOrder("ada@example.com", 42);
```

Now `main()` is a thin shell: read configuration, call `composeApplication`, start the application,
handle shutdown. The test can call `composeApplication` without opening a port, reading the real
environment, or calling `process.exit()`.

This is the practical form of the **Humble Object** pattern: keep the hard-to-test boundary so simple
that it has almost nothing to test, and put the logic somewhere testable.

## Test 1: the production root builds a working graph

Call the real `composeApplication` and use the graph:

```ts
test("the production composition root builds a working graph", async () => {
  const app = composeApplication();

  const order = await app.service.placeOrder("ada@example.com", 42);

  assert.equal(order.total, 42);
  assert.equal(app.orders.all().length, 1);
  assert.equal(app.mailer.sent.length, 1);
});
```

This is a **composition smoke test**. It proves:

- the root can build the graph;
- the constructor parameters line up;
- the assembled objects can do useful work together.

Most composition-root tests are integration tests. That is appropriate: the root is an integration
point. It does not prove every business rule; those rules are tested below the root.

## Test 2: a test composition root for application behavior

A test composition root is a separate wiring function used only by tests:

```ts
function composeTestApplication() {
  const orders = new RecordingOrderRepository();
  const mailer = new RecordingMailer();
  const clock = new FixedClock(new Date("2026-01-01T00:00:00Z"));
  const service = new OrderService(orders, mailer, clock);

  return { service, orders, mailer };
}
```

```ts
test("a test composition root gives deterministic fakes", async () => {
  const app = composeTestApplication();

  const order = await app.service.placeOrder("test@example.com", 10);

  assert.equal(order.placedAt.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(app.orders.all().length, 1);
  assert.equal(app.mailer.sent.length, 1);
});
```

This proves the application logic works with controlled inputs. It does **not** prove that the
production composition root is wired correctly. They are different tests:

| Test | What it proves |
| --- | --- |
| Production root test | The real root builds a usable graph. |
| Test composition root | The application logic works with fakes. |
| Entry-point integration test | A real request/CLI run works through the real root. |

Do not call a test with all fakes “a test of the production composition root.” It is a test of the
test root.

## Is there a generic pattern here?

Yes, but it is a combination rather than one named “testing the composition root” pattern:

| Pattern | Role |
| --- | --- |
| **Composition Root** | Keeps all concrete wiring at the application edge. |
| **Humble Object** | Keeps the edge too simple to justify line-by-line unit tests. |
| **Test-specific composition root** | Wires fakes for application tests. |
| **Test Double** | Replaces an external adapter with a controllable fake. |
| **Contract Test** | Proves that a real adapter satisfies its interface. |

The composition root itself is the Humble Object. The logic below it is tested normally. The root
is tested by composition and integration tests.

## What else is worth testing

| Concern | How to test it |
| --- | --- |
| **Configuration** | `loadConfig` with missing/invalid values should fail fast. |
| **Adapter contracts** | Run the same contract test against `PostgresOrderRepository` and the in-memory fake. |
| **Container registrations** | Resolve every entry point at startup; validate the graph before serving traffic. |
| **Lifetimes** | Resolve twice and assert identity or scope behavior. |
| **Disposal** | Call `app.close()` and assert the connection/resource is closed. |
| **Entry point** | One integration test through the real HTTP/CLI/queue boundary. |

The contract test is the part people skip. The root chooses `PostgresOrderRepository` because
something proves that it actually behaves like an `OrderRepository`.

## What not to do

- Do not mock every constructor and assert the exact `new` sequence.
- Do not assert private fields with `instanceof` to prove the root chose a class.
- Do not inject the container into `OrderService` just to make the root testable.
- Do not use the production root for every unit test; use a test composition root for that.
- Do not add a `NODE_ENV === "test"` branch to production wiring; pass test adapters through configuration instead.
- Do not treat “the app starts” as a substitute for testing the behavior below the root.

## What about Jest module mocks?

Jest can replace the concrete modules the root imports:

```ts
jest.mock("./infrastructure", () => ({
  PostgresOrderRepository: jest.fn(() => ({ save: jest.fn() })),
  SmtpMailer: jest.fn(() => ({ send: jest.fn() })),
  SystemClock: jest.fn(() => ({ now: () => new Date("2026-01-01") })),
}));
```

This is possible, and it feels easy because the root can be called without real infrastructure.
But it tests that the root called those constructors, not that the application works. It breaks when
the wiring changes, and it never exercises the real adapters.

Use a module mock only for a narrow legacy seam or a framework integration. For the root, prefer a
test configuration with test infrastructure, or a test composition root with fakes. If the root
contains a real selection rule, extract that rule into a small factory and test it directly. In ESM,
Jest uses `jest.unstable_mockModule` plus a dynamic import; the trade-off is the same.

## Run the example

The example lives in this folder:

- `composition.ts` — the production root.
- `composition.test.ts` — the production-root smoke test and the test composition root.
- `test-doubles.ts` — `RecordingOrderRepository`, `RecordingMailer`, `FixedClock`.
- `main.ts` — the thin shell.

Run the tests:

```sh
node --test fundamentals/oop/design-patterns/08-testing-composition-root/composition.test.ts
```

Run the application:

```sh
node fundamentals/oop/design-patterns/08-testing-composition-root/main.ts
```

The test output ends with three passing tests:

```text
✔ the production composition root builds a working graph
✔ each call to the root builds a fresh graph
✔ a test composition root gives deterministic fakes
```

## One-line summary

> **Test the root by building the real graph; test the logic by building a test graph. Never test the
> root by mocking every `new`.**

## References

- Mark Seemann — *Composition Root* (2011) —
  <https://blog.ploeh.dk/2011/07/28/CompositionRoot/>
- Gerard Meszaros — *xUnit Test Patterns* (2007) — Humble Object and Test Double
- Martin Fowler — *Test Double* —
  <https://martinfowler.com/bliki/TestDouble.html>
- Martin Fowler — *Contract Test* —
  <https://martinfowler.com/bliki/ContractTest.html>
- Node.js — *Test runner* —
  <https://nodejs.org/api/test.html>

Related notes:

- [Composition root](../06-composition-root/composition-root.md) — what the root is and why it
  knows concretions.
- [Dependency injection container](../07-dependency-injection-container/dependency-injection-container.md)
  — how a container changes the root and what it adds to test.
