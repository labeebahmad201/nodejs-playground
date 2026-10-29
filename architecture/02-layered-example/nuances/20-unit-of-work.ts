// 20 — Callback-based transaction pattern (Unit of Work)
// Scenario: db.transaction(work) owns begin, commit, and rollback.
import { test } from "node:test";
import assert from "node:assert/strict";

class FakeDb {
  readonly log: string[] = [];
  readonly committed: string[] = [];
  pending: string[] = [];

  // (a) correct: one callback owns begin, commit, and rollback.
  transaction<T>(work: () => T): T {
    this.begin();
    try {
      const result = work();
      this.commit();
      return result;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  // (b) anti-pattern: manual begin/commit with no rollback path.
  manual<T>(work: () => T): T {
    this.begin();
    const result = work();
    this.commit();
    return result;
  }

  private begin(): void {
    this.log.push("BEGIN");
    this.pending = [];
  }

  private commit(): void {
    this.log.push("COMMIT");
    this.committed.push(...this.pending);
    this.pending = [];
  }

  private rollback(): void {
    this.log.push("ROLLBACK");
    this.pending = [];
  }
}

function placeOrder(db: FakeDb, id: string, shouldFail: boolean): void {
  db.transaction(() => {
    db.pending.push(id);
    if (shouldFail) throw new Error("order failed");
  });
}

test("20: the callback rolls back when the work throws", () => {
  const db = new FakeDb();

  assert.throws(() => placeOrder(db, "o-1", true), /order failed/);

  assert.deepEqual(db.log, ["BEGIN", "ROLLBACK"]);
  assert.deepEqual(db.committed, []);
});

test("20: the manual version has no rollback path", () => {
  const db = new FakeDb();

  assert.throws(() => db.manual(() => {
    db.pending.push("o-2");
    throw new Error("order failed");
  }), /order failed/);

  assert.deepEqual(db.log, ["BEGIN"]); // no COMMIT and no ROLLBACK
  assert.deepEqual(db.committed, []);
  assert.deepEqual(db.pending, ["o-2"]); // the transaction is left dirty
});
