// 17 — Batch operations
// Scenario: insert 1,000 records in one unit of work, not 1,000 commits.
import { test } from "node:test";
import assert from "node:assert/strict";

class BatchStore {
  readonly committed: string[] = [];
  commits = 0;
  private pending: string[] = [];

  begin(): void {
    this.pending = [];
  }

  stage(id: string): void {
    if (id === "bad") throw new Error("invalid row");
    this.pending.push(id);
  }

  commit(): void {
    this.committed.push(...this.pending);
    this.pending = [];
    this.commits += 1;
  }

  rollback(): void {
    this.pending = [];
  }
}

// (a) correct: one transaction for the whole batch.
class BatchOrderRepository {
  private readonly store: BatchStore;

  constructor(store: BatchStore) {
    this.store = store;
  }

  saveAll(ids: readonly string[]): void {
    this.store.begin();
    try {
      for (const id of ids) this.store.stage(id);
      this.store.commit();
    } catch (error) {
      this.store.rollback();
      throw error;
    }
  }
}

// (b) anti-pattern: each row commits on its own.
class PerRowOrderRepository {
  private readonly store: BatchStore;

  constructor(store: BatchStore) {
    this.store = store;
  }

  save(id: string): void {
    this.store.begin();
    this.store.stage(id);
    this.store.commit();
  }

  saveAll(ids: readonly string[]): void {
    for (const id of ids) this.save(id);
  }
}

test("17: the batch store commits once for the whole batch", () => {
  const store = new BatchStore();
  new BatchOrderRepository(store).saveAll(["a", "b", "c"]);

  assert.deepEqual(store.committed, ["a", "b", "c"]);
  assert.equal(store.commits, 1);
});

test("17: a failure rolls back the whole batch", () => {
  const store = new BatchStore();
  assert.throws(() => new BatchOrderRepository(store).saveAll(["a", "b", "bad"]), /invalid row/);
  assert.deepEqual(store.committed, []);
  assert.equal(store.commits, 0);
});

test("17: the per-row version leaves a partial batch", () => {
  const store = new BatchStore();
  assert.throws(() => new PerRowOrderRepository(store).saveAll(["a", "b", "bad"]), /invalid row/);

  assert.deepEqual(store.committed, ["a", "b"]); // partial write
  assert.equal(store.commits, 2);
});
