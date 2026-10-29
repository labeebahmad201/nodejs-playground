// 25 — The module is the enforcement
// Scenario: a CI check that turns the dependency rule into a failing build.
import { test } from "node:test";
import assert from "node:assert/strict";

type Imports = Record<string, string[]>;

// The real project graph. The core modules import only inward.
const project: Imports = {
  "adapters/http": ["application"],
  "adapters/persistence": ["application", "domain"],
  application: ["domain", "ports"],
  ports: ["domain"],
  domain: [],
  bootstrap: ["adapters/http", "adapters/persistence", "application"],
};

const allowed: Imports = {
  "adapters/http": ["application"],
  "adapters/persistence": ["application", "domain"],
  application: ["domain", "ports"],
  ports: ["domain"],
  domain: [],
  bootstrap: ["adapters/http", "adapters/persistence", "application"],
};

function check(graph: Imports, rules: Imports): string[] {
  const errors: string[] = [];
  for (const [from, edges] of Object.entries(graph)) {
    for (const to of edges) {
      if (!(rules[from] ?? []).includes(to)) errors.push(`${from} -> ${to}`);
    }
  }
  return errors;
}

// (b) anti-pattern: the folders exist, the edge does not obey the rules.
const costume: Imports = {
  ...project,
  domain: ["adapters/persistence"],
};

test("25: the project graph passes the import rule", () => {
  assert.deepEqual(check(project, allowed), []);
});

test("25: the costume graph fails even though the folders look right", () => {
  assert.deepEqual(check(costume, allowed), ["domain -> adapters/persistence"]);
});

test("25: a graph check is enough for CI without splitting packages", () => {
  const files = Object.keys(project).filter((name) => name.startsWith("adapters/"));
  assert.deepEqual(files, ["adapters/http", "adapters/persistence"]);
  // One package plus this test is a real enforcement mechanism. Workspace packages
  // are the stronger version, not the only one.
});
