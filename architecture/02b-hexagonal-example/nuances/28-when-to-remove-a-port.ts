// 28 — When to remove a port
// Scenario: two seams: one is used by every test, one is ceremony.
import { test } from "node:test";
import assert from "node:assert/strict";

type User = { id: string; email: string };
type Entry = { action: string; email: string };

// Kept: the test substitutes a fake, production uses the adapter.
interface Users {
  save(user: User): Promise<void>;
}

class MemoryUsers implements Users {
  readonly rows: User[] = [];
  async save(user: User): Promise<void> {
    this.rows.push(user);
  }
}

// Ceremony: one implementation, no test seam, no volatility. Call it directly.
class AuditTrail {
  readonly entries: Entry[] = [];
  record(action: string, email: string): void {
    this.entries.push({ action, email });
  }
}

interface AuditPort {
  record(action: string, email: string): void;
}

class RegisterUser {
  private readonly users: Users;
  private readonly audit: AuditTrail;
  constructor(users: Users, audit: AuditTrail) {
    this.users = users;
    this.audit = audit;
  }
  async execute(email: string): Promise<User> {
    const user = { id: `u-${email}`, email };
    await this.users.save(user);
    this.audit.record("registered", email);
    return user;
  }
}

// (b) anti-pattern: an interface for every collaborator, including this one.
class AuditAdapter implements AuditPort {
  private readonly trail = new AuditTrail();
  record(action: string, email: string): void {
    this.trail.record(action, email);
  }
}

test("28: the Users port earns its keep as a test seam", async () => {
  const users = new MemoryUsers();
  const audit = new AuditTrail();
  const user = await new RegisterUser(users, audit).execute("ada@example.com");

  assert.deepEqual(users.rows, [user]);
  assert.deepEqual(audit.entries, [{ action: "registered", email: "ada@example.com" }]);
});

test("28: removing the AuditPort changes no test", () => {
  const audit = new AuditTrail();
  const register = new RegisterUser(new MemoryUsers(), audit);

  // The class is constructed the same way with or without the interface.
  // The port adds a file and a name; it does not add a substitutable seam.
  assert.ok(register);
  assert.equal(audit.entries.length, 0);
});

test("28: an unused port is a cost with no buyer", () => {
  const ports = ["Users", "AuditPort"];
  const usedInTests = ["Users"];
  const unused = ports.filter((port) => !usedInTests.includes(port));

  assert.deepEqual(unused, ["AuditPort"]);
});
