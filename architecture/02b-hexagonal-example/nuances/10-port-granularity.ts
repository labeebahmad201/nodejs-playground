// 10 — Port granularity
// Scenario: a use case needs users and a welcome message. Does it need the database?
import { test } from "node:test";
import assert from "node:assert/strict";

type User = { id: string; email: string };

// (a) correct: narrow ports, one capability each.
interface Users {
  save(user: User): Promise<void>;
}
interface WelcomeNotifier {
  welcome(user: User): Promise<void>;
}

class RegisterUser {
  private readonly users: Users;
  private readonly notifier: WelcomeNotifier;
  constructor(users: Users, notifier: WelcomeNotifier) {
    this.users = users;
    this.notifier = notifier;
  }
  async execute(email: string): Promise<User> {
    const user = { id: `u-${email}`, email };
    await this.users.save(user);
    await this.notifier.welcome(user);
    return user;
  }
}

class NarrowFake implements Users, WelcomeNotifier {
  readonly events: string[] = [];
  async save(user: User): Promise<void> {
    this.events.push(`save:${user.id}`);
  }
  async welcome(user: User): Promise<void> {
    this.events.push(`welcome:${user.id}`);
  }
}

// (b) anti-pattern: one god port for the whole database.
interface Database {
  insert(table: string, row: Record<string, unknown>): Promise<void>;
  update(table: string, id: string, patch: Record<string, unknown>): Promise<void>;
  select(table: string, id: string): Promise<Record<string, unknown> | null>;
  delete(table: string, id: string): Promise<void>;
  transaction<T>(work: () => Promise<T>): Promise<T>;
}

class GodPortRegister {
  private readonly db: Database;
  constructor(db: Database) {
    this.db = db;
  }
  async execute(email: string): Promise<void> {
    await this.db.insert("users", { email });
    await this.db.insert("outbox", { type: "welcome", email });
  }
}

test("10: the narrow fake implements only what the use case needs", async () => {
  const fake = new NarrowFake();
  await new RegisterUser(fake, fake).execute("ada@example.com");

  assert.deepEqual(fake.events, ["save:u-ada@example.com", "welcome:u-ada@example.com"]);
});

test("10: the god port makes every use case depend on every table", async () => {
  const calls: string[] = [];
  const db: Database = {
    async insert(table) { calls.push(`insert:${table}`); },
    async update() {},
    async select() { return null; },
    async delete() {},
    async transaction(work) { return work(); },
  };

  await new GodPortRegister(db).execute("ada@example.com");

  assert.deepEqual(calls, ["insert:users", "insert:outbox"]);
  // A change to "orders" still edits this shared interface, so every fake grows.
});
