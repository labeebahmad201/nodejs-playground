// 06 — Sinkhole anti-pattern
// Scenario: a service that only forwards to the repository adds no value.
import { test } from "node:test";
import assert from "node:assert/strict";

type Order = { id: string; total: number };

class OrderRepository {
  readonly saved: string[] = [];

  save(order: Order): void {
    this.saved.push(order.id);
  }
}

class AuditLog {
  readonly entries: string[] = [];

  record(orderId: string): void {
    this.entries.push(orderId);
  }
}

// (a) correct: the service adds validation and an audit effect.
class OrderService {
  private readonly repository: OrderRepository;
  private readonly audit: AuditLog;

  constructor(repository: OrderRepository, audit: AuditLog) {
    this.repository = repository;
    this.audit = audit;
  }

  place(order: Order): void {
    if (order.total <= 0) throw new Error("total must be positive");
    this.repository.save(order);
    this.audit.record(order.id);
  }
}

// (b) anti-pattern: the service is a pass-through.
class PassThroughOrderService {
  private readonly repository: OrderRepository;

  constructor(repository: OrderRepository) {
    this.repository = repository;
  }

  place(order: Order): void {
    this.repository.save(order);
  }
}

test("06: the real service adds validation and audit", () => {
  const repository = new OrderRepository();
  const audit = new AuditLog();
  const service = new OrderService(repository, audit);

  service.place({ id: "o-1", total: 10 });

  assert.deepEqual(repository.saved, ["o-1"]);
  assert.deepEqual(audit.entries, ["o-1"]);
  assert.throws(() => service.place({ id: "o-2", total: -1 }), /positive/);
});

test("06: the pass-through service only saves", () => {
  const repository = new OrderRepository();
  const service = new PassThroughOrderService(repository);

  service.place({ id: "o-3", total: -1 });

  assert.deepEqual(repository.saved, ["o-3"]);
  // It accepted an invalid order because the layer added nothing.
});
