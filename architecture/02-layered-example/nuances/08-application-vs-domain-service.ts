// 08 — Application service vs. domain service
// Scenario: the application service orchestrates; domain services enforce their own rules.
import { test } from "node:test";
import assert from "node:assert/strict";

interface PricingService {
  price(base: number): number;
}

interface InventoryService {
  reserve(sku: string, quantity: number): void;
}

// (a) correct: the application service composes domain services.
class CheckoutApplicationService {
  private readonly pricing: PricingService;
  private readonly inventory: InventoryService;

  constructor(pricing: PricingService, inventory: InventoryService) {
    this.pricing = pricing;
    this.inventory = inventory;
  }

  checkout(base: number, sku: string): { total: number } {
    const total = this.pricing.price(base);
    this.inventory.reserve(sku, 1);
    return { total };
  }
}

class VipPricingService implements PricingService {
  price(base: number): number {
    if (base <= 0) throw new Error("base must be positive");
    return base > 100 ? base * 0.9 : base;
  }
}

class RecordingInventoryService implements InventoryService {
  readonly reservations: Array<{ sku: string; quantity: number }> = [];

  reserve(sku: string, quantity: number): void {
    this.reservations.push({ sku, quantity });
  }
}

// (b) anti-pattern: the application service absorbs both domain rules.
class FatCheckoutApplicationService {
  private readonly inventory: InventoryService;

  constructor(inventory: InventoryService) {
    this.inventory = inventory;
  }

  checkout(base: number, sku: string): { total: number } {
    const total = base > 100 ? base * 0.9 : base; // pricing rule is trapped here
    this.inventory.reserve(sku, 1);
    return { total };
  }
}

test("08: the application service composes swappable domain services", () => {
  const inventory = new RecordingInventoryService();
  const service = new CheckoutApplicationService(new VipPricingService(), inventory);

  assert.equal(service.checkout(200, "sku-1").total, 180);
  assert.deepEqual(inventory.reservations, [{ sku: "sku-1", quantity: 1 }]);
});

test("08: the pricing rule can change without touching the application service", () => {
  const inventory = new RecordingInventoryService();
  const halfPrice: PricingService = { price: (base) => base * 0.5 };
  const service = new CheckoutApplicationService(halfPrice, inventory);

  assert.equal(service.checkout(200, "sku-2").total, 100);
});

test("08: the fat application service hardcodes the rule", () => {
  const inventory = new RecordingInventoryService();
  const service = new FatCheckoutApplicationService(inventory);

  assert.equal(service.checkout(200, "sku-3").total, 180);
  // There is no PricingService to swap, so testing the rule alone is impossible.
});
