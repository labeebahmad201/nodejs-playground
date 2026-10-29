// 32 — Dependency injection / wiring
// Scenario: the composition root chooses the concrete classes and hands them
// down. Each service receives a port; it never constructs the implementation.
import { test } from "node:test";
import assert from "node:assert/strict";

type Order = { id: string; total: number };

interface OrderRepository {
  save(order: Order): void;
}

class InMemoryOrderRepository implements OrderRepository {
  readonly rows: Order[] = [];

  save(order: Order): void {
    this.rows.push(order);
  }
}

class SpyOrderRepository implements OrderRepository {
  saves = 0;

  save(_order: Order): void {
    this.saves += 1;
  }
}

class OrderService {
  private readonly orders: OrderRepository;

  constructor(orders: OrderRepository) {
    this.orders = orders;
  }

  create(total: number): Order {
    const order = { id: `o-${total}`, total };
    this.orders.save(order);
    return order;
  }
}

class OrderController {
  private readonly service: OrderService;

  constructor(service: OrderService) {
    this.service = service;
  }

  create(total: number): Order {
    return this.service.create(total);
  }
}

// (a) correct: the root is the only place that knows the concrete class.
function createApp(deps: { orders: OrderRepository }): OrderController {
  return new OrderController(new OrderService(deps.orders));
}

// (b) anti-pattern: the service chooses its own concrete, so nobody outside
// can replace it — and every instance gets its own private store.
class BadOrderService {
  private readonly orders = new InMemoryOrderRepository();

  create(total: number): Order {
    const order = { id: `bad-${total}`, total };
    this.orders.save(order);
    return order;
  }

  count(): number {
    return this.orders.rows.length;
  }
}

test("32: the root can inject a test double", () => {
  const repository = new SpyOrderRepository();
  createApp({ orders: repository }).create(10);
  assert.equal(repository.saves, 1);
});

test("32: the same service class works with any implementation", () => {
  const memory = new InMemoryOrderRepository();
  createApp({ orders: memory }).create(20);

  const spy = new SpyOrderRepository();
  createApp({ orders: spy }).create(30);

  assert.equal(memory.rows.length, 1);
  assert.equal(spy.saves, 1);
});

test("32: the anti-pattern gives every instance a private store", () => {
  const a = new BadOrderService();
  const b = new BadOrderService();

  a.create(10);

  // The write in `a` is invisible to `b`: two pools, two caches, two worlds.
  assert.equal(a.count(), 1);
  assert.equal(b.count(), 0);
});
