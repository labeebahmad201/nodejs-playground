// 07 — Anemic vs. rich domain model
// Scenario: the same discount rule, once on the entity and once in a service.
import { test } from "node:test";
import assert from "node:assert/strict";

// (a) correct: the entity owns its invariant and its behavior.
class RichOrder {
  private currentTotal: number;

  private constructor(total: number) {
    this.currentTotal = total;
  }

  static create(total: number): RichOrder {
    if (total <= 0) throw new Error("total must be positive");
    return new RichOrder(total);
  }

  applyDiscount(rate: number): void {
    if (rate < 0 || rate > 1) throw new Error("discount must be between 0 and 1");
    this.currentTotal = this.currentTotal * (1 - rate);
  }

  get total(): number {
    return this.currentTotal;
  }
}

// (b) anti-pattern: the entity is a record; the rule lives in a service.
type AnemicOrder = { total: number };

class AnemicOrderService {
  applyDiscount(order: AnemicOrder, rate: number): void {
    order.total = order.total * (1 - rate);
  }
}

test("07: the rich model protects its invariant", () => {
  const order = RichOrder.create(100);
  order.applyDiscount(0.2);
  assert.equal(order.total, 80);

  assert.throws(() => RichOrder.create(-1), /positive/);
  assert.throws(() => order.applyDiscount(2), /between 0 and 1/);
});

test("07: the anemic model accepts an invalid state", () => {
  const order: AnemicOrder = { total: 100 };
  const service = new AnemicOrderService();

  service.applyDiscount(order, 2);

  assert.equal(order.total, -100); // the invariant was never owned
});
