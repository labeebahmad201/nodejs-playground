import test from "node:test";
import assert from "node:assert/strict";

import { Order } from "./order-aggregate.ts";

test("place creates an order and an OrderPlaced event", () => {
  const { order, events } = Order.place("1", 4_200);

  assert.equal(order.id, "1");
  assert.equal(order.status, "pending_payment");
  assert.deepEqual(events, [
    { type: "OrderPlaced", orderId: "1", totalCents: 4_200 },
  ]);
});

test("confirm requires both a captured payment and a reserved inventory", () => {
  const { order } = Order.place("1", 4_200);

  assert.throws(() => order.confirm(), /cannot confirm while order is pending_payment/);

  order.capturePayment("pay_1");
  assert.throws(() => order.confirm(), /cannot confirm before inventory is reserved/);

  order.recordInventoryReserved();
  assert.deepEqual(order.confirm(), [
    { type: "OrderConfirmed", orderId: "1" },
  ]);
  assert.equal(order.status, "confirmed");
});

test("an unknown payment can be reconciled into a capture", () => {
  const { order } = Order.place("1", 4_200);

  assert.deepEqual(order.markPaymentUnknown(), [
    { type: "PaymentUnknown", orderId: "1" },
  ]);
  assert.equal(order.status, "payment_unknown");

  assert.deepEqual(order.capturePayment("pay_1"), [
    { type: "PaymentCaptured", orderId: "1", paymentId: "pay_1" },
  ]);
  assert.equal(order.status, "paid");
});

test("a definite payment failure cannot be captured later", () => {
  const { order } = Order.place("1", 4_200);

  order.markPaymentFailed();

  assert.throws(() => order.capturePayment("pay_1"), /definite failure/);
});

test("repeating a command that already took effect is harmless", () => {
  const { order } = Order.place("1", 4_200);

  order.recordInventoryReserved();
  assert.deepEqual(order.recordInventoryReserved(), []);

  order.capturePayment("pay_1");
  assert.deepEqual(order.capturePayment("pay_1"), []);

  order.confirm();
  assert.deepEqual(order.confirm(), []);
});
