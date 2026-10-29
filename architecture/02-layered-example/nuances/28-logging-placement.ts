// 28 — Logging placement
// Scenario: each layer logs its own concern; SQL stays out of presentation,
// and HTTP stays out of persistence.
import { test } from "node:test";
import assert from "node:assert/strict";

type Layer = "presentation" | "application" | "persistence";

class Logger {
  readonly entries: Array<{ layer: Layer; message: string }> = [];

  log(layer: Layer, message: string): void {
    this.entries.push({ layer, message });
  }
}

// (a) correct: each layer logs what it knows.
class GoodFlow {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  run(): void {
    this.logger.log("presentation", "POST /orders request-1");
    this.logger.log("application", "place order o-1");
    this.logger.log("persistence", "INSERT orders id=o-1");
  }
}

// (b) anti-pattern: layers log concerns they do not own.
class BadFlow {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  run(): void {
    this.logger.log("presentation", "INSERT INTO orders (id) VALUES ('o-1')");
    this.logger.log("persistence", "HTTP 200 OK");
  }
}

function messagesFor(logger: Logger, layer: Layer): string[] {
  return logger.entries.filter((entry) => entry.layer === layer).map((entry) => entry.message);
}

test("28: each layer logs its own concern", () => {
  const logger = new Logger();
  new GoodFlow(logger).run();

  assert.equal(logger.entries.length, 3);
  assert.equal(messagesFor(logger, "presentation").some((m) => m.includes("SELECT")), false);
  assert.equal(messagesFor(logger, "persistence").some((m) => m.includes("HTTP")), false);
});

test("28: the anti-pattern leaks SQL and HTTP across layers", () => {
  const logger = new Logger();
  new BadFlow(logger).run();

  assert.equal(messagesFor(logger, "presentation").some((m) => m.includes("INSERT")), true);
  assert.equal(messagesFor(logger, "persistence").some((m) => m.includes("HTTP")), true);
});
