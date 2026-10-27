import { test } from "node:test";
import assert from "node:assert/strict";

import { composeApplication } from "./composition.ts";
import { OrderService } from "../06-composition-root/order-service.ts";
import {
  FixedClock,
  RecordingMailer,
  RecordingOrderRepository,
} from "./test-doubles.ts";

test("the production composition root builds a working graph", async () => {
  const app = composeApplication();

  const order = await app.service.placeOrder("ada@example.com", 42);

  assert.equal(order.total, 42);
  assert.equal(app.orders.all().length, 1);
  assert.equal(app.mailer.sent.length, 1);
});

test("each call to the root builds a fresh graph", () => {
  const first = composeApplication();
  const second = composeApplication();

  assert.notEqual(first.orders, second.orders);
  assert.notEqual(first.mailer, second.mailer);
});

test("a test composition root gives deterministic fakes", async () => {
  const orders = new RecordingOrderRepository();
  const mailer = new RecordingMailer();
  const clock = new FixedClock(new Date("2026-01-01T00:00:00Z"));

  const service = new OrderService(orders, mailer, clock);
  const order = await service.placeOrder("test@example.com", 10);

  assert.equal(order.placedAt.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(orders.all().length, 1);
  assert.equal(mailer.sent.length, 1);
});
