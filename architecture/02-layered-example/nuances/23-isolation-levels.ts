// 23 — Isolation levels
// Scenario: a small MVCC model shows dirty reads, non-repeatable reads, phantoms,
// and write skew — the anomaly that survives REPEATABLE_READ.
// It is a teaching model, not a real database engine.
import { test } from "node:test";
import assert from "node:assert/strict";

type Isolation =
  | "READ_UNCOMMITTED"
  | "READ_COMMITTED"
  | "REPEATABLE_READ"
  | "SERIALIZABLE";

type Tx = {
  snapshot: Map<string, number> | null;
  writes: Map<string, number>;
};

// (a) correct: choose the isolation level for the anomaly you cannot tolerate.
class Db {
  private committed = new Map<string, number>();
  private pending = new Map<string, number>();

  seed(rows: Record<string, number>): void {
    for (const [id, value] of Object.entries(rows)) this.committed.set(id, value);
  }

  begin(): Tx {
    return { snapshot: null, writes: new Map() };
  }

  write(tx: Tx, id: string, value: number): void {
    tx.writes.set(id, value);
    this.pending.set(id, value);
  }

  commit(tx: Tx): void {
    for (const [id, value] of tx.writes) this.committed.set(id, value);
    tx.writes.clear();
    this.pending.clear();
  }

  rollback(tx: Tx): void {
    tx.writes.clear();
    this.pending.clear();
  }

  read(level: Isolation, tx: Tx, id: string): number {
    if (level === "READ_UNCOMMITTED") {
      return this.pending.get(id) ?? this.committed.get(id) ?? 0;
    }
    if (level === "READ_COMMITTED") {
      return this.committed.get(id) ?? 0;
    }
    return this.snapshot(tx).get(id) ?? 0;
  }

  list(level: Isolation, tx: Tx): string[] {
    if (level === "READ_UNCOMMITTED") {
      return [...new Set([...this.committed.keys(), ...this.pending.keys()])].sort();
    }
    if (level === "READ_COMMITTED") {
      return [...this.committed.keys()].sort();
    }
    return [...this.snapshot(tx).keys()].sort();
  }

  private snapshot(tx: Tx): Map<string, number> {
    if (!tx.snapshot) tx.snapshot = new Map(this.committed);
    return tx.snapshot;
  }
}

// (b) anti-pattern: READ_UNCOMMITTED trades correctness for concurrency.
function readFast(db: Db, tx: Tx, id: string): number {
  return db.read("READ_UNCOMMITTED", tx, id);
}

// Count the rows whose value is 1 ("on call") through a given isolation level.
function onCall(db: Db, level: Isolation, tx: Tx): number {
  return db.list(level, tx).filter((id) => db.read(level, tx, id) === 1).length;
}

test("23: READ_UNCOMMITTED allows a dirty read", () => {
  const db = new Db();
  db.seed({ a: 1 });
  const writer = db.begin();
  const reader = db.begin();

  db.write(writer, "a", 2);

  assert.equal(readFast(db, reader, "a"), 2);
  assert.equal(db.read("READ_COMMITTED", reader, "a"), 1);
  db.rollback(writer);
});

test("23: READ_COMMITTED allows a non-repeatable read", () => {
  const db = new Db();
  db.seed({ a: 1 });
  const reader = db.begin();

  assert.equal(db.read("READ_COMMITTED", reader, "a"), 1);

  const writer = db.begin();
  db.write(writer, "a", 2);
  db.commit(writer);

  assert.equal(db.read("READ_COMMITTED", reader, "a"), 2);
});

test("23: REPEATABLE_READ pins the snapshot", () => {
  const db = new Db();
  db.seed({ a: 1 });
  const reader = db.begin();

  assert.equal(db.read("REPEATABLE_READ", reader, "a"), 1);

  const writer = db.begin();
  db.write(writer, "a", 2);
  db.commit(writer);

  assert.equal(db.read("REPEATABLE_READ", reader, "a"), 1);
});

test("23: REPEATABLE_READ pins the snapshot but still allows write skew", () => {
  const db = new Db();
  db.seed({ alice: 1, bob: 1 }); // 1 = on call
  const a = db.begin();
  const b = db.begin();

  // Both transactions read the same pinned snapshot: two doctors on call.
  assert.equal(onCall(db, "REPEATABLE_READ", a), 2);
  assert.equal(onCall(db, "REPEATABLE_READ", b), 2);

  // Each one reasons: "the other is still on call, so I can go off call."
  db.write(a, "alice", 0);
  db.write(b, "bob", 0);
  db.commit(a);
  db.commit(b);

  // No write conflicted with another write, so nothing aborted.
  assert.equal(onCall(db, "READ_COMMITTED", db.begin()), 0);
});

test("23: READ_COMMITTED sees a phantom; REPEATABLE_READ does not", () => {
  const db = new Db();
  db.seed({ a: 1 });
  const reader = db.begin();

  assert.deepEqual(db.list("READ_COMMITTED", reader), ["a"]);

  const writer = db.begin();
  db.write(writer, "b", 2);
  db.commit(writer);

  assert.deepEqual(db.list("READ_COMMITTED", reader), ["a", "b"]);

  const repeatable = db.begin();
  assert.deepEqual(db.list("REPEATABLE_READ", repeatable), ["a", "b"]);

  const writer2 = db.begin();
  db.write(writer2, "c", 3);
  db.commit(writer2);

  assert.deepEqual(db.list("REPEATABLE_READ", repeatable), ["a", "b"]);
});
