// 31 — Configuration
// Scenario: the edge reads and validates the environment once; everything
// inward receives a typed value. Reading process.env inside a method is a
// hidden dependency — the constructor cannot tell you the object needs it.
import { test } from "node:test";
import assert from "node:assert/strict";

type AppConfig = { taxRate: number };

// (a) correct: one reader at the edge, with validation.
function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const taxRate = Number(env.TAX_RATE);
  if (!Number.isFinite(taxRate)) throw new Error("TAX_RATE must be a number");
  return { taxRate };
}

class PricingService {
  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  total(base: number): number {
    return base * (1 + this.config.taxRate);
  }
}

// (b) anti-pattern: the domain reads global, mutable, unvalidated process state.
class BadPricingService {
  total(base: number): number {
    const rate = Number(process.env.TAX_RATE ?? 0.2);
    return base * (1 + rate);
  }
}

test("31: injected configuration is explicit and testable", () => {
  const service = new PricingService(loadConfig({ TAX_RATE: "0.1" }));
  assert.equal(Math.round(service.total(100)), 110);
});

test("31: the same class takes a different rate as an argument", () => {
  const other = new PricingService({ taxRate: 0.2 });
  assert.equal(Math.round(other.total(100)), 120);
});

test("31: a missing or unparsable value fails at the edge", () => {
  assert.throws(() => loadConfig({}), /TAX_RATE must be a number/);
  assert.throws(() => loadConfig({ TAX_RATE: "abc" }), /TAX_RATE must be a number/);
});

test("31: the anti-pattern depends on ambient process state", () => {
  const previous = process.env.TAX_RATE;
  try {
    process.env.TAX_RATE = "0.1";
    assert.equal(Math.round(new BadPricingService().total(100)), 110);

    delete process.env.TAX_RATE;
    assert.equal(Math.round(new BadPricingService().total(100)), 120); // hidden default
  } finally {
    if (previous === undefined) delete process.env.TAX_RATE;
    else process.env.TAX_RATE = previous;
  }
});
