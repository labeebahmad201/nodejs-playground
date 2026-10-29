// 01 — Inside/outside is the import graph
// Scenario: a registration feature sits in folders named domain/, application/, adapters/.
import { test } from "node:test";
import assert from "node:assert/strict";

type ModuleGraph = Record<string, readonly string[]>;

const isCore = (module: string): boolean =>
  module.startsWith("domain/") || module.startsWith("application/");

function edgeViolations(graph: ModuleGraph): string[] {
  const violations: string[] = [];
  for (const [from, dependencies] of Object.entries(graph)) {
    for (const to of dependencies) {
      if (isCore(from) && to.startsWith("adapters/")) {
        violations.push(`${from} -> ${to}`);
      }
    }
  }
  return violations;
}

// A folder check asks where the files live. It cannot see an import.
function folderProblems(graph: ModuleGraph): string[] {
  const modules = Object.keys(graph);
  const problems: string[] = [];
  if (!modules.some((module) => module.startsWith("domain/"))) {
    problems.push("missing domain/");
  }
  if (!modules.some((module) => module.startsWith("adapters/"))) {
    problems.push("missing adapters/");
  }
  return problems;
}

// (a) correct: the core imports only its own types and ports.
const correct: ModuleGraph = {
  "domain/user": [],
  "application/ports": ["domain/user"],
  "application/register-user": ["domain/user", "application/ports"],
  "adapters/http": ["application/register-user"],
  "adapters/sqlite": ["application/ports", "domain/user"],
  "composition-root": [
    "application/register-user",
    "adapters/http",
    "adapters/sqlite",
  ],
};

// (b) anti-pattern: the same folders, but the use case imports the controller's
// request type because parsing it there was convenient.
const costume: ModuleGraph = {
  "domain/user": [],
  "application/ports": ["domain/user"],
  "application/register-user": [
    "domain/user",
    "application/ports",
    "adapters/http",
  ],
  "adapters/http": ["application/register-user"],
  "adapters/sqlite": ["application/ports", "domain/user"],
  "composition-root": [
    "application/register-user",
    "adapters/http",
    "adapters/sqlite",
  ],
};

test("01: the correct graph passes both checks", () => {
  assert.deepEqual(folderProblems(correct), []);
  assert.deepEqual(edgeViolations(correct), []);
});

test("01: the costume passes the folder check and fails the edge check", () => {
  assert.deepEqual(folderProblems(costume), []);
  assert.deepEqual(edgeViolations(costume), [
    "application/register-user -> adapters/http",
  ]);
  // The folders are present, so a naming convention would have approved this.
});
