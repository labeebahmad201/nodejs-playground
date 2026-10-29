// 14 — External calls outside the transaction
// Scenario: save the user and an outbox row atomically; let a relay send the welcome.
import { test } from "node:test";
import assert from "node:assert/strict";

type User = { id: string; email: string };

class FakeDb {
  readonly users: User[] = [];
  readonly outbox: string[] = [];
  private open = false;

  begin(): void {
    this.open = true;
  }
  commit(): void {
    this.open = false;
  }
  rollback(): void {
    this.users.length = 0;
    this.open = false;
  }
  saveUser(user: User): void {
    if (!this.open) throw new Error("outside transaction");
    this.users.push(user);
  }
  addOutbox(event: string): void {
    if (!this.open) throw new Error("outside transaction");
    this.outbox.push(event);
  }
}

class Notifier {
  readonly sent: string[] = [];
  fail = false;
  async welcome(email: string): Promise<void> {
    if (this.fail) throw new Error("provider down");
    this.sent.push(email);
  }
}

// (a) correct: the transaction stages state plus an event; the relay runs after commit.
class RegisterUser {
  private readonly db: FakeDb;
  constructor(db: FakeDb) {
    this.db = db;
  }
  async execute(email: string): Promise<void> {
    this.db.begin();
    try {
      this.db.saveUser({ id: `u-${email}`, email });
      this.db.addOutbox(`welcome:${email}`);
      this.db.commit();
    } catch (error) {
      this.db.rollback();
      throw error;
    }
  }
}

async function relayOnce(db: FakeDb, notifier: Notifier): Promise<void> {
  const event = db.outbox.shift();
  if (!event) return;
  const email = event.replace("welcome:", "");
  try {
    await notifier.welcome(email);
  } catch {
    db.outbox.unshift(event); // at-least-once: put it back for the next run
  }
}

// (b) anti-pattern: the mail is sent inside the transaction.
class InlineNotifyRegister {
  private readonly db: FakeDb;
  private readonly notifier: Notifier;
  constructor(db: FakeDb, notifier: Notifier) {
    this.db = db;
    this.notifier = notifier;
  }
  async execute(email: string): Promise<void> {
    this.db.begin();
    try {
      this.db.saveUser({ id: `u-${email}`, email });
      await this.notifier.welcome(email); // network I/O inside the transaction
      this.db.commit();
    } catch (error) {
      this.db.rollback(); // the user is gone; the mail is not
      throw error;
    }
  }
}

test("14: the outbox keeps the write and the notification consistent", async () => {
  const db = new FakeDb();
  const notifier = new Notifier();
  notifier.fail = true;

  await new RegisterUser(db).execute("ada@example.com");
  await relayOnce(db, notifier); // fails, event returns to the outbox

  assert.equal(db.users.length, 1);
  assert.deepEqual(db.outbox, ["welcome:ada@example.com"]);

  notifier.fail = false;
  await relayOnce(db, notifier);

  assert.deepEqual(notifier.sent, ["ada@example.com"]);
  assert.deepEqual(db.outbox, []);
});

test("14: an inline send survives the rollback", async () => {
  const db = new FakeDb();
  const notifier = new Notifier();
  notifier.fail = true;

  await assert.rejects(() => new InlineNotifyRegister(db, notifier).execute("ada@example.com"));

  assert.deepEqual(db.users, []);
  // The provider was called, but the transaction says nothing happened.
  // A retry calls it again: the side effect is not atomic with the write.
});
