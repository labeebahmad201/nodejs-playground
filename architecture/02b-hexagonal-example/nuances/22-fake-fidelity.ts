// 22 — Fake fidelity
// Scenario: an in-memory double that is more permissive than the real adapter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

type User = { id: string; email: string };
class DuplicateEmail extends Error {}

interface Users {
  save(user: User): Promise<void>;
}

// (a) correct: the fake models the contract's failure.
class MemoryUsers implements Users {
  private readonly rows = new Map<string, User>();
  async save(user: User): Promise<void> {
    for (const row of this.rows.values()) if (row.email === user.email) throw new DuplicateEmail(user.email);
    this.rows.set(user.id, user);
  }
}

// (b) anti-pattern: the fake only implements the happy path.
class SloppyFake implements Users {
  readonly rows: User[] = [];
  async save(user: User): Promise<void> {
    this.rows.push(user);
  }
}

class SqliteUsers implements Users {
  private readonly db: DatabaseSync;
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE)");
  }
  async save(user: User): Promise<void> {
    try {
      this.db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run(user.id, user.email);
    } catch {
      throw new DuplicateEmail(user.email);
    }
  }
}

async function registerTwice(users: Users): Promise<number> {
  await users.save({ id: "u-1", email: "ada@example.com" });
  try {
    await users.save({ id: "u-2", email: "ada@example.com" });
    return 2;
  } catch (error) {
    if (error instanceof DuplicateEmail) return 1;
    throw error;
  }
}

test("22: the faithful fake and the real adapter agree", async () => {
  assert.equal(await registerTwice(new MemoryUsers()), 1);
  assert.equal(await registerTwice(new SqliteUsers()), 1);
});

test("22: the permissive fake hides a production failure", async () => {
  assert.equal(await registerTwice(new SloppyFake()), 2);
  // The use-case test passes; the real adapter would have rejected the second row.
});
