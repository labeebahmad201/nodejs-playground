// 05 — Fat controller
// Scenario: a discount rule leaks into presentation.
import { test } from "node:test";
import assert from "node:assert/strict";

type Tier = "standard" | "vip";
type Discounts = Record<Tier, number>;

class CheckoutService {
  private readonly discounts: Discounts;

  constructor(discounts: Discounts) {
    this.discounts = discounts;
  }

  price(tier: Tier, total: number): number {
    if (total <= 0) throw new Error("total must be positive");
    return total * this.discounts[tier];
  }
}

// (a) correct: the controller only parses and delegates.
class ThinCheckoutController {
  private readonly service: CheckoutService;

  constructor(service: CheckoutService) {
    this.service = service;
  }

  create(body: { tier: Tier; total: number }): { total: number } {
    return { total: this.service.price(body.tier, body.total) };
  }
}

// (b) anti-pattern: the controller hardcodes the business rule.
class FatCheckoutController {
  create(body: { tier: Tier; total: number }): { total: number } {
    if (body.total <= 0) throw new Error("total must be positive");
    const total = body.tier === "vip" ? body.total * 0.9 : body.total;
    return { total };
  }
}

test("05: the thin controller delegates the discount rule", () => {
  const service = new CheckoutService({ standard: 1, vip: 0.8 });
  const controller = new ThinCheckoutController(service);

  assert.equal(controller.create({ tier: "vip", total: 100 }).total, 80);
  assert.equal(service.price("vip", 100), 80);
});

test("05: the fat controller duplicates the rule and goes stale", () => {
  const controller = new FatCheckoutController();

  // The policy changed to 0.8, but the controller still says 0.9.
  assert.equal(controller.create({ tier: "vip", total: 100 }).total, 90);
});
