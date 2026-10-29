// 25 — Idempotency
// Scenario: the same request key creates one order, not two.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

type Order = { id: string; idempotencyKey: string; total: number };

// (a) correct: a dedupe table keyed by the client's idempotency key.
class OrderStore {
  private readonly byKey = new Map<string, Order>();

  create(key: string, total: number): Order {
    const existing = this.byKey.get(key);
    if (existing) return existing;

    const order: Order = { id: randomUUID(), idempotencyKey: key, total };
    this.byKey.set(key, order);
    return order;
  }

  count(): number {
    return this.byKey.size;
  }
}

// (b) anti-pattern: every retry creates a new order.
class BadOrderStore {
  private readonly orders: Order[] = [];

  create(key: string, total: number): Order {
    const order: Order = { id: randomUUID(), idempotencyKey: key, total };
    this.orders.push(order);
    return order;
  }

  count(): number {
    return this.orders.length;
  }
}

test("25: the same key returns the same order", () => {
  const store = new OrderStore();

  const first = store.create("checkout-123", 42);
  const second = store.create("checkout-123", 42);

  assert.equal(second.id, first.id);
  assert.equal(store.count(), 1);
});

test("25: different keys create different orders", () => {
  const store = new OrderStore();

  const first = store.create("checkout-123", 42);
  const second = store.create("checkout-124", 42);

  assert.notEqual(second.id, first.id);
  assert.equal(store.count(), 2);
});

test("25: the retry-unsafe store creates a duplicate", () => {
  const store = new BadOrderStore();

  store.create("checkout-123", 42);
  store.create("checkout-123", 42);

  assert.equal(store.count(), 2);
});
