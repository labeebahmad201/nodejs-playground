// 06 — Name the port for the need
// Scenario: a new screen wants a filter. The domain port should not change for it.
import { test } from "node:test";
import assert from "node:assert/strict";

type User = { id: string; email: string; status: "active" | "blocked" };

// (a) correct: two contracts with two reasons to change.
interface Users {
  byEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

interface UserSearch {
  search(criteria: { status?: User["status"] }): Promise<User[]>;
}

class MemoryUsers implements Users, UserSearch {
  readonly rows: User[] = [];
  async byEmail(email: string): Promise<User | null> {
    return this.rows.find((user) => user.email === email) ?? null;
  }
  async save(user: User): Promise<void> {
    const index = this.rows.findIndex((row) => row.id === user.id);
    if (index === -1) this.rows.push(user);
    else this.rows[index] = user;
  }
  async search(criteria: { status?: User["status"] }): Promise<User[]> {
    return this.rows.filter((user) => !criteria.status || user.status === criteria.status);
  }
}

// (b) anti-pattern: one port, shaped by whoever asked last.
interface UserRepository {
  byEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  findByStatus(status: User["status"]): Promise<User[]>;
  findByStatusAndCreatedAtBetween(status: User["status"], from: Date, to: Date): Promise<User[]>;
}

class RegisterUser {
  private readonly users: Users;
  constructor(users: Users) {
    this.users = users;
  }
  async execute(email: string): Promise<User> {
    const existing = await this.users.byEmail(email);
    if (existing) throw new Error("duplicate");
    const user: User = { id: `u-${email}`, email, status: "active" };
    await this.users.save(user);
    return user;
  }
}

test("06: the domain port is enough to register a user", async () => {
  const users = new MemoryUsers();
  const useCase = new RegisterUser(users);

  const user = await useCase.execute("ada@example.com");

  assert.equal(user.status, "active");
  assert.equal((await users.byEmail("ada@example.com"))?.id, user.id);
});

test("06: a screen filter changes the read port, not the domain port", async () => {
  const users = new MemoryUsers();
  await users.save({ id: "u-1", email: "a@b.c", status: "active" });
  await users.save({ id: "u-2", email: "d@e.f", status: "blocked" });

  assert.deepEqual((await users.search({ status: "blocked" })).map((u) => u.id), ["u-2"]);
  // `Users` above is unchanged. The invariants did not notice the new screen.
});

test("06: a new screen can add a filter without touching the domain contract", async () => {
  const users = new MemoryUsers();
  const useCase = new RegisterUser(users);
  await useCase.execute("ada@example.com");
  await users.search({ status: "active" });

  // RegisterUser still compiles against `Users`, not against the query surface.
  assert.equal((await users.byEmail("ada@example.com"))?.status, "active");
});

test("06: a shared port makes the domain fake grow for a screen", () => {
  const domainPort: Users = {
    byEmail: async () => null,
    save: async () => {},
  };
  const sharedPort: UserRepository = {
    ...domainPort,
    findByStatus: async () => [],
    findByStatusAndCreatedAtBetween: async () => [],
  };

  assert.deepEqual(Object.keys(domainPort).sort(), ["byEmail", "save"]);
  const addedForTheScreen = Object.keys(sharedPort).filter(
    (method) => !(method in domainPort),
  );
  assert.deepEqual(addedForTheScreen, [
    "findByStatus",
    "findByStatusAndCreatedAtBetween",
  ]);
  // A domain test double built against `Users` no longer satisfies the shared port.
});
