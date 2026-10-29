import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PlaceOrderService,
  type Notifier,
  type Order,
  type OrderRepo,
  type OrderStatus,
  type Payments,
} from "./order-service.ts";

class FakeRepo implements OrderRepo {
  readonly #orders = new Map<string, Order>();
  readonly #statuses = new Map<string, OrderStatus>();

  constructor(orders: Order[]) {
    for (const order of orders) this.#orders.set(order.id, order);
  }

  find(id: string): Order {
    const order = this.#orders.get(id);
    if (!order) throw new Error(`order not found: ${id}`);
    return order;
  }

  markPaid(id: string): void {
    if (!this.#orders.has(id)) throw new Error(`order not found: ${id}`);
    this.#statuses.set(id, "paid");
  }

  statusOf(id: string): OrderStatus {
    return this.#statuses.get(id) ?? "pending";
  }
}

class FakePayments implements Payments {
  #failure: string | undefined;

  failNext(message: string): void {
    this.#failure = message;
  }

  charge(_token: string, _cents: number): void {
    if (this.#failure) {
      const message = this.#failure;
      this.#failure = undefined;
      throw new Error(message);
    }
  }
}

class FakeNotifier implements Notifier {
  readonly sent: Order[] = [];

  sendOrderConfirmation(order: Order): void {
    this.sent.push(order);
  }
}

const order = (): Order => ({
  id: "1",
  totalCents: 500,
  customerEmail: "a@b.c",
});

test("marks the order paid after charging", () => {
  const repo = new FakeRepo([order()]);
  const payments = new FakePayments();
  const notifier = new FakeNotifier();
  const service = new PlaceOrderService(repo, payments, notifier);

  service.placeOrder("1", "tok_test");

  assert.equal(repo.statusOf("1"), "paid");
  assert.deepEqual(notifier.sent.map((item) => item.id), ["1"]);
});

test("does not mark paid if the charge fails", () => {
  const repo = new FakeRepo([order()]);
  const payments = new FakePayments();
  const notifier = new FakeNotifier();
  const service = new PlaceOrderService(repo, payments, notifier);

  payments.failNext("card declined");

  assert.throws(() => service.placeOrder("1", "tok_test"), /card declined/);
  assert.equal(repo.statusOf("1"), "pending");
  assert.equal(notifier.sent.length, 0);
});
