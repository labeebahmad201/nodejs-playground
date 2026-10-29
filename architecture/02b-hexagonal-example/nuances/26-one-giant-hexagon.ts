// 26 — One giant hexagon
// Scenario: two capabilities share one core. Billing must not reach into Orders.
import { test } from "node:test";
import assert from "node:assert/strict";

// orders/internal.ts — not importable by another capability.
class Order {
  readonly id: string;
  private state: "draft" | "placed" = "draft";
  constructor(id: string) {
    this.id = id;
  }
  place(): void {
    if (this.state === "placed") throw new Error("already placed");
    this.state = "placed";
  }
  get status(): string {
    return this.state;
  }
}

// orders/public.ts — the only thing another module may import.
class OrdersPublic {
  private readonly orders = new Map<string, Order>();
  place(id: string): void {
    const order = this.orders.get(id) ?? new Order(id);
    order.place();
    this.orders.set(id, order);
  }
  status(id: string): string {
    return this.orders.get(id)?.status ?? "missing";
  }
}

class Billing {
  private readonly orders: OrdersPublic;
  constructor(orders: OrdersPublic) {
    this.orders = orders;
  }
  invoice(orderId: string): string {
    if (this.orders.status(orderId) !== "placed") throw new Error("order not placed");
    return `invoice:${orderId}`;
  }
}

// (b) anti-pattern: billing imports the internal class and mutates it.
class LeakyBilling {
  invoice(order: Order): string {
    // No call to `place()`, so the invariant is bypassed.
    return `invoice:${order.id}:${order.status}`;
  }
}

test("26: billing goes through the public facade", () => {
  const orders = new OrdersPublic();
  orders.place("o-1");
  assert.equal(new Billing(orders).invoice("o-1"), "invoice:o-1");
});

test("26: the internal class lets billing skip the invariant", () => {
  const draft = new Order("o-1");
  const invoice = new LeakyBilling().invoice(draft);

  assert.equal(invoice, "invoice:o-1:draft");
  // The order was never placed, but the invoice exists. The hexagon had no internal boundary.
});
