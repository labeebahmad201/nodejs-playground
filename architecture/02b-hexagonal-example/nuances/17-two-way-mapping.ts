// 17 — Two-way mapping
// Scenario: the core needs a plain, validated User; persistence needs a row with
// columns and no-arg hydration. The annotated model in the core would import the
// ORM; the only model in the adapter would leave the use case unable to name its
// own type. So: two types, and the adapter maps in both directions.
import { test } from "node:test";
import assert from "node:assert/strict";

// Core type: a validating constructor, no persistence knowledge.
class User {
  readonly id: string;
  readonly email: string;
  readonly registeredAt: Date;

  constructor(id: string, email: string, registeredAt: Date) {
    if (!email.includes("@")) throw new Error("invalid email");
    this.id = id;
    this.email = email;
    this.registeredAt = registeredAt;
  }
}

// Adapter type: the row. In Java this is the annotated @Entity.
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

// (a) correct: the adapter owns both mappings.
class JpaUsers implements Users {
  readonly rows = new Map<string, UserRow>();

  async byId(id: string): Promise<User | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    return new User(row.id, row.email, new Date(row.created_at)); // row -> core
  }

  async save(user: User): Promise<void> {
    this.rows.set(user.id, {
      id: user.id,
      email: user.email,
      password_hash: null,
      created_at: user.registeredAt.toISOString(),
    }); // core -> row
  }
}

// (b) anti-pattern: one class serves as both (option A in the note). The row
// shape and the core shape are the same type, so validation is optional.
// Option B — the model only in the adapter — is a compile-time failure: the use
// case would import this folder or lose the type, so there is no runtime test.
class AnnotatedUser {
  id: string;
  email: string;
  password_hash: string | null;
  created_at: string;

  constructor(id: string, email: string, password_hash: string | null, created_at: string) {
    this.id = id;
    this.email = email;
    this.password_hash = password_hash;
    this.created_at = created_at;
  }
}

test("17: the mapper hides both the row shape and the column names", async () => {
  const users = new JpaUsers();
  await users.save(new User("u-1", "ada@example.com", new Date("2026-01-01T00:00:00Z")));

  const row = users.rows.get("u-1");
  assert.equal(row?.created_at, "2026-01-01T00:00:00.000Z");
  assert.equal(row?.password_hash, null);

  const user = await users.byId("u-1");
  assert.ok(user instanceof User);
  assert.equal(user.registeredAt.toISOString(), "2026-01-01T00:00:00.000Z");
});

test("17: the shared row shape lets persistence leak into validation", () => {
  const user = new AnnotatedUser("u-1", "not-an-email", null, "not-a-date");

  // No constructor validated the email, and the core now has a column it never uses.
  assert.equal(user.email, "not-an-email");
  assert.equal(user.created_at, "not-a-date");
  assert.equal("password_hash" in user, true);
});
