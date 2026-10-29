// 29 — The cost of the module split
// Scenario: the same classes in one package or in six modules. This is a model, not
// a benchmark; the numbers are illustrative and the shape is the point.
import { test } from "node:test";
import assert from "node:assert/strict";

type Shape = {
  modules: number;
  classes: number;
};

const FIXED_PER_MODULE = 8; // build config, wiring, navigation, versioning
const PER_CLASS = 1; // the work that exists either way

function overhead(shape: Shape): number {
  return shape.modules * FIXED_PER_MODULE + shape.classes * PER_CLASS;
}

// One package, one graph test: the fix is a single dependency check.
function singlePackage(classes: number): number {
  return overhead({ modules: 1, classes }) + 2;
}

// Six modules: application, model, http, persistence, notifications, bootstrap.
function sixModules(classes: number): number {
  return overhead({ modules: 6, classes });
}

test("29: one class per module is the bad end of the trade", () => {
  assert.equal(singlePackage(6), 16);
  assert.equal(sixModules(6), 54);
  assert.ok(sixModules(6) > singlePackage(6));
});

test("29: the split wins once each module holds real code", () => {
  const classes = 300;
  assert.equal(singlePackage(classes), 310);
  assert.equal(sixModules(classes), 348);
  // The gap is the fixed cost. At 300 classes it is a small percentage; the
  // boundary now buys compiler-enforced direction for a large codebase.
  assert.ok(sixModules(classes) / singlePackage(classes) < 1.2);
});

test("29: do not split before the module has something to hide", () => {
  const emptyAdapter = sixModules(1);
  const single = singlePackage(1);
  assert.ok(emptyAdapter - single >= 35);
  // Start with one package and a graph test. Split the persistence or vendor
  // adapter when it grows a dependency worth isolating.
});
