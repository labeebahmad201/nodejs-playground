// 24 — One contract suite, every provider
// Scenario: the in-memory adapter and the SQLite adapter must obey the same contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

type User = { id: string; email: string };
class DuplicateEmail extends Error {}

interface Users {
  byId(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

class MemoryUsers implements Users {
  private readonly rows = new Map<string, User>();
  async byId(id: string): Promise<User | null> {
    return this.rows.get(id) ?? null;
  }
  async save(user: User): Promise<void> {
    for (const row of this.rows.values()) if (row.email === user.email) throw new DuplicateEmail(user.email);
    this.rows.set(user.id, user);
  }
}

class SqliteUsers implements Users {
  private readonly db: DatabaseSync;
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE)");
  }
  async byId(id: string): Promise<User | null> {
    const row = this.db.prepare("SELECT id, email FROM users WHERE id = ?").get(id);
    return row ? { id: String(row.id), email: String(row.email) } : null;
  }
  async save(user: User): Promise<void> {
    try {
      this.db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run(user.id, user.email);
    } catch {
      throw new DuplicateEmail(user.email);
    }
  }
}

// The contract is written once and run against every adapter.
function runContract(name: string, make: () => Users): void {
  test(`${name}: a saved user loads back`, async () => {
    const users = make();
    await users.save({ id: "u-1", email: "ada@example.com" });
    assert.deepEqual(await users.byId("u-1"), { id: "u-1", email: "ada@example.com" });
  });

  test(`${name}: a missing id returns null`, async () => {
    assert.equal(await make().byId("missing"), null);
  });

  test(`${name}: a duplicate email is rejected`, async () => {
    const users = make();
    await users.save({ id: "u-1", email: "ada@example.com" });
    await assert.rejects(() => users.save({ id: "u-2", email: "ada@example.com" }), DuplicateEmail);
  });
}

runContract("24 memory", () => new MemoryUsers());
runContract("24 sqlite", () => new SqliteUsers());

// (b) anti-pattern: only the fast adapter is exercised.
class PermissiveUsers implements Users {
  readonly rows = new Map<string, User>();
  async byId(id: string): Promise<User | null> {
    return this.rows.get(id) ?? null;
  }
  async save(user: User): Promise<void> {
    this.rows.set(user.id, user); // no uniqueness check
  }
}

test("24: a permissive adapter fails the same contract", async () => {
  const users = new PermissiveUsers();
  await users.save({ id: "u-1", email: "ada@example.com" });
  await users.save({ id: "u-2", email: "ada@example.com" }); // silently accepted
  assert.equal(users.rows.size, 2);
});
