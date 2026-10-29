// 26 — Distributed boundaries
// Scenario: an order and a payment live in different services. A local transaction
// cannot span them; this is a small saga/outbox model.
import { test } from "node:test";
import assert from "node:assert/strict";

type OrderStatus = "pending" | "paid" | "cancelled";
type Event = { type: "OrderCreated"; orderId: string };

class OrderService {
  readonly orders = new Map<string, OrderStatus>();
  readonly outbox: Event[] = [];

  create(orderId: string): void {
    this.orders.set(orderId, "pending");
    this.outbox.push({ type: "OrderCreated", orderId });
  }

  markPaid(orderId: string): void {
    this.orders.set(orderId, "paid");
  }

  cancel(orderId: string): void {
    this.orders.set(orderId, "cancelled");
  }
}

class PaymentService {
  charge(orderId: string): void {
    if (orderId === "fail") throw new Error("payment failed");
  }
}

// (a) correct: the order and its event commit together; failure compensates.
function runSaga(orders: OrderService, payments: PaymentService): void {
  const event = orders.outbox.shift();
  if (!event) return;

  try {
    payments.charge(event.orderId);
    orders.markPaid(event.orderId);
  } catch {
    orders.cancel(event.orderId);
  }
}

// (b) anti-pattern: two independent writes with no compensation.
function badFlow(orders: OrderService, payments: PaymentService, orderId: string): void {
  orders.orders.set(orderId, "pending");
  payments.charge(orderId); // if this throws, the order stays pending
  orders.markPaid(orderId);
}

test("26: the saga compensates when payment fails", () => {
  const orders = new OrderService();
  const payments = new PaymentService();

  orders.create("fail");
  runSaga(orders, payments);

  assert.equal(orders.orders.get("fail"), "cancelled");
  assert.equal(orders.outbox.length, 0);
});

test("26: the successful path marks the order paid", () => {
  const orders = new OrderService();
  const payments = new PaymentService();

  orders.create("ok");
  runSaga(orders, payments);

  assert.equal(orders.orders.get("ok"), "paid");
});

test("26: the dual write leaves the order pending after a failure", () => {
  const orders = new OrderService();
  const payments = new PaymentService();

  assert.throws(() => badFlow(orders, payments, "fail"), /payment failed/);
  assert.equal(orders.orders.get("fail"), "pending");
});
