// 12 — The composition root
// Scenario: only the edge may choose an adapter. The core must not construct one.
import { test } from "node:test";
import assert from "node:assert/strict";

type User = { id: string; email: string };

interface Users {
  save(user: User): Promise<void>;
}

class MemoryUsers implements Users {
  readonly rows: User[] = [];
  async save(user: User): Promise<void> {
    this.rows.push(user);
  }
}

class SqliteUsers implements Users {
  ioCalls = 0;
  async save(): Promise<void> {
    this.ioCalls += 1;
  }
}

// (a) correct: the core receives its port; the root chooses the implementation.
class RegisterUser {
  private readonly users: Users;
  constructor(users: Users) {
    this.users = users;
  }
  async execute(email: string): Promise<User> {
    const user = { id: `u-${email}`, email };
    await this.users.save(user);
    return user;
  }
}

function buildForTest(): { useCase: RegisterUser; users: MemoryUsers } {
  const users = new MemoryUsers(); // the root makes the choice
  return { useCase: new RegisterUser(users), users };
}

// (b) anti-pattern: the core chooses its own adapter.
class SelfWiringRegister {
  private readonly users = new SqliteUsers(); // `new` inside the core
  async execute(email: string): Promise<void> {
    await this.users.save();
  }
  get ioCalls(): number {
    return this.users.ioCalls;
  }
}

test("12: the root can hand the core an in-memory adapter", async () => {
  const { useCase, users } = buildForTest();

  await useCase.execute("ada@example.com");

  assert.equal(users.rows.length, 1);
});

test("12: a self-wiring core always performs I/O", async () => {
  const selfWiring = new SelfWiringRegister();
  await selfWiring.execute("ada@example.com");

  assert.equal(selfWiring.ioCalls, 1);
  // There is no constructor argument to replace, so a unit test cannot avoid the I/O.
});
