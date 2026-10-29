// 30 — Caching
// Scenario: cache at the service boundary, invalidate on write.
import { test } from "node:test";
import assert from "node:assert/strict";

type Order = { id: string; total: number };

class OrderRepository {
  readonly rows = new Map<string, Order>();
  reads = 0;

  findById(id: string): Order | undefined {
    this.reads += 1;
    return this.rows.get(id);
  }

  save(order: Order): void {
    this.rows.set(order.id, order);
  }
}

// (a) correct: cache-aside at the service; writes invalidate.
class CachedOrderService {
  private readonly repository: OrderRepository;
  private readonly cache = new Map<string, Order>();

  constructor(repository: OrderRepository) {
    this.repository = repository;
  }

  get(id: string): Order | undefined {
    const cached = this.cache.get(id);
    if (cached) return cached;

    const order = this.repository.findById(id);
    if (order) this.cache.set(id, order);
    return order;
  }

  save(order: Order): void {
    this.repository.save(order);
    this.cache.delete(order.id);
  }
}

// (b) anti-pattern: the repository caches forever and never invalidates.
class ForeverCachingRepository {
  private readonly repository = new OrderRepository();
  private readonly cache = new Map<string, Order>();

  findById(id: string): Order | undefined {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const order = this.repository.findById(id);
    if (order) this.cache.set(id, order);
    return order;
  }

  save(order: Order): void {
    this.repository.save(order);
    // no invalidation
  }
}

test("30: the service cache avoids a second repository read", () => {
  const repository = new OrderRepository();
  repository.save({ id: "o-1", total: 10 });
  const service = new CachedOrderService(repository);

  service.get("o-1");
  service.get("o-1");

  assert.equal(repository.reads, 1);
});

test("30: a write invalidates the service cache", () => {
  const repository = new OrderRepository();
  repository.save({ id: "o-1", total: 10 });
  const service = new CachedOrderService(repository);

  assert.equal(service.get("o-1")?.total, 10);
  service.save({ id: "o-1", total: 20 });
  assert.equal(service.get("o-1")?.total, 20);
  assert.equal(repository.reads, 2);
});

test("30: the repository cache serves stale data after a write", () => {
  const repository = new ForeverCachingRepository();
  repository.save({ id: "o-1", total: 10 });
  assert.equal(repository.findById("o-1")?.total, 10);

  repository.save({ id: "o-1", total: 20 });
  assert.equal(repository.findById("o-1")?.total, 10); // stale
});
