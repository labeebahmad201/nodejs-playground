// 03 — Strict vs. relaxed (closed vs. open) layers
// Scenario: a read may skip the service; a write should not.
import { test } from "node:test";
import assert from "node:assert/strict";

type Order = { id: string; total: number };

class OrderRepository {
  saveCalls = 0;
  listCalls = 0;

  save(order: Order): void {
    this.saveCalls += 1;
    void order;
  }

  list(): Order[] {
    this.listCalls += 1;
    return [];
  }
}

class OrderService {
  private readonly repository: OrderRepository;
  auditCalls = 0;

  constructor(repository: OrderRepository) {
    this.repository = repository;
  }

  create(order: Order): void {
    this.auditCalls += 1;
    this.repository.save(order);
  }
}

// (a) correct: strict for writes, relaxed for a read-only path.
class StrictWriteController {
  private readonly service: OrderService;

  constructor(service: OrderService) {
    this.service = service;
  }

  create(order: Order): void {
    this.service.create(order);
  }
}

class RelaxedReadController {
  private readonly repository: OrderRepository;

  constructor(repository: OrderRepository) {
    this.repository = repository;
  }

  list(): Order[] {
    return this.repository.list();
  }
}

// (b) anti-pattern: a write skips the service, so policy and audit are bypassed.
class RelaxedWriteController {
  private readonly repository: OrderRepository;

  constructor(repository: OrderRepository) {
    this.repository = repository;
  }

  create(order: Order): void {
    this.repository.save(order);
  }
}

test("03: a strict write goes through the service and is audited", () => {
  const repository = new OrderRepository();
  const service = new OrderService(repository);
  const controller = new StrictWriteController(service);

  controller.create({ id: "o-1", total: 10 });

  assert.equal(service.auditCalls, 1);
  assert.equal(repository.saveCalls, 1);
});

test("03: a relaxed read may skip the service without losing policy", () => {
  const repository = new OrderRepository();
  const service = new OrderService(repository);
  const controller = new RelaxedReadController(repository);

  controller.list();

  assert.equal(service.auditCalls, 0);
  assert.equal(repository.listCalls, 1);
});

test("03: a relaxed write bypasses the service and its audit", () => {
  const repository = new OrderRepository();
  const service = new OrderService(repository);
  const controller = new RelaxedWriteController(repository);

  controller.create({ id: "o-2", total: 10 });

  assert.equal(repository.saveCalls, 1);
  assert.equal(service.auditCalls, 0); // the smell
});
