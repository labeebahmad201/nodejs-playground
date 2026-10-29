// 00 — One registration, end to end
// Scenario: a user registers through HTTP, a CLI calls the same use case, and the
// core saves the user and asks for a welcome message without knowing either transport
// or either adapter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FixedClock, captureError, sequentialIds } from "../_shared.ts";

// ---------- core: domain ----------
class DomainError extends Error {}
class InvalidEmail extends DomainError {}
class DuplicateEmail extends DomainError {}

class User {
  readonly id: string;
  readonly email: string;
  readonly registeredAt: Date;

  private constructor(id: string, email: string, registeredAt: Date) {
    this.id = id;
    this.email = email;
    this.registeredAt = registeredAt;
  }

  static register(id: string, email: string, now: Date): User {
    if (!email.includes("@")) throw new InvalidEmail(email);
    return new User(id, email, now);
  }
}

// ---------- driven ports (owned by the core) ----------
interface Users {
  byEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

interface WelcomeNotifier {
  welcome(user: User): Promise<void>;
}

interface Clock {
  now(): Date;
}

interface Ids {
  next(): string;
}

// ---------- application: the use case ----------
type RegisterCommand = { email: string };

class RegisterUser {
  private readonly users: Users;
  private readonly notifier: WelcomeNotifier;
  private readonly clock: Clock;
  private readonly ids: Ids;

  constructor(users: Users, notifier: WelcomeNotifier, clock: Clock, ids: Ids) {
    this.users = users;
    this.notifier = notifier;
    this.clock = clock;
    this.ids = ids;
  }

  async execute(command: RegisterCommand): Promise<User> {
    const existing = await this.users.byEmail(command.email);
    if (existing) throw new DuplicateEmail(command.email);

    const user = User.register(this.ids.next(), command.email, this.clock.now());
    await this.users.save(user);
    await this.notifier.welcome(user);
    return user;
  }
}

// ---------- driven adapters ----------
class MemoryUsers implements Users {
  readonly rows = new Map<string, User>();

  async byEmail(email: string): Promise<User | null> {
    for (const user of this.rows.values()) if (user.email === email) return user;
    return null;
  }

  async save(user: User): Promise<void> {
    this.rows.set(user.id, user);
  }
}

class RecordingNotifier implements WelcomeNotifier {
  readonly sent: string[] = [];

  async welcome(user: User): Promise<void> {
    this.sent.push(user.email);
  }
}

// ---------- driving adapters ----------
type Response = { status: number; body: unknown };

class RegisterController {
  private readonly register: RegisterUser;

  constructor(register: RegisterUser) {
    this.register = register;
  }

  async handle(request: unknown): Promise<Response> {
    if (!isRegisterRequest(request)) {
      return { status: 400, body: { error: "invalid request shape" } };
    }
    try {
      const user = await this.register.execute(request);
      return { status: 201, body: { id: user.id, email: user.email } };
    } catch (error) {
      if (error instanceof InvalidEmail) return { status: 422, body: { error: "invalid email" } };
      if (error instanceof DuplicateEmail) return { status: 409, body: { error: "already registered" } };
      throw error;
    }
  }
}

function isRegisterRequest(value: unknown): value is RegisterCommand {
  return typeof value === "object" && value !== null && "email" in value
    && typeof (value as { email: unknown }).email === "string";
}

// ---------- composition root ----------
function buildApp() {
  const users = new MemoryUsers();
  const notifier = new RecordingNotifier();
  const register = new RegisterUser(users, notifier, new FixedClock(), { next: sequentialIds("u") });
  return { controller: new RegisterController(register), register, users, notifier };
}

test("00: a valid registration returns 201, saves the user, and notifies", async () => {
  const app = buildApp();
  const response = await app.controller.handle({ email: "ada@example.com" });

  assert.deepEqual(response, { status: 201, body: { id: "u-1", email: "ada@example.com" } });
  assert.equal(app.users.rows.size, 1);
  assert.deepEqual(app.notifier.sent, ["ada@example.com"]);
});

test("00: a duplicate email is a 409, mapped from the core's error", async () => {
  const app = buildApp();
  await app.controller.handle({ email: "ada@example.com" });
  const response = await app.controller.handle({ email: "ada@example.com" });

  assert.equal(response.status, 409);
  assert.equal(app.users.rows.size, 1);
});

test("00: an invalid email is a 422 from the domain, not a 400 from the edge", async () => {
  const app = buildApp();
  const response = await app.controller.handle({ email: "not-an-email" });

  assert.equal(response.status, 422);
  assert.equal(app.users.rows.size, 0);
});

test("00: a malformed body stops at the edge", async () => {
  const app = buildApp();
  assert.equal((await app.controller.handle({})).status, 400);
  assert.equal((await app.controller.handle("ada@example.com")).status, 400);
});

test("00: a second driver calls the same use case without the controller", async () => {
  const app = buildApp();
  const user = await app.register.execute({ email: "cli@example.com" });

  assert.equal(user.id, "u-1");
  assert.deepEqual(app.notifier.sent, ["cli@example.com"]);
});

test("00: the notifier's failure is visible to the caller", async () => {
  const failing = {
    async welcome(): Promise<void> {
      throw new Error("provider down");
    },
  };
  const register = new RegisterUser(new MemoryUsers(), failing, new FixedClock(), { next: sequentialIds() });
  const error = await captureError(() => register.execute({ email: "ada@example.com" }));
  assert.match(error.message, /provider down/);
});
