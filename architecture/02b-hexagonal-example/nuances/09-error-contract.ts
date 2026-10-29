// 09 — The error contract
// Scenario: two adapters report the same condition with different raw errors.
import { test } from "node:test";
import assert from "node:assert/strict";

type User = { id: string; email: string };

// The port owns its errors; callers depend on these, not on the driver's.
class DuplicateEmail extends Error {}
class NotFound extends Error {}

interface Users {
  byEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

// Adapter 1: a memory map throws its own error.
class DriverError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

class SqliteUsers implements Users {
  private readonly rows = new Map<string, User>();
  async byEmail(email: string): Promise<User | null> {
    return [...this.rows.values()].find((user) => user.email === email) ?? null;
  }
  async save(user: User): Promise<void> {
    try {
      if (await this.byEmail(user.email)) throw new DriverError("SQLITE_CONSTRAINT_UNIQUE");
      this.rows.set(user.id, user);
    } catch (error) {
      // (a) correct: translate at the adapter.
      if (error instanceof DriverError && error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        throw new DuplicateEmail(user.email);
      }
      throw error;
    }
  }
}

class HttpVendorUsers implements Users {
  async byEmail(): Promise<User | null> {
    return null;
  }
  async save(user: User): Promise<void> {
    // A different vendor, a different raw failure.
    throw Object.assign(new Error("409 conflict"), { status: 409, body: { email: user.email } });
  }
}

class MemoryUsers implements Users {
  private readonly rows = new Map<string, User>();
  async byEmail(email: string): Promise<User | null> {
    return [...this.rows.values()].find((user) => user.email === email) ?? null;
  }
  async save(user: User): Promise<void> {
    if (await this.byEmail(user.email)) throw new DuplicateEmail(user.email);
    this.rows.set(user.id, user);
  }
}

class RegisterUser {
  private readonly users: Users;
  constructor(users: Users) {
    this.users = users;
  }
  async execute(email: string): Promise<User> {
    const user = { id: `u-${email}`, email };
    await this.users.save(user); // the use case knows only DuplicateEmail
    return user;
  }
}

// (b) anti-pattern: the use case catches the driver's error or matches its text.
class LeakyRegister {
  private readonly users: Users;
  constructor(users: Users) {
    this.users = users;
  }
  async execute(email: string): Promise<User> {
    try {
      return await new RegisterUser(this.users).execute(email);
    } catch (error) {
      if (error instanceof Error && error.message.includes("SQLITE_CONSTRAINT")) {
        throw new DuplicateEmail(email);
      }
      throw error;
    }
  }
}

test("09: the memory adapter's error is the port's error", async () => {
  const users = new MemoryUsers();
  const useCase = new RegisterUser(users);
  await useCase.execute("ada@example.com");
  await assert.rejects(() => useCase.execute("ada@example.com"), DuplicateEmail);
});

test("09: the same use case sees DuplicateEmail from a SQLite-shaped adapter", async () => {
  const users = new SqliteUsers();
  const useCase = new RegisterUser(users);
  await useCase.execute("ada@example.com");
  await assert.rejects(() => useCase.execute("ada@example.com"), DuplicateEmail);
});

test("09: an untranslated vendor error escapes the use case", async () => {
  const leaky = new LeakyRegister(new HttpVendorUsers());
  await assert.rejects(
    () => leaky.execute("ada@example.com"),
    (error: Error) => error.message === "409 conflict",
  );
});
