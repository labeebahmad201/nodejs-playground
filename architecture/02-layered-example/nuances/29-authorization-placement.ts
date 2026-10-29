// 29 — Authorization placement
// Scenario: the edge answers "who are you"; the service answers "may you do
// this to this order". The second answer needs the object, so it lives with it.
import { test } from "node:test";
import assert from "node:assert/strict";

type Role = "customer" | "support";
type User = { id: string; role: Role; authenticated: boolean };
type Order = {
  id: string;
  ownerId: string;
  total: number;
  status: "paid" | "refunded";
};

class Unauthenticated extends Error {}
class NotAllowed extends Error {}

class InMemoryOrders {
  private readonly rows = new Map<string, Order>();

  constructor(seed: Order[]) {
    for (const order of seed) this.rows.set(order.id, { ...order });
  }

  find(id: string): Order {
    const row = this.rows.get(id);
    if (!row) throw new Error(`no such order: ${id}`);
    return row;
  }

  save(order: Order): void {
    this.rows.set(order.id, order);
  }
}

// The rule needs the order (owner, status, amount), so it lives with the order.
class RefundPolicy {
  canRefund(user: User, order: Order): boolean {
    if (order.status === "refunded") return false;
    if (user.role === "support") return true;
    return order.ownerId === user.id && order.total <= 100;
  }
}

class RefundService {
  private readonly orders: InMemoryOrders;
  private readonly policy: RefundPolicy;

  constructor(orders: InMemoryOrders, policy: RefundPolicy) {
    this.orders = orders;
    this.policy = policy;
  }

  refund(user: User, orderId: string): void {
    const order = this.orders.find(orderId); // load the object first
    if (!this.policy.canRefund(user, order)) {
      throw new NotAllowed("not allowed to refund this order");
    }
    order.status = "refunded";
    this.orders.save(order);
  }
}

// The edge knows identity and nothing about orders.
class RefundController {
  private readonly service: RefundService;

  constructor(service: RefundService) {
    this.service = service;
  }

  refund(user: User, orderId: string): void {
    if (!user.authenticated) throw new Unauthenticated("unauthenticated");
    this.service.refund(user, orderId);
  }
}

// (b) anti-pattern: the edge tries to own a rule that needs the order.
class BadRefundController {
  refund(user: User, _orderId: string): void {
    if (!user.authenticated) throw new Unauthenticated("unauthenticated");
    if (user.role !== "support") throw new NotAllowed("forbidden: support only");
  }
}

const anonymous: User = { id: "u-1", role: "customer", authenticated: false };
const owner: User = { id: "u-1", role: "customer", authenticated: true };
const support: User = { id: "u-9", role: "support", authenticated: true };

function setup() {
  const orders = new InMemoryOrders([
    { id: "o-1", ownerId: "u-1", total: 42, status: "paid" },
    { id: "o-2", ownerId: "u-1", total: 500, status: "paid" },
    { id: "o-3", ownerId: "u-2", total: 42, status: "refunded" },
  ]);
  const service = new RefundService(orders, new RefundPolicy());
  return { orders, service, controller: new RefundController(service) };
}

test("29: the edge rejects an anonymous caller before any policy runs", () => {
  const { controller } = setup();
  assert.throws(() => controller.refund(anonymous, "o-1"), Unauthenticated);
});

test("29: the owner may refund a small order", () => {
  const { controller, orders } = setup();
  controller.refund(owner, "o-1");
  assert.equal(orders.find("o-1").status, "refunded");
});

test("29: the same owner is denied above the cap — a rule the edge cannot see", () => {
  const { controller } = setup();
  assert.throws(() => controller.refund(owner, "o-2"), NotAllowed);
});

test("29: support may refund the large order", () => {
  const { controller } = setup();
  assert.doesNotThrow(() => controller.refund(support, "o-2"));
});

test("29: an already-refunded order stays refunded", () => {
  const { controller } = setup();
  assert.throws(() => controller.refund(support, "o-3"), NotAllowed);
});

test("29: the rule survives a second entrance — a worker calling the service", () => {
  const { service } = setup();
  assert.throws(() => service.refund(owner, "o-2"), NotAllowed);
});

test("29: the edge-only rule denies the owner", () => {
  const bad = new BadRefundController();
  assert.throws(() => bad.refund(owner, "o-1"), /support only/);
});
