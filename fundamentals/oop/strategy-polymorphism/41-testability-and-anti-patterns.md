# Testability and anti-patterns

*Testability is not a virtue in itself. It is a probe: a unit that is hard to test is usually a
unit whose inputs and effects are not in its signature. The ugly test is the symptom; the missing
seam is the cause.*

[Pure vs impure functions]( showed where the split is. This note is about the
feedback: what a hard test is telling you about the code, and the anti-patterns that make the test
hard in the first place.

## Impurity travels through calls

```ts
function isExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() <= Date.now();
}

function canCheckout(cart: Cart): boolean {
  return cart.items.every((item) => !isExpired(item.reservedUntil));
}
```

`canCheckout` looks pure: one argument in, a boolean out. It is not. Its answer depends on the
clock, through `isExpired`. Call it twice a second apart and it can return different values.

A test has to reach outside the function to control that:

```ts
jest.useFakeTimers().setSystemTime(new Date("2026-01-01T00:00:00Z"));
expect(canCheckout(cart)).toBe(true);
jest.useRealTimers();
```

The fake timer replaces the global `Date`. It leaks into every test that runs after it, and it has
to be restored. The test is not badly written — it is reporting a fact about the code: **`now` is an
input the function did not declare.**

Move it into the signature and the impurity becomes an argument:

```ts
function isExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

function canCheckout(cart: Cart, now: Date): boolean {
  return cart.items.every((item) => !isExpired(item.reservedUntil, now));
}
```

The impurity has not disappeared. `new Date()` still has to be called somewhere; it moves to the
edge, where one caller supplies it. That is the seam from [Seams](40-seam.md), and the test no
longer needs a global.

Impurity at the edge is fine — it is the only place that should have it. The problem is impurity
in the middle: a function that hides the call and makes every caller pay for it.

## The test setup is a dependency list

Every line a test spends preparing the world — `new PostgresDb(...)`, `jest.mock("./mailer")`, a
`beforeEach` reset, a `sleep(100)`, an assertion on a mock — is a dependency the production code
did not ask for. None of these is a testing problem first; each is a design fact the test is making
visible.

## Anti-patterns

### Work in the constructor

```ts
class ReportService {
  private readonly db = new PostgresDb(process.env.DATABASE_URL!);

  async monthly(accountId: string): Promise<Report> {
    const rows = await this.db.query("...", [accountId]);
    return buildReport(rows);
  }
}
```

Constructing the service opens a connection. Every test that needs a `ReportService` needs a
database, or a module mock, or a patched constructor. The Google testability guide calls this
**"Constructor does Real Work"** and says it "removes seams needed for testing." Its warning signs
are worth memorizing: `new` in a constructor or field declaration, static calls there, anything
more than assignment, and control flow in a constructor.

Wiring and work are in the same place, so the test cannot get at one without the other.

### A hard-coded path to an effect

The same problem appears in a method:

```ts
class InvoiceReport {
  render(rows: Row[]): string {
    return new CsvExporter().export(rows);
  }
}
```

There is no constructor to fix and no field to swap. The collaborator is created and discarded on
each call. Static calls have the same shape with no object at all: `Date.now()`,
`RPCClient.getInstance()`. So does an imported function, like `sendEmail(...)` at the top of the
file. The guide's wording is exact: "Static methods remove a seam from your test code."

This is [Coupling to a concretion](39-coupling-to-concretion.md) seen from the test side.

### Global state

```ts
let currentUser: User | undefined;

export function setCurrentUser(user: User): void {
  currentUser = user;
}
```

A test sets the user; the next test inherits it. Run the suite in a different order and it fails.
The Google guide is blunt: "Global State and Singletons make APIs lie about their true
dependencies" and "Global state is the single biggest headache of unit testing!" The API looks like
it takes no input; the input is the module's hidden variable.

`process.env` read at import time is the Node version of the same thing: the value is fixed before
any test can choose it, and changing it means re-importing the module.

### The module mock

When there is no object seam, the module boundary is the next best opening:

```ts
jest.mock("./mailer");
import { sendEmail } from "./mailer";

test("sends a receipt", async () => {
  await pay(order);
  expect(sendEmail).toHaveBeenCalledWith(order.email, "paid");
});
```

This is a **link seam**, not an object seam: it substitutes the import, not a collaborator the code
asked for. It works, and for third-party modules or legacy code it is often the only option. But
the test now knows the file path and the export name. Move `sendEmail` behind a `Notifier` and the
mock has to move with it. If every test in the suite needs `jest.mock`, the production code has no
seam of its own.

### Asserting the implementation

A mock makes it possible to test an effect that returns nothing:

```ts
expect(mailer.send).toHaveBeenCalledWith(order.email, "paid");
```

The assertion is about *how* the result was produced, not what the result is. Change the code to
send the same email through a different call and the test fails while the behavior is unchanged.
Fowler's warning about mockist tests is direct: "Mockist tests are thus more coupled to the
implementation of a method. Changing the nature of calls to collaborators usually cause a mockist
test to break."

The fix is not "never mock." Split the decision from the effect. The decision — what to send — can
be a pure function that returns a value:

```ts
type Receipt = { to: string; body: string };

function receiptFor(order: Order): Receipt {
  const total = order.items.reduce((sum, item) => sum + item.price, 0);
  return { to: order.email, body: `Total: ${total}` };
}

async function pay(order: Order, mailer: Mailer): Promise<Receipt> {
  const receipt = receiptFor(order);           // decision: pure, returns a value
  await mailer.send(receipt.to, receipt.body); // effect: at the edge
  return receipt;
}
```

The price rule is now tested with no mock, straight from input to output:

```ts
test("the receipt totals the items", () => {
  expect(receiptFor(order)).toEqual({ to: "a@b.com", body: "Total: 30" });
});
```

`mailer` is a fake only because SMTP is awkward to call, and it stands in for that collaborator,
not for the design. To check `pay`, assert what the fake recorded rather than that a method was
called:

```ts
const mailer = new RecordingMailer(); // a fake: it records, it does not assert
await pay(order, mailer);
expect(mailer.sent).toEqual([{ to: "a@b.com", body: "Total: 30" }]);
```

That is state verification instead of behavior verification — Fowler's distinction again — and it
survives a change to *how* the receipt is delivered. The functional core is from
[Pure vs impure functions](; this is the same seam as [Seams](40-seam.md),
applied to the output side.

## When the signal is wrong

Not every hard test is a design flaw. A controller is an integration point: it parses a request,
calls the domain, and writes a response. Unit-testing it means mocking the framework, the request,
and the session — a lot of work to test very little.

DHH makes this case in *Test-induced design damage*: the maxim that "code that's hard to test in
isolation is poorly designed" is "some times true," but it is "a far ways off from declaring that
hard-to-unit-test code is always poorly designed." His rule is the corrective:

> Above all, you do not let your tests drive your design, you let your design drive your tests!

The distinction that keeps both ideas: **is this hard to control at any level, or only when it is
isolated from its real collaborators?**

- A hidden clock is hard to control everywhere. It is a missing seam.
- A controller is hard to *unit* test but easy to test through its endpoint. It is the wrong test
  level, not a broken design.

## Symptom → missing seam

| Test smell | What it usually means | The seam |
| --- | --- | --- |
| `jest.useFakeTimers()` / `sleep` | the clock is an undeclared input | a `now` or `clock` parameter |
| `new RealService()` in setup | construction does the wiring | pass the collaborator in |
| `beforeEach` resets a module value | shared mutable state | pass the instance |
| `jest.mock("./x")` everywhere | the import is the only opening | a parameter at the boundary |
| `expect(mock).toHaveBeenCalled` | the effect has no return value | move the decision into a return value |

## One-line summary

**Impurity is not the anti-pattern; an impure input or effect with no seam is. A test that needs
fake timers, module mocks, or a global reset is showing you which dependency the code failed to ask
for.**

## References

- Miško Hevery, Jonathan Wolter, Russ Ruffer — *Guide: Writing Testable Code* (Google Testing
  Blog, 26 Nov 2008) — <https://testing.googleblog.com/2008/11/guide-to-writing-testable-code.html>
  — "Constructor does Real Work", "Brittle Global State & Singletons", and the seam quotes
- David Heinemeier Hansson — *Test-induced design damage* (29 Apr 2014) —
  <https://dhh.dk/2014/test-induced-design-damage.html>
- Martin Fowler — *Mocks Aren't Stubs* (2 Jan 2007) —
  <https://martinfowler.com/articles/mocksArentStubs.html> — behavior verification and its
  coupling
- Michael Feathers — *Working Effectively with Legacy Code* (2004), ch. 4 — via
  [Seams](40-seam.md)
- This repo — [Pure vs impure functions](, [Coupling to a
  concretion](39-coupling-to-concretion.md)
