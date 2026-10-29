// 21 — Passing the tx handle
// Scenario: every operation inside the unit of work must use the same connection.
import { test } from "node:test";
import assert from "node:assert/strict";

class Transaction {
  readonly id: number;
  readonly pending: string[] = [];
  readonly committed: string[] = [];

  constructor(id: number) {
    this.id = id;
  }

  commit(): void {
    this.committed.push(...this.pending);
    this.pending.length = 0;
  }

  rollback(): void {
    this.pending.length = 0;
  }
}

class Db {
  private nextId = 1;
  readonly defaultTransaction = new Transaction(0);

  // (a) correct: every repository call receives the caller's transaction.
  transaction<T>(work: (tx: Transaction) => T): T {
    const tx = new Transaction(this.nextId++);
    try {
      const result = work(tx);
      tx.commit();
      return result;
    } catch (error) {
      tx.rollback();
      throw error;
    }
  }
}

class OrderRepository {
  save(tx: Transaction, id: string): void {
    tx.pending.push(id);
  }

  // (b) anti-pattern: a second write escapes the caller's transaction.
  saveOnDefault(db: Db, id: string): void {
    db.defaultTransaction.pending.push(id);
    db.defaultTransaction.commit();
  }
}

test("21: using the same tx handle keeps the unit atomic", () => {
  const db = new Db();
  const repository = new OrderRepository();

  assert.throws(() => db.transaction((tx) => {
    repository.save(tx, "order");
    repository.save(tx, "payment");
    throw new Error("payment failed");
  }), /payment failed/);

  assert.deepEqual(db.defaultTransaction.committed, []);
});

test("21: a default-connection write survives the rollback", () => {
  const db = new Db();
  const repository = new OrderRepository();

  assert.throws(() => db.transaction((tx) => {
    repository.save(tx, "order");
    repository.saveOnDefault(db, "payment");
    throw new Error("payment failed");
  }), /payment failed/);

  assert.deepEqual(db.defaultTransaction.committed, ["payment"]);
});
