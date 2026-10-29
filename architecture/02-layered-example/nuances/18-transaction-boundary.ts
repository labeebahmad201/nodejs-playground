// 18 — Transaction boundary at the service layer
// Scenario: a transfer must debit and credit in one unit of work.
import { test } from "node:test";
import assert from "node:assert/strict";

class AccountStore {
  private balances = new Map([
    ["a", 100],
    ["b", 100],
  ]);
  private snapshot: Map<string, number> | null = null;

  begin(): void {
    this.snapshot = new Map(this.balances);
  }

  commit(): void {
    this.snapshot = null;
  }

  rollback(): void {
    if (this.snapshot) this.balances = new Map(this.snapshot);
    this.snapshot = null;
  }

  get(id: string): number {
    return this.balances.get(id) ?? 0;
  }

  set(id: string, value: number): void {
    this.balances.set(id, value);
  }
}

class UnitOfWork {
  private readonly store: AccountStore;

  constructor(store: AccountStore) {
    this.store = store;
  }

  run<T>(work: () => T): T {
    this.store.begin();
    try {
      const result = work();
      this.store.commit();
      return result;
    } catch (error) {
      this.store.rollback();
      throw error;
    }
  }
}

class AccountRepository {
  private readonly store: AccountStore;

  constructor(store: AccountStore) {
    this.store = store;
  }

  debit(id: string, amount: number): void {
    this.store.set(id, this.store.get(id) - amount);
  }

  credit(id: string, amount: number): void {
    this.store.set(id, this.store.get(id) + amount);
  }
}

// (a) correct: the service owns one transaction around both repository calls.
class TransferService {
  private readonly uow: UnitOfWork;
  private readonly repository: AccountRepository;

  constructor(uow: UnitOfWork, repository: AccountRepository) {
    this.uow = uow;
    this.repository = repository;
  }

  transfer(from: string, to: string, amount: number): void {
    this.uow.run(() => {
      this.repository.debit(from, amount);
      if (amount > 100) throw new Error("transfer limit exceeded");
      this.repository.credit(to, amount);
    });
  }
}

// (b) anti-pattern: each repository call commits on its own.
class BadTransferService {
  private readonly store: AccountStore;
  private readonly repository: AccountRepository;

  constructor(store: AccountStore, repository: AccountRepository) {
    this.store = store;
    this.repository = repository;
  }

  transfer(from: string, to: string, amount: number): void {
    this.store.begin();
    this.repository.debit(from, amount);
    this.store.commit();

    if (amount > 100) throw new Error("transfer limit exceeded");

    this.store.begin();
    this.repository.credit(to, amount);
    this.store.commit();
  }
}

test("18: the service boundary rolls back the debit when the transfer fails", () => {
  const store = new AccountStore();
  const service = new TransferService(
    new UnitOfWork(store),
    new AccountRepository(store),
  );

  assert.throws(() => service.transfer("a", "b", 150), /limit/);
  assert.equal(store.get("a"), 100);
  assert.equal(store.get("b"), 100);
});

test("18: the per-call boundary leaves a partial transfer", () => {
  const store = new AccountStore();
  const service = new BadTransferService(store, new AccountRepository(store));

  assert.throws(() => service.transfer("a", "b", 150), /limit/);
  assert.equal(store.get("a"), -50); // the debit committed
  assert.equal(store.get("b"), 100);
});
