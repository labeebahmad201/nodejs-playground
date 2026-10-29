// 35 — Unit testing per layer
// Scenario: test each layer with a fake for the layer below, not one giant integration test.
import { test } from "node:test";
import assert from "node:assert/strict";

type Order = { id: string; total: number };

interface OrderRepository {
  save(order: Order): void;
}

// (a) correct: each layer is tested with a fake for the layer below.
class FakeOrderRepository implements OrderRepository {
  readonly saved: Order[] = [];

  save(order: Order): void {
    this.saved.push(order);
  }
}

class OrderService {
  private readonly repository: OrderRepository;

  constructor(repository: OrderRepository) {
    this.repository = repository;
  }

  create(total: number): Order {
    if (total <= 0) throw new Error("total must be positive");
    const order = { id: `o-${total}`, total };
    this.repository.save(order);
    return order;
  }
}

class SpyOrderService {
  calls = 0;

  create(total: number): Order {
    this.calls += 1;
    return { id: `o-${total}`, total };
  }
}

class OrderController {
  private readonly service: SpyOrderService;

  constructor(service: SpyOrderService) {
    this.service = service;
  }

  create(total: number): Order {
    return this.service.create(total);
  }
}

// (b) anti-pattern: every test needs the real database and the full stack.
class RealDb {
  connections = 0;

  connect(): void {
    this.connections += 1;
  }
}

test("35: the service is tested with a fake repository", () => {
  const repository = new FakeOrderRepository();
  const service = new OrderService(repository);

  service.create(10);

  assert.equal(repository.saved.length, 1);
  assert.equal(repository.saved[0]?.total, 10);
});

test("35: the controller is tested with a fake service", () => {
  const service = new SpyOrderService();
  const controller = new OrderController(service);

  controller.create(20);

  assert.equal(service.calls, 1);
});

test("35: the domain rule is tested directly", () => {
  const service = new OrderService(new FakeOrderRepository());
  assert.throws(() => service.create(-1), /positive/);
});

test("35: the anti-pattern couples every test to a real database", () => {
  const db = new RealDb();
  db.connect();

  assert.equal(db.connections, 1);
  // The test now needs infrastructure just to check a business rule.
});
