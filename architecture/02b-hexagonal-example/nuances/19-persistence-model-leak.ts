// 19 — The persistence model must not escape
// Scenario: a repository returns an entity whose lazy field only works inside the session.
import { test } from "node:test";
import assert from "node:assert/strict";

class Session {
  private open = true;
  close(): void {
    this.open = false;
  }
  assertOpen(): void {
    if (!this.open) throw new Error("session is closed");
  }
}

type User = { id: string; email: string; notes: string };

// The row belongs to the adapter and is only valid inside a session.
class UserEntity {
  readonly id: string;
  readonly email: string;
  private readonly session: Session;
  private notesValue: string | null = null;

  constructor(id: string, email: string, session: Session) {
    this.id = id;
    this.email = email;
    this.session = session;
  }

  get notes(): string {
    this.session.assertOpen(); // lazy load
    return this.notesValue ?? "";
  }
  set notes(value: string) {
    this.notesValue = value;
  }
}

interface Users {
  byId(id: string): Promise<User | null>;
}

// (a) correct: the adapter maps and returns a detached domain object.
class MappingUsers implements Users {
  private readonly entities = new Map<string, UserEntity>();
  private readonly session = new Session();

  seed(id: string, email: string, notes: string): void {
    const entity = new UserEntity(id, email, this.session);
    entity.notes = notes;
    this.entities.set(id, entity);
  }
  close(): void {
    this.session.close();
  }
  async byId(id: string): Promise<User | null> {
    const entity = this.entities.get(id);
    if (!entity) return null;
    const user = { id: entity.id, email: entity.email, notes: entity.notes };
    return user; // plain object, no session
  }
}

// (b) anti-pattern: the entity crosses the port.
class LeakyUsers implements Users {
  private readonly entities = new Map<string, UserEntity>();
  readonly session = new Session();

  seed(id: string, email: string): void {
    this.entities.set(id, new UserEntity(id, email, this.session));
  }
  close(): void {
    this.session.close();
  }
  async byId(id: string): Promise<User | null> {
    return this.entities.get(id) as unknown as User; // the row is the result
  }
}

test("19: the mapped object is usable after the session closes", async () => {
  const users = new MappingUsers();
  users.seed("u-1", "ada@example.com", "internal note");
  const user = await users.byId("u-1");
  users.close();

  assert.equal(user?.notes, "internal note");
  assert.deepEqual(user, { id: "u-1", email: "ada@example.com", notes: "internal note" });
});

test("19: the leaked entity throws after the session closes", async () => {
  const users = new LeakyUsers();
  users.seed("u-1", "ada@example.com");
  const leaked = await users.byId("u-1");
  users.close();

  assert.throws(() => leaked?.notes, /session is closed/);
});
