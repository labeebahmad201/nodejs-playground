// 09 — Where validation lives
// Scenario: input shape at the edge, invariants in the domain, uniqueness in persistence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

type Order = { id: string; customerEmail: string; total: number };

// (a) correct: each layer validates what it owns.
class OrderController {
  private readonly service: OrderService;

  constructor(service: OrderService) {
    this.service = service;
  }

  create(body: { customerEmail: string; total: number }): Order {
    if (!body.customerEmail.includes("@")) {
      throw new Error("presentation: invalid email");
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
    const order = OrderModel.create(customerEmail, total);
    this.repository.save(order);
    return order;
  }
}

class OrderModel {
  static create(customerEmail: string, total: number): Order {
    if (total <= 0) throw new Error("domain: total must be positive");
    return { id: randomUUID(), customerEmail, total };
  }
}

class OrderRepository {
  private readonly emails = new Set<string>();

  save(order: Order): void {
    if (this.emails.has(order.customerEmail)) {
      throw new Error("persistence: duplicate order");
    }
    this.emails.add(order.customerEmail);
  }
}

// (b) anti-pattern: all validation is pushed into the controller.
class FatValidationController {
  private readonly rows: Order[] = [];

  create(body: { customerEmail: string; total: number }): Order {
    if (!body.customerEmail.includes("@")) throw new Error("invalid email");
    if (body.total <= 0) throw new Error("total must be positive");
    const order = {
      id: randomUUID(),
      customerEmail: body.customerEmail,
      total: body.total,
    };
    this.rows.push(order);
    return order;
  }
}

test("09: the edge rejects bad input shape", () => {
  const controller = new OrderController(new OrderService(new OrderRepository()));
  assert.throws(() => controller.create({ customerEmail: "nope", total: 10 }), /invalid email/);
});

test("09: the domain rejects an invariant violation", () => {
  const controller = new OrderController(new OrderService(new OrderRepository()));
  assert.throws(() => controller.create({ customerEmail: "a@b.com", total: -1 }), /positive/);
});

test("09: persistence rejects a duplicate", () => {
  const controller = new OrderController(new OrderService(new OrderRepository()));
  controller.create({ customerEmail: "a@b.com", total: 10 });
  assert.throws(() => controller.create({ customerEmail: "a@b.com", total: 20 }), /duplicate/);
});

test("09: the fat controller validates in the wrong place and misses uniqueness", () => {
  const controller = new FatValidationController();

  // The rule is enforced, but only in presentation; the domain never sees it.
  assert.throws(() => controller.create({ customerEmail: "a@b.com", total: -1 }), /positive/);

  controller.create({ customerEmail: "a@b.com", total: 10 });
  assert.equal(controller.create({ customerEmail: "a@b.com", total: 20 }).total, 20);
  // The duplicate was accepted because persistence has no constraint.
});
