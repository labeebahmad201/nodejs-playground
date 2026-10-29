// 14 — Repository interface vs. implementation
// Scenario: the service depends on the contract; the adapter chooses the store.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

type Order = { id: string; total: number };

interface OrderRepository {
  save(order: Order): void;
  all(): readonly Order[];
}

class InMemoryOrderRepository implements OrderRepository {
  private readonly rows: Order[] = [];

  save(order: Order): void {
    this.rows.push(order);
  }

  all(): readonly Order[] {
    return this.rows;
  }
}

class SqlLikeOrderRepository implements OrderRepository {
  private readonly rows: Order[] = [];

  save(order: Order): void {
    this.rows.push({ ...order, id: `sql-${order.id}` });
  }

  all(): readonly Order[] {
    return this.rows;
  }
}

// (a) correct: the service depends only on the interface.
class OrderService {
  private readonly repository: OrderRepository;

  constructor(repository: OrderRepository) {
    this.repository = repository;
  }

  create(total: number): Order {
    const order: Order = { id: randomUUID(), total };
    this.repository.save(order);
    return order;
  }
}

// (b) anti-pattern: the service constructs its own concrete repository.
class BadOrderService {
  private readonly repository = new InMemoryOrderRepository();

  create(total: number): Order {
    const order: Order = { id: randomUUID(), total };
    this.repository.save(order);
    return order;
  }

  count(): number {
    return this.repository.all().length;
  }
}

test("14: the same service works with either adapter", () => {
  const memory = new InMemoryOrderRepository();
  const sql = new SqlLikeOrderRepository();

  new OrderService(memory).create(10);
  new OrderService(sql).create(20);

  assert.equal(memory.all()[0]?.total, 10);
  assert.equal(sql.all()[0]?.id.startsWith("sql-"), true);
});

test("14: the bad service cannot be given a different adapter", () => {
  const service = new BadOrderService();
  service.create(10);

  assert.equal(service.count(), 1);
  // There is no constructor parameter to swap for a fake or a SQL adapter.
});
