// 01 — Four canonical layers
// Scenario: create an order through presentation -> business -> persistence -> database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

type Order = { id: string; customerEmail: string; total: number };

// (a) correct: each layer has one responsibility.
class OrderController {
  private readonly service: OrderService;

  constructor(service: OrderService) {
    this.service = service;
  }

  create(body: { customerEmail: string; total: number }): Order {
    if (!body.customerEmail.includes("@")) {
      throw new Error("invalid email");
    }
    return this.service.create(body.customerEmail, body.total);
  }
}

class OrderService {
  private readonly repository: OrderRepository;

  constructor(repository: OrderRepository) {
    this.repository = repository;
  }

  create(customerEmail: string, total: number): Order {
    if (total <= 0) {
      throw new Error("total must be positive");
    }
    const order: Order = { id: randomUUID(), customerEmail, total };
    this.repository.save(order);
    return order;
  }
}

interface OrderRepository {
  save(order: Order): void;
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

// (b) anti-pattern: the controller does presentation, business, and persistence.
class FatController {
  private readonly rows: Order[] = [];

  create(body: { customerEmail: string; total: number }): Order {
    if (!body.customerEmail.includes("@")) {
      throw new Error("invalid email");
    }
    if (body.total <= 0) {
      throw new Error("total must be positive");
    }
    const order: Order = {
      id: randomUUID(),
      customerEmail: body.customerEmail,
      total: body.total,
    };
    this.rows.push(order);
    return order;
  }

  count(): number {
    return this.rows.length;
  }
}

// (c) tests
test("01: the four layers each do their own job", () => {
  const repository = new InMemoryOrderRepository();
  const service = new OrderService(repository);
  const controller = new OrderController(service);

  const order = controller.create({ customerEmail: "ada@example.com", total: 42 });

  assert.equal(order.total, 42);
  assert.equal(repository.all().length, 1);
});

test("01: the anti-pattern works for one entry point but has no reusable service", () => {
  const controller = new FatController();
  controller.create({ customerEmail: "ada@example.com", total: 42 });

  assert.equal(controller.count(), 1);
  // There is no service to call from a CLI, a queue consumer, or a unit test.
});
