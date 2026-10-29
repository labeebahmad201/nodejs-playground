// 33 — Shared utilities / common code
// Scenario: a shared folder is fine; the violation is a file inside it that
// imports a layer. Money is the legitimate utility; forbiddenEdges is the check.
import { test } from "node:test";
import assert from "node:assert/strict";

type Module = "presentation" | "application" | "domain" | "persistence" | "shared";
type Edge = { from: Module; to: Module };

// (a) correct: shared is a leaf; domain never imports infrastructure.
const correctEdges: Edge[] = [
  { from: "presentation", to: "application" },
  { from: "presentation", to: "shared" },
  { from: "application", to: "domain" },
  { from: "domain", to: "shared" },
  { from: "persistence", to: "shared" },
];

function forbiddenEdges(edges: Edge[]): Edge[] {
  return edges.filter((edge) => {
    if (edge.from === "shared") return true; // shared must not depend on a layer
    if (edge.from === "domain" && edge.to !== "shared") return true;
    return false;
  });
}

class Money {
  readonly cents: number;

  constructor(cents: number) {
    this.cents = cents;
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  format(): string {
    return `$${(this.cents / 100).toFixed(2)}`;
  }
}

// (b) anti-pattern: a shared module imports persistence and HTTP concerns.
const antiPatternEdges: Edge[] = [
  ...correctEdges,
  { from: "shared", to: "persistence" },
  { from: "domain", to: "persistence" },
];

test("33: the shared kernel has no layer dependencies", () => {
  assert.deepEqual(forbiddenEdges(correctEdges), []);
  assert.equal(new Money(1000).add(new Money(250)).format(), "$12.50");
});

test("33: the dumping-ground utilities create forbidden edges", () => {
  assert.deepEqual(forbiddenEdges(antiPatternEdges), [
    { from: "shared", to: "persistence" },
    { from: "domain", to: "persistence" },
  ]);
});
