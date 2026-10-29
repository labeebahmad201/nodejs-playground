// 04 — Layer skipping
// Scenario: reading a list may skip the service; writing an order may not.
import { test } from "node:test";
import assert from "node:assert/strict";

type Operation = "read" | "write";

function maySkipService(operation: Operation): boolean {
  return operation === "read";
}

type Order = { id: string; total: number };

class OrderRepository {
  readonly rows: Order[] = [];

  save(order: Order): void {
    this.rows.push(order);
  }

  list(): readonly Order[] {
    return this.rows;
  }
}

class OrderService {
  private readonly repository: OrderRepository;

  constructor(repository: OrderRepository) {
    this.repository = repository;
  }

  create(order: Order): void {
    if (order.total <= 0) {
      throw new Error("total must be positive");
    }
    this.repository.save(order);
  }
}

// (a) correct: the read skips the service; the write does not.
class ReadController {
  private readonly repository: OrderRepository;

  constructor(repository: OrderRepository) {
    this.repository = repository;
  }

  list(): readonly Order[] {
    return this.repository.list();
  }
}

class WriteController {
  private readonly service: OrderService;

  constructor(service: OrderService) {
    this.service = service;
  }

  create(order: Order): void {
    this.service.create(order);
  }
}

// (b) anti-pattern: the write skips the service and loses the invariant.
class WriteControllerSkippingService {
  private readonly repository: OrderRepository;

  constructor(repository: OrderRepository) {
    this.repository = repository;
  }

  create(order: Order): void {
    this.repository.save(order); // no validation, no transaction, no audit
  }
}

test("04: skipping is allowed for a read-only path", () => {
  const repository = new OrderRepository();
  repository.save({ id: "o-1", total: 10 });
  const controller = new ReadController(repository);

  assert.equal(controller.list().length, 1);
  assert.equal(maySkipService("read"), true);
});

test("04: skipping a write bypasses the service invariant", () => {
  const repository = new OrderRepository();
  const controller = new WriteControllerSkippingService(repository);

  controller.create({ id: "o-2", total: -10 });

  assert.equal(repository.rows.length, 1);
  assert.equal(maySkipService("write"), false);

  const service = new OrderService(repository);
  const correct = new WriteController(service);
  assert.throws(() => correct.create({ id: "o-3", total: -10 }), /positive/);
});
