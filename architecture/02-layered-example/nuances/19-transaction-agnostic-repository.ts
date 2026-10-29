// 19 — Repository is transaction-agnostic
// Scenario: the repository participates in a transaction; it never commits one.
import { test } from "node:test";
import assert from "node:assert/strict";

class Store {
  readonly committed: string[] = [];
  pending: string[] = [];

  begin(): void {
    this.pending = [];
  }

  stage(id: string): void {
    this.pending.push(id);
  }

  commit(): void {
    this.committed.push(...this.pending);
    this.pending = [];
  }

  rollback(): void {
    this.pending = [];
  }
}

// (a) correct: the repository only stages work.
class OrderRepository {
  private readonly store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  save(id: string): void {
    this.store.stage(id);
  }
}

class OrderService {
  private readonly store: Store;
  private readonly repository: OrderRepository;

  constructor(store: Store, repository: OrderRepository) {
    this.store = store;
    this.repository = repository;
  }

  place(id: string, shouldFail: boolean): void {
    this.store.begin();
    try {
      this.repository.save(id);
      if (shouldFail) throw new Error("downstream failure");
      this.store.commit();
    } catch (error) {
      this.store.rollback();
      throw error;
    }
  }
}

// (b) anti-pattern: the repository commits, so the service cannot roll it back.
class CommittingOrderRepository {
  private readonly store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  save(id: string): void {
    this.store.begin();
    this.store.stage(id);
    this.store.commit();
  }
}

test("19: the transaction-agnostic repository rolls back with the service", () => {
  const store = new Store();
  const service = new OrderService(store, new OrderRepository(store));

  assert.throws(() => service.place("o-1", true), /downstream/);
  assert.deepEqual(store.committed, []);
});

test("19: a committing repository survives the service rollback", () => {
  const store = new Store();
  const repository = new CommittingOrderRepository(store);

  repository.save("o-2");

  assert.deepEqual(store.committed, ["o-2"]);
  // The service has no boundary left to roll back.
});
