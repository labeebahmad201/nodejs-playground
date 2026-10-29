// 40 — Migrating toward Clean/Hexagonal
// Scenario: invert the payment dependency so the domain owns the contract.
import { test } from "node:test";
import assert from "node:assert/strict";

// (a) correct: the domain declares the port; the adapter implements it.
interface PaymentGateway {
  charge(amount: number): string;
}

class StripeAdapter implements PaymentGateway {
  charge(amount: number): string {
    return `stripe:${amount}`;
  }
}

class FakePaymentGateway implements PaymentGateway {
  charge(amount: number): string {
    return `fake:${amount}`;
  }
}

class OrderService {
  private readonly gateway: PaymentGateway;

  constructor(gateway: PaymentGateway) {
    this.gateway = gateway;
  }

  place(amount: number): string {
    return this.gateway.charge(amount);
  }
}

// (b) anti-pattern: the domain imports and constructs the vendor client.
class StripeClient {
  charge(amount: number): string {
    return `stripe:${amount}`;
  }
}

class BadOrderService {
  private readonly stripe = new StripeClient();

  place(amount: number): string {
    return this.stripe.charge(amount);
  }
}

test("40: the port lets the composition root choose the adapter", () => {
  assert.equal(new OrderService(new StripeAdapter()).place(10), "stripe:10");
  assert.equal(new OrderService(new FakePaymentGateway()).place(10), "fake:10");
});

test("40: the anti-pattern cannot be swapped without editing the domain", () => {
  assert.equal(new BadOrderService().place(10), "stripe:10");
  // There is no constructor parameter and no port to replace.
});
