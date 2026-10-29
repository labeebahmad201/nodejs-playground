// 10 — Where error handling lives
// Scenario: domain errors are translated to HTTP statuses only at the edge.
import { test } from "node:test";
import assert from "node:assert/strict";

// (a) correct: domain errors know nothing about HTTP.
class InvalidOrder extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOrder";
  }
}

class OrderNotFound extends Error {
  constructor(id: string) {
    super(`order ${id} not found`);
    this.name = "OrderNotFound";
  }
}

class DatabaseUnavailable extends Error {
  constructor() {
    super("database unavailable");
    this.name = "DatabaseUnavailable";
  }
}

function toHttpStatus(error: unknown): number {
  if (error instanceof InvalidOrder) return 400;
  if (error instanceof OrderNotFound) return 404;
  return 500;
}

// (b) anti-pattern: the domain speaks HTTP, or the edge hides every error.
class HttpAwareDomainError extends Error {
  readonly status = 400;
}

function badToHttpStatus(_error: unknown): number {
  return 500; // every failure becomes an opaque server error
}

test("10: the edge maps domain errors to HTTP statuses", () => {
  assert.equal(toHttpStatus(new InvalidOrder("bad total")), 400);
  assert.equal(toHttpStatus(new OrderNotFound("o-1")), 404);
  assert.equal(toHttpStatus(new DatabaseUnavailable()), 500);
});

test("10: the anti-pattern either leaks HTTP into the domain or hides the cause", () => {
  const error = new HttpAwareDomainError("invalid");
  assert.equal(error.status, 400);
  assert.equal(badToHttpStatus(error), 500);
});
