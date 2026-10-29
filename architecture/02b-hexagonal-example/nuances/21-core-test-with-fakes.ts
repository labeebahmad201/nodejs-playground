// 21 — Test the core with fakes
// Scenario: the same use case tested with an in-memory substitute and with the real adapter.
import { test } from "node:test";
import assert from "node:assert/strict";

type User = { id: string; email: string };

interface Users {
  save(user: User): Promise<void>;
}

class SpyUsers implements Users {
  readonly saved: User[] = [];
  async save(user: User): Promise<void> {
    this.saved.push(user);
  }
}

class RealAdapter implements Users {
  ioCalls = 0;
  async save(): Promise<void> {
    this.ioCalls += 1; // pretend this opens a connection
  }
}

class RegisterUser {
  private readonly users: Users;
  constructor(users: Users) {
    this.users = users;
  }
  async execute(email: string): Promise<User> {
    if (!email.includes("@")) throw new Error("invalid email");
    const user = { id: `u-${email}`, email };
    await this.users.save(user);
    return user;
  }
}

test("21: the use case runs with no I/O and records the call", async () => {
  const spy = new SpyUsers();
  const user = await new RegisterUser(spy).execute("ada@example.com");

  assert.deepEqual(user, { id: "u-ada@example.com", email: "ada@example.com" });
  assert.deepEqual(spy.saved, [user]);
  assert.equal("ioCalls" in spy, false);
});

test("21: the same test against the real adapter performs I/O", async () => {
  const real = new RealAdapter();
  await new RegisterUser(real).execute("ada@example.com");

  assert.equal(real.ioCalls, 1);
  // The test now depends on a connection, its credentials, and its latency.
});
