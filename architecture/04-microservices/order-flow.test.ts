import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CardDeclined,
  PaymentTimeout,
  PlaceOrder,
  type ChargeInput,
  type Order,
  type OrderStatus,
  type OrderStore,
  type PaymentProvider,
} from "./order-flow.ts";

class InMemoryOrders implements OrderStore {
  readonly #orders = new Map<string, Order>();

  constructor(orders: Order[]) {
    for (const order of orders) this.#orders.set(order.id, { ...order });
  }

  find(id: string): Order {
    const order = this.#orders.get(id);
    if (!order) throw new Error(`order not found: ${id}`);
    return { ...order };
  }

  markPaid(id: string, paymentId: string): void {
    this.#update(id, { status: "paid", paymentId });
  }

  markPaymentFailed(id: string): void {
    this.#update(id, { status: "payment_failed" });
  }

  markPaymentUnknown(id: string): void {
    this.#update(id, { status: "payment_unknown" });
  }

  statusOf(id: string): OrderStatus {
    return this.find(id).status;
  }

  #update(id: string, patch: Partial<Order>): void {
    const order = this.#orders.get(id);
    if (!order) throw new Error(`order not found: ${id}`);
    this.#orders.set(id, { ...order, ...patch });
  }
}

class FakePaymentProvider implements PaymentProvider {
  readonly #charges = new Map<string, string>();
  #attempts = 0;
  #chargeCount = 0;
  #dropResponseAfterCharge = 0;
  #declineNext = false;

  dropResponseAfterChargeOnce(): void {
    this.#dropResponseAfterCharge = 1;
  }

  declineNext(): void {
    this.#declineNext = true;
  }

  get attempts(): number {
    return this.#attempts;
  }

  get chargeCount(): number {
    return this.#chargeCount;
  }

  get uniqueChargeCount(): number {
    return this.#charges.size;
  }

  charge(input: ChargeInput): string {
    this.#attempts++;

    if (this.#declineNext) {
      this.#declineNext = false;
      throw new CardDeclined("card declined");
    }

    const existing = this.#charges.get(input.idempotencyKey);
    if (existing) return existing;

    const paymentId = `pay_${this.#charges.size + 1}`;
    this.#charges.set(input.idempotencyKey, paymentId);
    this.#chargeCount++;

    if (this.#dropResponseAfterCharge > 0) {
      this.#dropResponseAfterCharge--;
      throw new PaymentTimeout("payment provider timed out after charging");
    }

    return paymentId;
  }
}

const order = (): Order => ({
  id: "1",
  totalCents: 500,
  status: "pending",
});

test("retries after a timeout without charging twice", () => {
  const orders = new InMemoryOrders([order()]);
  const payments = new FakePaymentProvider();
  payments.dropResponseAfterChargeOnce();
  const service = new PlaceOrder(orders, payments);

  service.execute("1", "tok_test");

  assert.equal(orders.statusOf("1"), "paid");
  assert.equal(payments.chargeCount, 1);
  assert.equal(payments.attempts, 2);
});

test("a declined card leaves the order failed, not paid", () => {
  const orders = new InMemoryOrders([order()]);
  const payments = new FakePaymentProvider();
  payments.declineNext();
  const service = new PlaceOrder(orders, payments);

  assert.throws(() => service.execute("1", "tok_test"), /card declined/);

  assert.equal(orders.statusOf("1"), "payment_failed");
  assert.equal(payments.chargeCount, 0);
});

test("an exhausted timeout leaves the outcome explicit", () => {
  const orders = new InMemoryOrders([order()]);
  const payments = new FakePaymentProvider();
  payments.dropResponseAfterChargeOnce();
  const service = new PlaceOrder(orders, payments, 1);

  assert.throws(() => service.execute("1", "tok_test"), /timed out/);

  assert.equal(orders.statusOf("1"), "payment_unknown");
  assert.equal(payments.chargeCount, 1);
});

test("a new idempotency key is a new charge", () => {
  const payments = new FakePaymentProvider();
  payments.dropResponseAfterChargeOnce();
  const input = { cardToken: "tok_test", amountCents: 500 };

  assert.throws(
    () =>
      payments.charge({
        ...input,
        idempotencyKey: "order:1:charge",
      }),
    /timed out/,
  );

  payments.charge({
    ...input,
    idempotencyKey: "order:1:retry",
  });

  assert.equal(payments.chargeCount, 2);
  assert.equal(payments.uniqueChargeCount, 2);
});
