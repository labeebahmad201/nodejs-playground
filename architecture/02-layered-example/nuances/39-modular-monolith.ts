// 39 — Modular monolith
// Scenario: layers inside a module, but only the module's public entry point is imported.
import { test } from "node:test";
import assert from "node:assert/strict";

type Module = "orders" | "billing";
type ImportEdge = {
  from: Module;
  target: Module;
  path: string;
  internal: boolean;
};

// (a) correct: cross-module imports go through the public entry point.
const correctImports: ImportEdge[] = [
  {
    from: "billing",
    target: "orders",
    path: "modules/orders/index.ts",
    internal: false,
  },
];

// (b) anti-pattern: billing reaches into orders' internals.
const antiPatternImports: ImportEdge[] = [
  ...correctImports,
  {
    from: "billing",
    target: "orders",
    path: "modules/orders/internal/order-repository.ts",
    internal: true,
  },
];

function violations(imports: ImportEdge[]): ImportEdge[] {
  return imports.filter((edge) => edge.from !== edge.target && edge.internal);
}

// The public contract is small and intentional.
const ordersModule = {
  placeOrder(id: string): { id: string; status: "placed" } {
    return { id, status: "placed" };
  },
};

test("39: billing imports only the orders public API", () => {
  assert.deepEqual(violations(correctImports), []);
  assert.deepEqual(ordersModule.placeOrder("o-1"), { id: "o-1", status: "placed" });
});

test("39: importing an internal module file is a boundary violation", () => {
  assert.deepEqual(violations(antiPatternImports), [antiPatternImports[1]]);
});
