// 02 — Driving and driven are symmetrical
// Scenario: registration arrives over HTTP and from the CLI; the store is an object map or a row-shaped adapter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FixedClock, sequentialIds } from "../_shared.ts";

type User = { id: string; email: string; registeredAt: Date };
interface Users {
  save(user: User): Promise<void>;
  byEmail(email: string): Promise<User | null>;
}
class DuplicateEmail extends Error {}
class MemoryUsers implements Users {
  private readonly rows: User[] = [];
  async save(user: User): Promise<void> {
    this.rows.push(user);
  }
  async byEmail(email: string): Promise<User | null> {
    return this.rows.find((row) => row.email === email) ?? null;
  }
}
type UserRow = { id: string; email: string; created_at: number };
class RowStoreUsers implements Users {
  private readonly rows: UserRow[] = [];
  async save(user: User): Promise<void> {
    this.rows.push({ id: user.id, email: user.email, created_at: user.registeredAt.getTime() });
  }
  async byEmail(email: string): Promise<User | null> {
    const row = this.rows.find((candidate) => candidate.email === email);
    return row ? { id: row.id, email: row.email, registeredAt: new Date(row.created_at) } : null;
  }
}
class RegisterUser {
  private readonly users: Users;
  private readonly clock: FixedClock;
  private readonly nextId: () => string;
  constructor(users: Users, clock: FixedClock, nextId: () => string) {
    this.users = users;
    this.clock = clock;
    this.nextId = nextId;
  }
  async execute(email: string): Promise<User> {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) throw new Error("invalid email");
    if (await this.users.byEmail(normalized)) throw new DuplicateEmail(normalized);
    const user: User = { id: this.nextId(), email: normalized, registeredAt: this.clock.now() };
    await this.users.save(user);
    return user;
  }
}
function httpDriver(useCase: RegisterUser) {
  return async (body: unknown): Promise<User> => {
    if (typeof body !== "object" || body === null || !("email" in body)) {
      throw new Error("400: email is required");
    }
    if (typeof body.email !== "string") throw new Error("400: email is required");
    return useCase.execute(body.email);
  };
}
function cliDriver(useCase: RegisterUser) {
  return async (argv: readonly string[]): Promise<User> => {
    const email = argv[1];
    if (email === undefined) throw new Error("usage: register <email>");
    return useCase.execute(email);
  };
}

// (b) anti-pattern: the use case reads the HTTP request, so the CLI fakes one.
type HttpRequest = { body: { email?: string }; headers: Record<string, string> };
class RequestAwareRegister {
  private readonly users: Users;
  private readonly nextId: () => string;
  constructor(users: Users, nextId: () => string) {
    this.users = users;
    this.nextId = nextId;
  }
  async execute(req: HttpRequest): Promise<User & { source: string }> {
    const user = {
      id: this.nextId(),
      email: req.body.email ?? "",
      registeredAt: new Date(0),
      source: req.headers["x-client"] ?? "unknown",
    };
    await this.users.save(user);
    return user;
  }
}
function cliDriverLeaky(useCase: RequestAwareRegister) {
  return async (argv: readonly string[]): Promise<User & { source: string }> =>
    useCase.execute({ body: { email: argv[1] }, headers: {} });
}

test("02: both drivers produce the same user", async () => {
  const http = httpDriver(new RegisterUser(new MemoryUsers(), new FixedClock(), sequentialIds()));
  const cli = cliDriver(new RegisterUser(new MemoryUsers(), new FixedClock(), sequentialIds()));
  assert.deepEqual(
    await http({ email: " Ada@Example.com " }),
    await cli(["register", " Ada@Example.com "]),
  );
});

test("02: both store adapters satisfy the same contract", async () => {
  for (const users of [new MemoryUsers(), new RowStoreUsers()]) {
    const user: User = { id: "u-1", email: "ada@example.com", registeredAt: new Date("2026-01-01T00:00:00.000Z") };
    await users.save(user);
    assert.deepEqual(await users.byEmail(user.email), user);
    assert.equal(await users.byEmail("missing@example.com"), null);
  }
});

test("02: the request-aware use case reports the wrong driver", async () => {
  const http = new RequestAwareRegister(new MemoryUsers(), sequentialIds());
  const cli = cliDriverLeaky(new RequestAwareRegister(new MemoryUsers(), sequentialIds()));
  const fromHttp = await http.execute({ body: { email: "ada@example.com" }, headers: { "x-client": "web" } });
  const fromCli = await cli(["register", "ada@example.com"]);
  assert.equal(fromHttp.source, "web");
  assert.equal(fromCli.source, "unknown");
});
