// 24 — Optimistic vs. pessimistic locking
// Scenario: two concurrent writers update the same row.
import { test } from "node:test";
import assert from "node:assert/strict";

class Conflict extends Error {
  constructor() {
    super("stale version");
    this.name = "Conflict";
  }
}

class Busy extends Error {
  constructor() {
    super("row is locked");
    this.name = "Busy";
  }
}

// (a) correct: a version check or a lock makes concurrent writes explicit.
class VersionedRow {
  value: number;
  version: number;

  constructor(value: number) {
    this.value = value;
    this.version = 1;
  }
}

class OptimisticStore {
  private readonly row = new VersionedRow(100);

  read(): { value: number; version: number } {
    return { value: this.row.value, version: this.row.version };
  }

  update(expectedVersion: number, value: number): void {
    if (this.row.version !== expectedVersion) throw new Conflict();
    this.row.value = value;
    this.row.version += 1;
  }
}

class RowLock {
  private held = false;

  acquire(): void {
    if (this.held) throw new Busy();
    this.held = true;
  }

  release(): void {
    this.held = false;
  }
}

function selectForUpdate<T>(lock: RowLock, work: () => T): T {
  lock.acquire();
  try {
    return work();
  } finally {
    lock.release();
  }
}

// (b) anti-pattern: last write wins, so the first update is silently lost.
class BlindWriteStore {
  private value = 100;

  read(): number {
    return this.value;
  }

  update(value: number): void {
    this.value = value;
  }
}

test("24: optimistic locking rejects the second stale write", () => {
  const store = new OptimisticStore();
  const first = store.read();
  const second = store.read();

  store.update(first.version, 80);
  assert.throws(() => store.update(second.version, 70), Conflict);
  assert.deepEqual(store.read(), { value: 80, version: 2 });
});

test("24: the blind write loses the first update", () => {
  const store = new BlindWriteStore();

  assert.equal(store.read(), 100);
  store.update(80);
  store.update(70);

  assert.equal(store.read(), 70);
  // The 80 write was overwritten without a version check.
});

test("24: pessimistic locking makes the second writer wait or fail", () => {
  const lock = new RowLock();

  selectForUpdate(lock, () => {
    assert.throws(() => lock.acquire(), Busy);
  });

  assert.doesNotThrow(() => lock.acquire());
  lock.release();
});
