// 12 — Mapping between layers
// Scenario: map a row to a domain object, then to an API DTO.
import { test } from "node:test";
import assert from "node:assert/strict";

type OrderRow = { id: string; created_at: string; total_cents: number };
type Order = { id: string; createdAt: Date; total: number };

// (a) correct: an explicit mapper converts units and types, and validates.
function rowToDomain(row: OrderRow): Order {
  const createdAt = new Date(row.created_at);
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error("invalid created_at");
  }
  return {
    id: row.id,
    createdAt,
    total: row.total_cents / 100,
  };
}

// (b) anti-pattern: a cast hides the shape and unit mismatch.
function leakyMap(row: OrderRow): Order {
  return { ...row, createdAt: row.created_at, total: row.total_cents } as unknown as Order;
}

test("12: the mapper produces the domain types", () => {
  const order = rowToDomain({
    id: "o-1",
    created_at: "2026-01-02T03:04:05.000Z",
    total_cents: 1234,
  });

  assert.ok(order.createdAt instanceof Date);
  assert.equal(order.createdAt.toISOString(), "2026-01-02T03:04:05.000Z");
  assert.equal(order.total, 12.34);
});

test("12: the cast leaks a string date and cents into the domain", () => {
  const order = leakyMap({
    id: "o-1",
    created_at: "2026-01-02T03:04:05.000Z",
    total_cents: 1234,
  });

  assert.equal(typeof order.createdAt, "string");
  assert.equal(order.total, 1234);
});
