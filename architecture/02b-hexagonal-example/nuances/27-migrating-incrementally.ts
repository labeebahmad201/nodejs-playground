// 27 — Migrating incrementally
// Scenario: a legacy registration service is wrapped behind a port and replaced one
// use case at a time.
import { test } from "node:test";
import assert from "node:assert/strict";

type Account = { id: string; email: string };

// The new port the rest of the system will use.
interface Registration {
  register(email: string): Promise<Account>;
}

// The old class, with its own shape and side effects.
class LegacyRegistration {
  readonly accounts: Account[] = [];
  createAccount(email: string): Account {
    const account = { id: `legacy-${this.accounts.length + 1}`, email };
    this.accounts.push(account);
    return account;
  }
}

// (a) correct: an adapter delegates to the legacy code; callers see only the port.
class LegacyRegistrationAdapter implements Registration {
  private readonly legacy: LegacyRegistration;
  constructor(legacy: LegacyRegistration) {
    this.legacy = legacy;
  }
  async register(email: string): Promise<Account> {
    return this.legacy.createAccount(email);
  }
}

class RegisterUser {
  private readonly registration: Registration;
  constructor(registration: Registration) {
    this.registration = registration;
  }
  async execute(email: string): Promise<Account> {
    return this.registration.register(email);
  }
}

// (b) anti-pattern: the big-bang rewrite keeps both systems live and writes twice.
class DoubleWriteRegistration implements Registration {
  private readonly legacy: LegacyRegistration;
  readonly newAccounts: Account[] = [];
  constructor(legacy: LegacyRegistration) {
    this.legacy = legacy;
  }
  async register(email: string): Promise<Account> {
    const old = this.legacy.createAccount(email);
    const fresh = { id: `new-${this.newAccounts.length + 1}`, email };
    this.newAccounts.push(fresh);
    return { id: old.id, email }; // which one is the source of truth?
  }
}

test("27: the adapter lets the new use case run on the old service", async () => {
  const legacy = new LegacyRegistration();
  const useCase = new RegisterUser(new LegacyRegistrationAdapter(legacy));

  const account = await useCase.execute("ada@example.com");

  assert.equal(account.id, "legacy-1");
  assert.equal(legacy.accounts.length, 1);
});

test("27: the double write leaves two records for one registration", async () => {
  const legacy = new LegacyRegistration();
  const migration = new DoubleWriteRegistration(legacy);

  await migration.register("ada@example.com");

  assert.equal(legacy.accounts.length, 1);
  assert.equal(migration.newAccounts.length, 1);
  // Two stores, two ids, one user. The next reader has to guess which is authoritative.
});
