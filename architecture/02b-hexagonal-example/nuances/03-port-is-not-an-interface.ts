// 03 — A port is not an interface
// Scenario: the HTTP adapter calls registration; the question is whether it needs an interface.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sequentialIds } from "../_shared.ts";

type User = { id: string; email: string };
interface Users {
  byEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
class MemoryUsers implements Users {
  readonly rows: User[] = [];
  async byEmail(email: string): Promise<User | null> {
    return this.rows.find((user) => user.email === email) ?? null;
  }
  async save(user: User): Promise<void> {
    this.rows.push(user);
  }
}

class RegisterUser {
  private readonly users: Users;
  private readonly nextId: () => string;
  constructor(users: Users, nextId: () => string) {
    this.users = users;
    this.nextId = nextId;
  }
  async execute(email: string): Promise<User> {
    if (!email.includes("@")) throw new Error("invalid email");
    if (await this.users.byEmail(email)) throw new Error("duplicate email");
    const user: User = { id: this.nextId(), email };
    await this.users.save(user);
    return user;
  }
}

// (a) correct: the driving adapter depends on the concrete use-case class.
// The arrow still points inward: HTTP knows registration; registration does not know HTTP.
class HttpRegister {
  private readonly useCase: RegisterUser;
  constructor(useCase: RegisterUser) {
    this.useCase = useCase;
  }
  async handle(body: unknown): Promise<{ status: number; email?: string }> {
    if (typeof body !== "object" || body === null || !("email" in body)) {
      return { status: 400 };
    }
    const email = body.email;
    if (typeof email !== "string") return { status: 400 };
    const user = await this.useCase.execute(email);
    return { status: 201, email: user.email };
  }
}

// (b) anti-pattern: an interface with one production implementation, no second
// driver, and the real seam missing — the core still constructs its adapter.
const diskRows: User[] = [];

class DiskUsers implements Users {
  async byEmail(email: string): Promise<User | null> {
    return diskRows.find((user) => user.email === email) ?? null;
  }
  async save(user: User): Promise<void> {
    diskRows.push(user);
  }
}

interface IRegisterUser {
  execute(email: string): Promise<User>;
}

class RegisterUserOnDisk implements IRegisterUser {
  private readonly nextId: () => string;
  constructor(nextId: () => string) {
    this.nextId = nextId;
  }
  async execute(email: string): Promise<User> {
    const users = new DiskUsers();
    if (await users.byEmail(email)) throw new Error("duplicate email");
    const user: User = { id: this.nextId(), email };
    await users.save(user);
    return user;
  }
}

class HttpRegisterInterface {
  private readonly useCase: IRegisterUser;
  constructor(useCase: IRegisterUser) {
    this.useCase = useCase;
  }
  async handle(email: string): Promise<{ status: number }> {
    await this.useCase.execute(email);
    return { status: 201 };
  }
}

test("03: the concrete use case is a sufficient driving port", async () => {
  const users = new MemoryUsers();
  const adapter = new HttpRegister(new RegisterUser(users, sequentialIds()));
  assert.deepEqual(await adapter.handle({ email: "ada@example.com" }), {
    status: 201,
    email: "ada@example.com",
  });
  assert.deepEqual(users.rows.map((user) => user.email), ["ada@example.com"]);
});

test("03: the interface hides that the driven adapter cannot be substituted", async () => {
  diskRows.length = 0;
  const fake: IRegisterUser = {
    execute: async (email) => ({ id: "fake", email }),
  };
  const adapter = new HttpRegisterInterface(fake);
  assert.deepEqual(await adapter.handle("fake@example.com"), { status: 201 });
  assert.equal(diskRows.length, 0); // the fake never reaches registration

  const real = new HttpRegisterInterface(new RegisterUserOnDisk(sequentialIds()));
  await real.handle("ada@example.com");
  assert.equal(diskRows.length, 1); // the real path can only use the real adapter
});
