// 13 — Who owns the transaction
// Scenario: registering a user also records an outbox row. Both must commit together.
import { test } from "node:test";
import assert from "node:assert/strict";

type User = { id: string; email: string };

class FakeDb {
  readonly users: User[] = [];
  readonly outbox: string[] = [];
  private pendingUsers: User[] = [];
  private pendingOutbox: string[] = [];
  private depth = 0;

  begin(): void {
    this.depth += 1;
  }
  stageUser(user: User): void {
    if (this.depth === 0) throw new Error("write outside a transaction");
    this.pendingUsers.push(user);
  }
  stageOutbox(event: string): void {
    if (this.depth === 0) throw new Error("write outside a transaction");
    this.pendingOutbox.push(event);
  }
  commit(): void {
    this.users.push(...this.pendingUsers);
    this.outbox.push(...this.pendingOutbox);
    this.clear();
    this.depth = 0;
  }
  rollback(): void {
    this.clear();
    this.depth = 0;
  }
  private clear(): void {
    this.pendingUsers = [];
    this.pendingOutbox = [];
  }
}

// The application owns the boundary through an explicit port.
interface UnitOfWork {
  transaction<T>(work: () => Promise<T>): Promise<T>;
}

class DbUnitOfWork implements UnitOfWork {
  private readonly db: FakeDb;
  constructor(db: FakeDb) {
    this.db = db;
  }
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    this.db.begin();
    try {
      const result = await work();
      this.db.commit();
      return result;
    } catch (error) {
      this.db.rollback();
      throw error;
    }
  }
}

interface Users {
  save(user: User): Promise<void>;
}
class StagedUsers implements Users {
  private readonly db: FakeDb;
  constructor(db: FakeDb) {
    this.db = db;
  }
  async save(user: User): Promise<void> {
    this.db.stageUser(user);
  }
}

interface Outbox {
  add(event: string): Promise<void>;
}
class StagedOutbox implements Outbox {
  private readonly db: FakeDb;
  constructor(db: FakeDb) {
    this.db = db;
  }
  async add(event: string): Promise<void> {
    this.db.stageOutbox(event);
  }
}

class RegisterUser {
  private readonly uow: UnitOfWork;
  private readonly users: Users;
  private readonly outbox: Outbox;
  private readonly failAfterSave: boolean;

  constructor(uow: UnitOfWork, users: Users, outbox: Outbox, failAfterSave = false) {
    this.uow = uow;
    this.users = users;
    this.outbox = outbox;
    this.failAfterSave = failAfterSave;
  }

  async execute(email: string): Promise<void> {
    await this.uow.transaction(async () => {
      await this.users.save({ id: `u-${email}`, email });
      if (this.failAfterSave) throw new Error("second step failed");
      await this.outbox.add(`welcome:${email}`);
    });
  }
}

// (b) anti-pattern: the repository commits on every save.
class CommittingUsers implements Users {
  private readonly db: FakeDb;
  constructor(db: FakeDb) {
    this.db = db;
  }
  async save(user: User): Promise<void> {
    this.db.begin();
    this.db.stageUser(user);
    this.db.commit(); // the repository decides the boundary
  }
}

test("13: the unit of work rolls back both writes", async () => {
  const db = new FakeDb();
  const useCase = new RegisterUser(
    new DbUnitOfWork(db),
    new StagedUsers(db),
    new StagedOutbox(db),
    true,
  );

  await assert.rejects(() => useCase.execute("ada@example.com"), /second step/);
  assert.deepEqual(db.users, []);
  assert.deepEqual(db.outbox, []);
});

test("13: a committing repository leaves a partial write", async () => {
  const db = new FakeDb();
  const useCase = new RegisterUser(
    new DbUnitOfWork(db),
    new CommittingUsers(db), // commits before the outbox step
    new StagedOutbox(db),
    true,
  );

  await assert.rejects(() => useCase.execute("ada@example.com"), /second step/);

  assert.equal(db.users.length, 1); // the user survived the failure
  assert.deepEqual(db.outbox, []);
});
