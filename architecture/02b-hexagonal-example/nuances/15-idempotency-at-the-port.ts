// 15 — Idempotency at the port
// Scenario: the client retries a registration. The retry must not create a second user.
import { test } from "node:test";
import assert from "node:assert/strict";

type User = { id: string; email: string };

interface RegisterUser {
  execute(key: string, email: string): Promise<User>;
}

// (a) correct: the key and the result live at the port.
class IdempotentRegister implements RegisterUser {
  private readonly byKey = new Map<string, User>();
  private readonly byEmail = new Map<string, User>();

  async execute(key: string, email: string): Promise<User> {
    const previous = this.byKey.get(key);
    if (previous) return previous;

    const existing = this.byEmail.get(email);
    if (existing) {
      this.byKey.set(key, existing);
      return existing;
    }

    const user = { id: `u-${this.byEmail.size + 1}`, email };
    this.byEmail.set(email, user);
    this.byKey.set(key, user);
    return user;
  }
}

// (b) anti-pattern: "just call it again"; the port has no key.
class NaiveRegister implements RegisterUser {
  private readonly users: User[] = [];
  async execute(_key: string, email: string): Promise<User> {
    const user = { id: `u-${this.users.length + 1}`, email };
    this.users.push(user);
    return user;
  }
  get count(): number {
    return this.users.length;
  }
}

test("15: the same key returns the same user", async () => {
  const register = new IdempotentRegister();

  const first = await register.execute("key-1", "ada@example.com");
  const retry = await register.execute("key-1", "ada@example.com");

  assert.equal(retry.id, first.id);
  assert.equal(retry, first);
});

test("15: a retry with a new id still deduplicates on the natural key", async () => {
  const register = new IdempotentRegister();

  const first = await register.execute("key-1", "ada@example.com");
  const clientRetry = await register.execute("key-2", "ada@example.com");

  assert.equal(clientRetry.id, first.id);
});

test("15: the naive port creates a second user", async () => {
  const register = new NaiveRegister();

  const first = await register.execute("key-1", "ada@example.com");
  const retry = await register.execute("key-1", "ada@example.com");

  assert.notEqual(retry.id, first.id);
  assert.equal(register.count, 2);
});
