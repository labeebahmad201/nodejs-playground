# Hexagonal architecture — 31 nuances in code

*Companion to [02b — Hexagonal architecture](02b-hexagonal-architecture.md). Each section has the rule, the correct code, the anti-pattern, and a short proof. The runnable versions live in [02b-hexagonal-example](02b-hexagonal-example/README.md); start with [`00-end-to-end.ts`](02b-hexagonal-example/nuances/00-end-to-end.ts) to see one registration through every role.*

> This is a catalog, not a complete application. Read one section at a time. The snippets are deliberately small; the lab has the full types, wiring, and tests.

**Conventions.** Every proof assumes `test` from `node:test`, `assert` from `node:assert/strict`, and Node 24's native TypeScript support. `User` is `{ id, email }` unless a section adds fields. Ports are named after the need — `Users`, `WelcomeNotifier`, `OrderReports` — and the adapters are named after the technology. The vocabulary is defined in [Appendix A](#appendix-a-the-vocabulary).

**Scope.** Hexagonal is a rule about the I/O boundary: the inside owns the contracts, the outside implements them, and source dependencies point inward. It is not a decomposition of the inside. Sections 25–31 are about the boundaries that hexagonal does *not* give you, and the cost of enforcing the ones it does.

## TL;DR — Judgment notes

*The short version. Each note links to the section that earns it.*

> **The one that changes the most designs:** a port is a contract owned by the inside, not an interface owned by the database. The import arrow is the architecture; the folder name is not. [Details](#01-inside-vs-outside)

**The rule and the shape**

- **The dependency rule is the import graph.** A `ports/` folder with `domain → adapters` is a costume. [Details](#01-inside-vs-outside)
- **Driving and driven ports mirror each other.** One is what the application offers, the other what it needs; both are defined inside. [Details](#02-driving-vs-driven-ports)
- **A port is not an interface.** Driving adapters can depend on a concrete use case. An interface with one implementation and no buyer is ceremony. [Details](#03-a-port-is-not-an-interface)
- **Runtime calls go outward; source dependencies go inward.** Confusing the two produces "the domain calls the database, so it depends on it." [Details](#04-call-direction-is-not-dependency-direction)
- **Domain objects may cross; rows, vendor SDK types, and HTTP DTOs may not.** [Details](#05-what-crosses-the-port)

**Port design**

- **Name the port after the question, not the query or the vendor.** [Details](#06-name-the-port-for-the-need)
- **Split the domain port from the read port.** They change for different reasons. [Details](#07-domain-port-vs-read-port)
- **State the event, not the channel.** `welcome(user)` survives a move from email to a queue; `send(to, subject, body)` does not. [Details](#08-do-not-mirror-the-vendor)
- **Errors are part of the contract.** Translate the driver's error at the adapter. [Details](#09-the-error-contract)
- **One port per capability the application needs**, not one per table and not one god port. [Details](#10-port-granularity)
- **The input port takes a command, not the HTTP request.** Shape at the edge, meaning inside. [Details](#11-the-input-ports-shape)

**Placement**

- **The aggregate owns what it can see; the domain service owns rules that cross objects; the application service owns the sequence.** A "service" injected into an entity is a boundary error. [Details](#31-where-the-services-live)
- **A vendor client is an adapter, even when it is called a service.** [Details](#30-the-framework-belongs-at-the-edge)

**Consistency and effects**

- **Only the composition root constructs concretes.** [Details](#12-the-composition-root)
- **The application owns the transaction; the repository participates and never commits.** [Details](#13-who-owns-the-transaction)
- **External calls happen after the commit**, through an outbox or a durable queue. [Details](#14-external-calls-outside-the-transaction)
- **Retries make idempotency a port concern**, not a caller's hope. [Details](#15-idempotency-at-the-port)
- **Time and identity are driven ports.** `new Date()` in the core is a hidden collaborator. [Details](#16-time-and-identity-are-driven-ports)

**Mapping**

- **Two-way mapping follows from the dependency rule, not from taste.** A plain domain type, a row type, and a mapper in the adapter; neither single-model shortcut survives. [Details](#17-two-way-mapping)
- **A round-trip must preserve meaning**: absence, units, instants, and enums. [Details](#18-mapping-loss)
- **The persistence model must not escape the adapter.** Detach the aggregate before the session closes. [Details](#19-the-persistence-model-must-not-escape)
- **Map once, at each edge.** Two mapping hops silently drop fields. [Details](#20-map-once-at-the-boundary)

**Testing**

- **Test the core with fakes and no I/O.** [Details](#21-test-the-core-with-fakes)
- **A fake must model the contract's failures**, or it certifies a bug. [Details](#22-fake-fidelity)
- **Test each adapter in isolation**, against the real dependency. [Details](#23-test-the-adapters-in-isolation)
- **One contract suite, every provider.** [Details](#24-one-contract-suite-every-provider)

**Enforcement and evolution**

- **The module is the enforcement.** A folder convention is not a boundary. [Details](#25-the-module-is-the-enforcement)
- **One hexagon is not a decomposition.** It can be a mud inside. [Details](#26-one-giant-hexagon)
- **Migrate behind a port, one use case at a time.** Do not rewrite and double-write. [Details](#27-migrating-incrementally)
- **A port must earn its keep**, and a port that no longer earns it should be deleted. [Details](#28-when-to-remove-a-port)
- **The module split has a fixed cost.** Split when the module has something to hide. [Details](#29-the-cost-of-the-module-split)
- **The framework belongs at the edge.** The core is plain, not framework-hostile. [Details](#30-the-framework-belongs-at-the-edge)

## Contents

### A. The rule and the shape

- [01. Inside vs. outside](#01-inside-vs-outside)
- [02. Driving vs. driven ports](#02-driving-vs-driven-ports)
- [03. A port is not an interface](#03-a-port-is-not-an-interface)
- [04. Call direction is not dependency direction](#04-call-direction-is-not-dependency-direction)
- [05. What crosses the port](#05-what-crosses-the-port)

### B. Port design

- [06. Name the port for the need](#06-name-the-port-for-the-need)
- [07. Domain port vs. read port](#07-domain-port-vs-read-port)
- [08. Do not mirror the vendor](#08-do-not-mirror-the-vendor)
- [09. The error contract](#09-the-error-contract)
- [10. Port granularity](#10-port-granularity)
- [11. The input port's shape](#11-the-input-ports-shape)

### C. Consistency and effects

- [12. The composition root](#12-the-composition-root)
- [13. Who owns the transaction](#13-who-owns-the-transaction)
- [14. External calls outside the transaction](#14-external-calls-outside-the-transaction)
- [15. Idempotency at the port](#15-idempotency-at-the-port)
- [16. Time and identity are driven ports](#16-time-and-identity-are-driven-ports)

### D. Mapping

- [17. Two-way mapping](#17-two-way-mapping)
- [18. Mapping loss](#18-mapping-loss)
- [19. The persistence model must not escape](#19-the-persistence-model-must-not-escape)
- [20. Map once, at the boundary](#20-map-once-at-the-boundary)

### E. Testing

- [21. Test the core with fakes](#21-test-the-core-with-fakes)
- [22. Fake fidelity](#22-fake-fidelity)
- [23. Test the adapters in isolation](#23-test-the-adapters-in-isolation)
- [24. One contract suite, every provider](#24-one-contract-suite-every-provider)

### F. Enforcement and evolution

- [25. The module is the enforcement](#25-the-module-is-the-enforcement)
- [26. One giant hexagon](#26-one-giant-hexagon)
- [27. Migrating incrementally](#27-migrating-incrementally)
- [28. When to remove a port](#28-when-to-remove-a-port)
- [29. The cost of the module split](#29-the-cost-of-the-module-split)
- [30. The framework belongs at the edge](#30-the-framework-belongs-at-the-edge)
- [31. Where the services live](#31-where-the-services-live)

### G. Appendix

- [Appendix A. The vocabulary](#appendix-a-the-vocabulary)

## 01. Inside vs. outside

*The dependency rule is the import graph. The folder names are not the architecture.*

**The situation.** A registration feature sits in `domain/`, `application/`, and `adapters/`. In the first project the use case imports only its own types and ports. In the second it imports `adapters/http` to reuse a request type. A folder-name check passes for both.

**Correct.** Check the edges, not the directory names.

```ts
const isCore = (module: string): boolean =>
  module.startsWith("domain/") || module.startsWith("application/");

function edgeViolations(graph: ModuleGraph): string[] {
  const violations: string[] = [];
  for (const [from, dependencies] of Object.entries(graph)) {
    for (const to of dependencies) {
      if (isCore(from) && to.startsWith("adapters/")) {
        violations.push(`${from} -> ${to}`);
      }
    }
  }
  return violations;
}
```

The correct graph has `application/register-user` importing `domain/user` and `application/ports`, and the adapters importing inward.

**Anti-pattern.** The same folders with one extra edge:

```ts
"application/register-user": [
  "domain/user",
  "application/ports",
  "adapters/http", // the use case now depends on the controller
],
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/01-inside-outside.ts` — the correct graph passes both the folder check and the edge check; the costume passes the folder check and fails with `application/register-user -> adapters/http`.

## 02. Driving vs. driven ports

*One port is what the application offers; the other is what it needs. Both are defined by the inside.*

**The situation.** Registration arrives over HTTP and from the CLI. It saves to memory in tests and to SQLite in production. The two directions are symmetric, and most explanations only draw the database side.

**Correct.** The driving adapters call one use case; both driven adapters satisfy one `Users` contract.

```ts
class RegisterUser {
  private readonly users: Users;
  constructor(users: Users, clock: FixedClock, nextId: () => string) { /* ... */ }
  async execute(email: string): Promise<User> {
    const normalized = email.trim().toLowerCase();
    if (await this.users.byEmail(normalized)) throw new DuplicateEmail(normalized);
    const user = { id: this.nextId(), email: normalized, registeredAt: this.clock.now() };
    await this.users.save(user);
    return user;
  }
}

function httpDriver(useCase: RegisterUser) { /* parses the body, calls execute */ }
function cliDriver(useCase: RegisterUser) { /* reads argv, calls execute */ }
```

**Anti-pattern.** The use case reads the HTTP request, so the CLI has to fake one — and reports the wrong source:

```ts
async execute(req: HttpRequest): Promise<User & { source: string }> {
  return { id: this.nextId(), email: req.body.email ?? "",
    registeredAt: new Date(0), source: req.headers["x-client"] ?? "unknown" };
}
// the CLI call has no headers, so source is "unknown" instead of "cli"
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/02-driving-vs-driven.ts` — both drivers produce the same user, both stores satisfy the same contract, and the request-aware core reports `web` for HTTP but `unknown` for the CLI.

## 03. A port is not an interface

*The test is the dependency direction, not the `interface` keyword.*

**The situation.** A team reads that "ports are interfaces," adds `IRegisterUser` with one implementation, and believes the architecture is in place. The controller still constructs nothing, and the core still constructs its database adapter.

**Correct.** The driving adapter may depend on the concrete use case.

```ts
class HttpRegister {
  private readonly useCase: RegisterUser;
  constructor(useCase: RegisterUser) { this.useCase = useCase; }
  async handle(body: unknown): Promise<{ status: number; email?: string }> {
    if (!isEmailBody(body)) return { status: 400 };
    const user = await this.useCase.execute(body.email);
    return { status: 201, email: user.email };
  }
}
```

`RegisterUser` receives `MemoryUsers` in the test and a real adapter in production. The seam is the constructor; the concrete type is not the problem.

**Anti-pattern.** An interface that hides a core which constructs its own adapter:

```ts
class RegisterUserOnDisk implements IRegisterUser {
  async execute(email: string): Promise<User> {
    const users = new DiskUsers(); // no seam to substitute
    // ...
  }
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/03-port-is-not-an-interface.ts` — the concrete port writes to the memory fake; the interface's fake never reaches registration, and the real implementation can only write to disk.

## 04. Call direction is not dependency direction

*At runtime the core calls the adapter. At compile time the adapter depends on the core.*

**The situation.** A reviewer sees `orders.save(order)` reach Postgres and concludes the domain depends on the database. The call arrow and the import arrow point in opposite directions.

**Correct.** The use case calls the port; the adapter implements it and is injected at the edge.

```ts
class Core {
  private readonly users: Users;
  private readonly notifier: Notifier;
  constructor(users: Users, notifier: Notifier) {
    this.users = users;
    this.notifier = notifier;
  }

  async execute(email: string): Promise<User> {
    const user = { id: "u-1", email };
    await this.users.save(user);     // runtime: outward
    await this.notifier.welcome(user);
    return user;
  }
}
```

**Anti-pattern.** The core imports the adapter "just to call it":

```ts
class CoupledCore {
  private readonly adapter = new RecordingNotifier(); // source: outward
  async execute(email: string): Promise<void> {
    await this.adapter.welcome({ id: "u-1", email });
  }
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/04-call-vs-dependency-direction.ts` — the injected core records the save-then-notify order and can be tested with spies; the importing core always sends for real.

## 05. What crosses the port

*The payload decides whether the boundary is the size of the contract or the size of the schema.*

**The situation.** The adapter has a `UserRow` with `created_at`, `password_hash`, and a nullable column. The port returns it, and the core starts reading snake_case.

**Correct.** The adapter maps; the core sees a domain object.

```ts
async byId(id: string): Promise<User | null> {
  const row = this.rows.get(id);
  return row ? new User(row.id, row.email, new Date(row.created_at)) : null;
}
async save(user: User): Promise<void> {
  this.rows.set(user.id, {
    id: user.id, email: user.email, password_hash: null,
    created_at: user.registeredAt.toISOString(),
  });
}
```

**Anti-pattern.** The port is the table:

```ts
interface RowUsersPort {
  byId(id: string): Promise<UserRow | null>;
}
// the core now reads row.created_at and row.password_hash
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/05-what-crosses-the-port.ts` — the domain object has a `Date` and no `created_at`; the leaked row makes a core method depend on the column name.

## 06. Name the port for the need

*Name the contract after the question the application asks, not the query a screen runs.*

**The situation.** A new screen needs "active users." The quick change is another method on the repository the invariants already use. Now a UI change edits the interface that guards registration.

**Correct.** Two contracts, two reasons to change.

```ts
interface Users {
  byEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

interface UserSearch {
  search(criteria: { status?: User["status"] }): Promise<User[]>;
}
```

**Anti-pattern.** One port shaped by whoever asked last:

```ts
interface UserRepository {
  byEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  findByStatus(status: User["status"]): Promise<User[]>;
  findByStatusAndCreatedAtBetween(status: string, from: Date, to: Date): Promise<User[]>;
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/06-name-the-port-for-the-need.ts` — the use case compiles against `Users` while the screen uses `UserSearch`; the domain contract does not move when a filter is added.

## 07. Domain port vs. read port

*A summary is a query, not an aggregate load. Split it by reason to change.*

**The situation.** A screen needs the open-order total for a customer. The only port available loads one order by id, so the use case loops over every id and sums in memory.

**Correct.** A read port answers the question in one pass.

```ts
interface OrderReports {
  summaryFor(customerId: string): Promise<OrderSummary>;
}

async summaryFor(customerId: string): Promise<OrderSummary> {
  const mine = this.rows.filter((o) => o.customerId === customerId && o.status === "open");
  return { customerId, openTotal: mine.reduce((sum, o) => sum + o.total, 0), count: mine.length };
}
```

**Anti-pattern.** Load every aggregate to count it:

```ts
for (const id of ids) {
  const order = await orders.byId(id); // one load per row
  if (order?.status === "open") { total += order.total; count += 1; }
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/07-domain-port-vs-read-port.ts` — the read port makes zero aggregate loads; the loop makes one per row.

## 08. Do not mirror the vendor

*State the event; let the adapter choose the channel.*

**The situation.** The core sends a welcome message. The port is `SmtpMailer.send(to, subject, body)`, so the day the notification moves to a queue, the core changes or someone writes a fake SMTP server.

**Correct.** The port is named for the business event.

```ts
interface WelcomeNotifier {
  welcome(user: User): Promise<void>;
}

class QueueNotifier implements WelcomeNotifier {
  async welcome(user: User): Promise<void> { /* enqueue */ }
}
```

**Anti-pattern.** The vendor's vocabulary becomes the core's:

```ts
interface SmtpMailer {
  send(to: string, subject: string, body: string): Promise<void>;
}
await this.mailer.send(user.email, "Welcome", "Hello");
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/08-dont-mirror-the-vendor.ts` — swapping the notifier edits no use case; the queue adapter does not satisfy the SMTP-shaped port.

## 09. The error contract

*The port owns its errors; the caller must not know the driver's.*

**The situation.** The memory adapter throws `DuplicateEmail`; the SQLite adapter throws `SQLITE_CONSTRAINT_UNIQUE`; a vendor returns `409 conflict`. The use case now contains a string match for each.

**Correct.** Translate at the adapter, then throw the port's error.

```ts
class DuplicateEmail extends Error {}

async save(user: User): Promise<void> {
  try {
    this.db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run(user.id, user.email);
  } catch {
    throw new DuplicateEmail(user.email); // the port's error
  }
}
```

**Anti-pattern.** The use case inspects the driver:

```ts
if (error instanceof Error && error.message.includes("SQLITE_CONSTRAINT")) {
  throw new DuplicateEmail(email);
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/09-error-contract.ts` — both adapters produce `DuplicateEmail` for the use case; the untranslated vendor error escapes it.

## 10. Port granularity

*One port per capability the application needs — not per table, not per class, not one for everything.*

**The situation.** A registration use case needs to save a user and request a welcome. The team has a single `Database` port with `insert`, `update`, `select`, `delete`, and `transaction`. Every use case depends on all of it.

**Correct.** Narrow ports; the use case depends only on what it calls.

```ts
interface Users { save(user: User): Promise<void>; }
interface WelcomeNotifier { welcome(user: User): Promise<void>; }

class RegisterUser {
  private readonly users: Users;
  private readonly notifier: WelcomeNotifier;
  constructor(users: Users, notifier: WelcomeNotifier) {
    this.users = users;
    this.notifier = notifier;
  }
}
```

A fake implements two methods, not five.

**Anti-pattern.** The god port:

```ts
interface Database {
  insert(table: string, row: Record<string, unknown>): Promise<void>;
  update(table: string, id: string, patch: Record<string, unknown>): Promise<void>;
  select(table: string, id: string): Promise<Record<string, unknown> | null>;
  delete(table: string, id: string): Promise<void>;
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/10-port-granularity.ts` — the narrow fake implements exactly the two methods used; adding an orders feature edits the god port and every fake.

## 11. The input port's shape

*The edge owns the transport shape; the core owns the meaning.*

**The situation.** The controller passes the request body to the use case. The body includes `content-type`, a `User-Agent`, and a string date. A CLI caller now has to fabricate HTTP headers to register a user.

**Correct.** Shape check at the edge, command into the core, domain error out.

```ts
type RegisterCommand = { email: string };

async handle(request: HttpRequest) {
  if (!isBody(request.body)) return { status: 400 };
  try {
    return { status: 201, body: await this.useCase.execute({ email: request.body.email }) };
  } catch (error) {
    if (error instanceof InvalidEmail) return { status: 422 };
    throw error;
  }
}
```

**Anti-pattern.** The use case receives the request:

```ts
async execute(request: HttpRequest): Promise<User> {
  if (request.headers["content-type"] !== "application/json") throw new Error("bad content type");
  return { id: "u-1", email: (request.body as { email: string }).email };
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/11-input-port-shape.ts` — shape errors are 400, invariant errors are 422, and the request-shaped core cannot be called without HTTP headers.

## 12. The composition root

*Only the edge constructs concretes. The core receives its ports.*

**The situation.** A unit test wants a deterministic id and no I/O. The use case calls `new SqliteUsers()` in its field initializer, so every test opens a connection.

**Correct.** The root chooses; the core receives.

```ts
class RegisterUser {
  private readonly users: Users;
  constructor(users: Users) { this.users = users; }
  async execute(email: string): Promise<User> { /* ... */ }
}

function buildForTest() {
  const users = new MemoryUsers();          // the root makes the choice
  return { useCase: new RegisterUser(users), users };
}
```

**Anti-pattern.** Self-wiring:

```ts
class SelfWiringRegister {
  private readonly users = new SqliteUsers(); // new inside the core
  async execute(email: string): Promise<void> { await this.users.save(); }
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/12-composition-root.ts` — the rooted core writes to memory and performs no I/O; the self-wiring core performs one I/O call per execution with no constructor argument to replace.

## 13. Who owns the transaction

*The application owns the unit of work; repositories and domain services participate and never commit.*

**The situation.** Registration saves a user and an outbox row. The repository commits on every `save`. The second step fails; the user row survives and the notification is lost.

**Correct.** An explicit unit-of-work port; both writes stage into the same transaction.

```ts
await this.uow.transaction(async () => {
  await this.users.save({ id: `u-${email}`, email });
  if (this.failAfterSave) throw new Error("second step failed");
  await this.outbox.add(`welcome:${email}`);
});
```

**Anti-pattern.** The repository decides the boundary:

```ts
async save(user: User): Promise<void> {
  this.db.begin();
  this.db.stageUser(user);
  this.db.commit(); // a multi-step use case now has partial writes
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/13-transaction-ownership.ts` — the unit of work rolls back both writes; the committing repository leaves the user row behind when the outbox step throws.

## 14. External calls outside the transaction

*Write the state and the event together; call the provider after the commit.*

**The situation.** The welcome email is sent inside the transaction. The provider is slow, and when the transaction rolls back the mail has already gone out. A retry sends it again.

**Correct.** The transaction stages state plus an outbox row; a relay delivers after commit.

```ts
this.db.begin();
this.db.saveUser({ id: `u-${email}`, email });
this.db.addOutbox(`welcome:${email}`);
this.db.commit();

// later, outside the transaction:
await relayOnce(db, notifier); // failure returns the event to the outbox
```

**Anti-pattern.** Network I/O inside the transaction:

```ts
await this.notifier.welcome(email); // provider called before commit
this.db.commit();
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/14-external-call-outside-transaction.ts` — a failing provider leaves the user committed and the event pending for a retry; the inline version calls the provider even though the transaction rolls back.

## 15. Idempotency at the port

*If the caller can retry, the port must make the retry safe.*

**The situation.** A client times out and retries a registration. The port has no key, so the second call creates a second user and a second welcome message.

**Correct.** The port accepts a stable key and returns the original result.

```ts
async execute(key: string, email: string): Promise<User> {
  const previous = this.byKey.get(key);
  if (previous) return previous;

  const existing = this.byEmail.get(email);
  if (existing) { this.byKey.set(key, existing); return existing; }
  // ...create once, remember under the key
}
```

**Anti-pattern.** "Just call it again":

```ts
async execute(_key: string, email: string): Promise<User> {
  const user = { id: `u-${this.users.length + 1}`, email };
  this.users.push(user); // one row per attempt
  return user;
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/15-idempotency-at-the-port.ts` — the keyed port returns the same user twice, and even a new key deduplicates on the natural key; the naive port creates two.

## 16. Time and identity are driven ports

*The core must not read the system clock or generate its own identifiers.*

**The situation.** A test asserts the registration timestamp. The core calls `new Date()`, so the assertion is either a range or a flaky exact match. The id is a random UUID, so the response cannot be named.

**Correct.** Inject `Clock` and `Ids`; the test fixes both.

```ts
class RegisterUser {
  constructor(clock: Clock, ids: Ids) {}
  execute(email: string): User {
    return { id: this.ids.next(), email, registeredAt: this.clock.now() };
  }
}

const register = new RegisterUser(new FixedClock("2000-01-01T00:00:00Z"), { next: sequentialIds("u") });
```

**Anti-pattern.** Ambient time and identity:

```ts
execute(email: string): User {
  return { id: crypto.randomUUID(), email, registeredAt: new Date() };
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/16-clock-and-id-ports.ts` — the fixed ports produce an exact id and instant; the self-timed core can only be asserted by shape and range.

## 17. Two-way mapping

*The core and the adapter need different shapes. Keep both and map in the adapter.*

**The situation.** The core needs a `User` it can validate and name in `RegisterUser`. Persistence needs a type with a no-arg constructor, writable columns, and an ORM import. The core needs a model to decide with; the adapter needs a model to store with. The two obvious single-model answers fail:

- **The annotated model in the core.** The core imports the ORM, the invariant becomes optional, and `password_hash` becomes a domain field.
- **The model only in the adapter.** The use case either imports the adapter — the arrow points outward — or returns `unknown`/a duplicate type and cannot read `user.email` without a cast. The invariant has no home in the core.

**Correct.** Two types, one mapper, in the adapter.

```ts
// core
class User { /* validates the email; no columns */ }

// adapter
type UserRow = {
  id: string;
  email: string;
  password_hash: string | null;
  created_at: string;
};

class JpaUsers implements Users {
  async save(user: User): Promise<void> {
    rows.set(user.id, {
      id: user.id,
      email: user.email,
      password_hash: null,
      created_at: user.registeredAt.toISOString(),
    });                                                        // core -> row
  }

  async byId(id: string): Promise<User | null> {
    const row = rows.get(id);
    return row ? new User(row.id, row.email, new Date(row.created_at)) : null; // row -> core
  }
}
```

The mapper is in the adapter because only the adapter may import both sides. `save` drops domain-irrelevant fields and supplies columns; `byId` does the reverse and re-validates. Name the two types differently (`User` and `UserRow`, or `JpaUser`); two `User` classes in different folders hide the mistake at the import.

**The payoff.** A major ORM upgrade changes the adapter and the mapper, not the core or its tests. The row type is the shock absorber.

**Anti-pattern.** One annotated class serves as both:

```ts
class AnnotatedUser {
  constructor(
    readonly id: string,
    readonly email: string,
    readonly password_hash: string | null,
    readonly created_at: string,
  ) {} // no validation, and the core now has a column
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/17-two-way-mapping.ts` — the mapper preserves the domain invariant and hides `created_at`; the shared annotation-ready class accepts `not-an-email` and exposes `password_hash`.

## 18. Mapping loss

*A round-trip must preserve meaning, not just field names.*

**The situation.** `save` writes a nickname, a cent amount, a UTC instant, and an enum. `load` uses `JSON.parse(JSON.stringify(...))`. The nickname that was absent becomes absent, the `Date` becomes a string, and a decimal silently changes unit.

**Correct.** An explicit mapper that decides each representation.

```ts
function toRow(account: Account): AccountRow {
  return {
    ...account,
    nickname: account.nickname ?? null,          // absence becomes NULL
    created_at: account.createdAt.toISOString(), // one instant format
  };
}
function toDomain(row: AccountRow): Account {
  return { ...row, ...(row.nickname === null ? {} : { nickname: row.nickname }),
    createdAt: new Date(row.created_at) };
}
```

**Anti-pattern.** JSON as a mapper:

```ts
function naiveRoundTrip(account: Account): Account {
  return JSON.parse(JSON.stringify(account)) as Account;
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/18-mapping-loss.ts` — the explicit mapper round-trips `deepEqual`; the JSON copy turns the `Date` into a string and drops `undefined`.

## 19. The persistence model must not escape

*Map before the session closes; never hand a managed entity across the port.*

**The situation.** The repository returns the ORM entity. The controller reads a lazy association after the session has closed, so it throws — or worse, a core rule reads a database-only field and passes locally.

**Correct.** The adapter detaches the object.

```ts
async byId(id: string): Promise<User | null> {
  const entity = this.entities.get(id);
  if (!entity) return null;
  return { id: entity.id, email: entity.email, notes: entity.notes }; // read inside the session
}
```

**Anti-pattern.** Return the entity:

```ts
async byId(id: string): Promise<User | null> {
  return this.entities.get(id) as unknown as User; // lazy field loads later
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/19-persistence-model-leak.ts` — the mapped object is usable after close; the leaked entity's lazy field throws "session is closed."

## 20. Map once, at the boundary

*Every extra mapping hop is a place to lose a field.*

**The situation.** The controller maps DTO to domain. The service maps domain to a "public profile" and back. The profile does not model a nickname, so the field disappears before the use case finishes.

**Correct.** The edge maps transport to command; the adapter maps domain to row. Nothing in between remaps.

```ts
const user = await this.useCase.execute(body);          // command already shaped
return { status: 201, body: { email: user.email,
  ...(user.nickname ? { nickname: user.nickname } : {}) } }; // one edge mapping
```

**Anti-pattern.** A premature projection in the middle:

```ts
const user = { id: `u-${input.email}`, email: input.email, nickname: input.nickname };
const profile = toPublic(user); // { email } — nickname is gone
return profile;
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/20-mapper-placement.ts` — one mapping keeps the nickname; the intermediate shape drops it silently.

## 21. Test the core with fakes

*The use case test should need no database, server, queue, or clock.*

**The situation.** The registration test constructs a real repository and a real notifier. It is slow, it needs credentials, and a failure might be the network rather than the rule.

**Correct.** A stub returns data; a spy records calls.

```ts
class SpyUsers implements Users {
  readonly saved: User[] = [];
  async save(user: User): Promise<void> { this.saved.push(user); }
}

const spy = new SpyUsers();
const user = await new RegisterUser(spy).execute("ada@example.com");
assert.deepEqual(spy.saved, [user]);
```

**Anti-pattern.** The test uses the production adapter:

```ts
const real = new RealAdapter();
await new RegisterUser(real).execute("ada@example.com");
assert.equal(real.ioCalls, 1); // now the test depends on I/O
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/21-core-test-with-fakes.ts` — the fake test records the call with no I/O; the real-adapter test performs one I/O call, with all that implies.

## 22. Fake fidelity

*A double that is more permissive than the contract certifies a bug.*

**The situation.** The in-memory fake appends to an array. The real adapter has a unique constraint. The duplicate-email test passes against the fake and fails in production.

**Correct.** The fake models the failure the contract promises.

```ts
async save(user: User): Promise<void> {
  for (const row of this.rows.values()) {
    if (row.email === user.email) throw new DuplicateEmail(user.email);
  }
  this.rows.set(user.id, user);
}
```

**Anti-pattern.** Happy-path only:

```ts
async save(user: User): Promise<void> {
  this.rows.push(user); // duplicates accepted
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/22-fake-fidelity.ts` — the faithful fake and SQLite both leave one row after a duplicate attempt; the permissive fake leaves two.

## 23. Test the adapters in isolation

*The core test proves the rule. The adapter test proves the technology.*

**The situation.** A single integration test calls the controller, the use case, and the database. It fails; no one knows whether the body parser, the rule, or the SQL is wrong.

**Correct.** Two tests, one side each.

```ts
// driving adapter: a spy for the input port
const spy = new SpyRegister();
const response = await new Controller(spy).handle({ email: "ada@example.com" });
assert.deepEqual(spy.commands, [{ email: "ada@example.com" }]);

// driven adapter: the real engine
const users = new SqliteUsers();
await users.save({ id: "u-1", email: "ada@example.com" });
assert.equal(users.emailOf("u-1"), "ada@example.com");
```

**Anti-pattern.** One test that exercises everything:

```ts
await new Controller(new RegisterUser(new SqliteUsers(), new SmtpNotifier())).handle(body);
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/23-adapter-test-in-isolation.ts` — the driving test asserts the inward command; the driven test asserts the row and the constraint; the combined test only says "something failed."

## 24. One contract suite, every provider

*The adapter contract is an assertion set, and every implementation runs it.*

**The situation.** The in-memory adapter is used in every test, so it is the only one that is exercised. The SQL adapter has a different duplicate behavior and nobody notices until production.

**Correct.** Write the suite once; run it per provider.

```ts
function runContract(name: string, make: () => Users): void {
  test(`${name}: a saved user loads back`, async () => {
    const users = make();
    await users.save({ id: "u-1", email: "ada@example.com" });
    assert.deepEqual(await users.byId("u-1"), { id: "u-1", email: "ada@example.com" });
  });
  // missing id, duplicate email, ...
}

runContract("memory", () => new MemoryUsers());
runContract("sqlite", () => new SqliteUsers());
```

**Anti-pattern.** Testing only the fast adapter:

```ts
runContract("memory", () => new MemoryUsers());
// the SQL adapter's constraint is never exercised
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/24-contract-suite.ts` — both providers pass six assertions; a permissive adapter fails the duplicate case.

## 25. The module is the enforcement

*A rule that a build does not check is a preference.*

**The situation.** The folders are correct. A developer under deadline imports a repository row type into `domain/`. Nothing fails. Six months later the "hexagon" is a layered project with different directory names.

**Correct.** Declare the allowed edges and fail CI on the rest.

```ts
const allowed = {
  "adapters/http": ["application"],
  "adapters/persistence": ["application", "domain"],
  application: ["domain", "ports"],
  ports: ["domain"],
  domain: [],
  bootstrap: ["adapters/http", "adapters/persistence", "application"],
};

function check(graph: Imports, rules: Imports): string[] {
  return Object.entries(graph).flatMap(([from, edges]) =>
    edges.filter((to) => !(rules[from] ?? []).includes(to)).map((to) => `${from} -> ${to}`));
}
```

**Anti-pattern.** The costume:

```ts
const costume = { ...project, domain: ["adapters/persistence"] };
check(costume, allowed); // ["domain -> adapters/persistence"]
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/25-module-enforcement.ts` — the real graph passes, the costume fails, and the check is small enough to run in CI without splitting packages.

## 26. One giant hexagon

*The boundary protects the outside. It does not decompose the inside.*

**The situation.** A single core holds Orders, Billing, and Inventory. Billing imports the internal `Order` class and reads its status directly. The aggregate's invariant is bypassed, and the ports did not notice because both callers are inside.

**Correct.** Each capability exposes a public facade; other capabilities import only that.

```ts
class OrdersPublic {
  private readonly orders = new Map<string, Order>();
  place(id: string): void { /* enforces the aggregate rule */ }
  status(id: string): string { /* read-only */ }
}

class Billing {
  invoice(orderId: string): string {
    if (this.orders.status(orderId) !== "placed") throw new Error("order not placed");
    return `invoice:${orderId}`;
  }
}
```

**Anti-pattern.** Reach into the internal type:

```ts
class LeakyBilling {
  invoice(order: Order): string {
    return `invoice:${order.id}:${order.status}`; // never calls place()
  }
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/26-one-giant-hexagon.ts` — the facade path invoices only a placed order; the internal path invoices a draft.

## 27. Migrating incrementally

*Wrap the old system behind the new port and move one use case at a time.*

**The situation.** The registration code is legacy. The team plans a rewrite while the old system stays live. Both write to their own store, and one registration produces two ids.

**Correct.** An adapter delegates to the legacy service; callers depend on the new port.

```ts
class LegacyRegistrationAdapter implements Registration {
  private readonly legacy: LegacyRegistration;
  constructor(legacy: LegacyRegistration) { this.legacy = legacy; }
  async register(email: string): Promise<Account> {
    return this.legacy.createAccount(email); // one write, one id
  }
}
```

**Anti-pattern.** The big-bang double write:

```ts
async register(email: string): Promise<Account> {
  const old = this.legacy.createAccount(email);
  const fresh = { id: `new-${this.newAccounts.length + 1}`, email };
  this.newAccounts.push(fresh);
  return { id: old.id, email }; // which store is authoritative?
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/27-migrating-incrementally.ts` — the adapter yields one legacy account; the double write leaves one record in each store.

## 28. When to remove a port

*A port must earn its keep: a second implementation, a real test seam, or a volatile dependency.*

**The situation.** The project has an interface for every collaborator. `AuditPort` has one implementation, no test ever substitutes it, and the vendor is an internal class that will not change. It adds a file and a name.

**Correct.** Keep the seam with a buyer; call the concrete class when there is none.

```ts
// kept: every test substitutes the fake; production uses SQL
interface Users { save(user: User): Promise<void>; }

// removed: one implementation, no fake, no volatility
class RegisterUser {
  constructor(users: Users, audit: AuditTrail) {}
}
```

**Anti-pattern.** Interface-driven ceremony:

```ts
interface AuditPort { record(action: string, email: string): void; }
class AuditAdapter implements AuditPort {
  private readonly trail = new AuditTrail();
  record(action: string, email: string): void { this.trail.record(action, email); }
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/28-when-to-remove-a-port.ts` — removing the audit port changes no test; the users port stays because the test substitutes it.

## 29. The cost of the module split

*Splitting into modules is enforcement, and enforcement has a fixed cost per module.*

**The situation.** The video shows a project with an application module, three adapter modules, a model module, and a bootstrap module. Some contain one class. The diagram is correct and the overhead is real.

**Correct.** Treat the split as a cost model, not a badge.

```ts
const FIXED_PER_MODULE = 8; // build config, wiring, navigation, versioning
const PER_CLASS = 1;

function overhead({ modules, classes }: Shape): number {
  return modules * FIXED_PER_MODULE + classes * PER_CLASS;
}
```

One package plus a graph test costs `8 + classes + 2`. Six modules cost `48 + classes`. At six classes the split is dominated by the fixed cost; at three hundred classes the fixed cost is a small percentage, and the compiler-enforced direction pays.

**Anti-pattern.** Six modules for six classes:

```ts
singlePackage(6); // 16
sixModules(6);    // 54
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/29-cost-of-module-split.ts` — the arithmetic shows the crossover and the cheap starting point. The numbers are a model, not a benchmark.

## 30. The framework belongs at the edge

*The core is plain. The router, the decorators, and the container live in adapters and the root.*

**The situation.** The registration class creates its own router in the constructor and registers the route there. A unit test now constructs a web framework to test an email rule.

**Correct.** A plain core plus an adapter that wires it.

```ts
class RegisterUser {
  async execute(email: string): Promise<User> {
    if (!email.includes("@")) throw new Error("invalid email");
    return { id: `u-${email}`, email };
  }
}

function httpAdapter(router: Router, useCase: RegisterUser): Router {
  router.post("/users", async (body) => ({
    status: 201, body: await useCase.execute((body as { email: string }).email),
  }));
  return router;
}
```

**Anti-pattern.** The core owns the router:

```ts
class FrameworkCoupledRegister {
  readonly router = new Router();
  constructor() { this.router.post("/users", async (body) => this.execute(/* ... */)); }
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/30-framework-at-the-edge.ts` — the plain core runs with a hand-built instance and a router at the edge; the coupled core drags the framework into every caller.

## 31. Where the services live

*"Service" is not a layer. Classify it by what it is allowed to depend on.*

**The situation.** Placing an order needs three different things: the order's own invariants (non-empty, positive quantity), a rule that compares a customer's limit with the order total, and a transaction that loads, checks, saves, and commits. The team puts all of it in `services/OrderService.ts`.

**Correct.** Three homes, decided by dependencies.

| Kind | Lives in | May depend on | Example |
| --- | --- | --- | --- |
| **Aggregate** | `domain/` | Its own state and domain values | `Order.addLine`, `Order.place` |
| **Domain service** | `domain/` | Domain types and passed-in values | `CreditPolicy.check(customer, openTotal, total)` |
| **Application service** | `application/` | Domain types plus driven ports | `PlaceOrder.execute` |

```ts
class Order {
  addLine(line: OrderLine): void { /* quantity invariant */ }
  place(): void { /* non-empty invariant */ }
}

class CreditPolicy {
  check(customer: Customer, openTotal: number, newTotal: number): void { /* limit rule */ }
}

class PlaceOrder {
  constructor(customers: Customers, orders: Orders, policy: CreditPolicy) { /* ... */ }
  async execute(id: string, lines: OrderLine[]): Promise<Order> { /* load, check, place, save */ }
}
```

**Anti-pattern.** Two ways to get it wrong: an anemic aggregate with a god service, or a service injected into the aggregate.

```ts
class OrderService {
  place(id: string, lines: OrderLine[]): AnemicOrder {
    // sets status directly; no invariant is enforced
  }
}

class CoupledOrder {
  constructor(customerId: string, customers: Customers) { /* ... */ }
  async place(): Promise<void> {
    await this.customers.byId(this.customerId); // I/O for an invariant it can check alone
  }
}
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/31-where-the-services-live.ts` — the aggregate rejects an empty order with no collaborators, the policy needs three numbers, the application service uses fakes, the anemic path accepts an empty order, and the coupled aggregate queries the customer just to place one.

## Appendix A. The vocabulary

*The words this catalog uses, and where each one lives in code.*

| Term | Meaning | Where it lives |
| --- | --- | --- |
| **Port** | A contract at the boundary, defined by the inside | `ports/` or beside the use case |
| **Driving / primary port** | What the application offers | The use-case class or an interface it implements |
| **Driven / secondary port** | What the application needs | An interface owned by the core |
| **Adapter** | A technology-specific implementation of a port | `adapters/http`, `adapters/persistence` |
| **Use case** | One scenario the application offers | `application/register-user.ts` |
| **Composition root** | The only place that chooses concretes | `bootstrap.ts` / `main.ts` |
| **Domain object** | A type with invariants and no I/O knowledge | `domain/` |
| **DTO** | A transport shape with no invariants | The driving adapter |
| **Mapper** | A function that translates between shapes at one boundary | The adapter that owns the shape |

A value object compares by value; an entity compares by identity; a DTO compares by nothing, because it has no rules.

```ts
test("A: value objects compare by value, entities by identity", () => {
  const a = new Email("ada@example.com");
  const b = new Email("ada@example.com");
  assert.equal(a.equals(b), true);
  assert.notEqual(a, b);
});
```

**Proof.** `node --test architecture/02b-hexagonal-example/nuances/appendix-vocabulary.ts` — value objects compare by value, entities by identity, and a DTO keeps a string date with no way to reject an invalid email.

## What is real and what is modeled

- **Real:** all TypeScript types, `node:test` assertions, and the `node:sqlite` adapters in #22–#24.
- **Modeled:** the transaction manager (#13), the external-call timeline (#14), the session (#19), the module graph (#25), the migration (#27), and the cost arithmetic (#29). These are small deterministic models that make the behavior visible without a database server or a network. The file headers say so.
- **Not production code:** no Express, NestJS, ORM, or container. The controller is a function with an HTTP-shaped input; the framework is a router stand-in. The point is the boundary, not the framework.

## How to use it

1. Read the matching section in [02b — Hexagonal architecture](02b-hexagonal-architecture.md).
2. Run the one file.
3. Change the anti-pattern to the correct code, or vice versa, and watch the test fail.
4. Add a nuance when a real code review finds a boundary you cannot name.

## Next

- [02b — Hexagonal architecture](02b-hexagonal-architecture.md) — the pattern, the trade-offs, and the video analysis.
- [02 — Layered architecture](02-layered-architecture.md) — the style hexagonal inverts.
- [02a — Big ball of mud](02a-big-ball-of-mud.md) — why a hexagon with no internal boundary is still a mud.
- [02c — One request, end to end](02c-end-to-end-slice.md) — the layered version of the same walkthrough.
