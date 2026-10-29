// 05 — What crosses the port
// Scenario: the same user is represented as a domain object, a database row, and an
// API DTO. Only the domain object may cross the driven port.
import { test } from "node:test";
import assert from "node:assert/strict";

// Core type: no persistence or transport concerns.
class User {
  readonly id: string;
  readonly email: string;
  readonly registeredAt: Date;

  constructor(id: string, email: string, registeredAt: Date) {
    this.id = id;
    this.email = email;
    this.registeredAt = registeredAt;
  }
}

// Adapter type: snake_case, a stored hash, and a formatted timestamp.
type UserRow = {
  id: string;
  email: string;
  password_hash: string | null;
  created_at: string;
};

interface Users {
  byId(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

// (a) correct: the adapter maps, and only the domain object crosses.
class RowUsers implements Users {
  readonly rows = new Map<string, UserRow>();
  async byId(id: string): Promise<User | null> {
    const row = this.rows.get(id);
    return row ? new User(row.id, row.email, new Date(row.created_at)) : null;
  }
  async save(user: User): Promise<void> {
    this.rows.set(user.id, {
      id: user.id,
      email: user.email,
      password_hash: null,
      created_at: user.registeredAt.toISOString(),
    });
  }
}

// (b) anti-pattern: the row crosses the port, so the core reads the schema.
interface RowUsersPort {
  byId(id: string): Promise<UserRow | null>;
}
class LeakyUseCase {
  private readonly users: RowUsersPort;
  constructor(users: RowUsersPort) {
    this.users = users;
  }
  async initials(id: string): Promise<string> {
    const row = await this.users.byId(id);
    if (!row) throw new Error("missing");
    // The core now depends on created_at and password_hash.
    return `${row.email[0]?.toUpperCase()}:${row.created_at.slice(0, 10)}:${row.password_hash ?? "none"}`;
  }
}

// The anti-pattern's adapter returns the row, which is what makes the leak possible.
class LeakyRowUsers implements RowUsersPort {
  readonly rows = new Map<string, UserRow>();
  async byId(id: string): Promise<UserRow | null> {
    return this.rows.get(id) ?? null;
  }
  seed(row: UserRow): void {
    this.rows.set(row.id, row);
  }
}

test("05: a domain object crosses, the row stays in the adapter", async () => {
  const users = new RowUsers();
  await users.save(new User("u-1", "ada@example.com", new Date("2026-01-01T00:00:00Z")));

  const user = await users.byId("u-1");
  assert.ok(user instanceof User);
  assert.equal(user.registeredAt.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal("created_at" in user, false);
});

test("05: a row-shaped port leaks the schema into the core", async () => {
  const users = new LeakyRowUsers();
  users.seed({
    id: "u-1",
    email: "ada@example.com",
    password_hash: null,
    created_at: "2026-01-01T00:00:00.000Z",
  });

  const leaky = new LeakyUseCase(users);
  assert.match(await leaky.initials("u-1"), /A:2026-01-01:none/);
  // Rename created_at in the adapter and this core method breaks silently or at runtime.
});
