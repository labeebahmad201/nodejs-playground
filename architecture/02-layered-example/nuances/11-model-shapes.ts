// 11 — Entity vs. DTO vs. ViewModel vs. Domain model
// Scenario: one order has four shapes, each serving a different layer.
import { test } from "node:test";
import assert from "node:assert/strict";

// Persistence shape: snake_case, cents, internal fields.
type OrderRow = {
  id: string;
  customer_email: string;
  total_cents: number;
  internal_note: string;
};

// Domain shape: the language of the business.
type Order = { id: string; customerEmail: string; total: number };

// Service DTO: a stable contract for callers.
type OrderDto = { id: string; customerEmail: string; total: number };

// View shape: what the presentation needs.
type OrderView = { id: string; total: string };

// (a) correct: each layer gets a shape with only what it needs.
function rowToDomain(row: OrderRow): Order {
  return {
    id: row.id,
    customerEmail: row.customer_email,
    total: row.total_cents / 100,
  };
}

function domainToDto(order: Order): OrderDto {
  return { id: order.id, customerEmail: order.customerEmail, total: order.total };
}

function dtoToView(dto: OrderDto): OrderView {
  return { id: dto.id, total: `$${dto.total.toFixed(2)}` };
}

// (b) anti-pattern: one shape for every layer.
function leakyView(row: OrderRow): Record<string, unknown> {
  return { ...row, total: row.total_cents };
}

test("11: each shape has one purpose and the view omits internals", () => {
  const row: OrderRow = {
    id: "o-1",
    customer_email: "ada@example.com",
    total_cents: 1234,
    internal_note: "fraud review",
  };

  const view = dtoToView(domainToDto(rowToDomain(row)));

  assert.deepEqual(view, { id: "o-1", total: "$12.34" });
  assert.equal("internal_note" in view, false);
});

test("11: the leaky view exposes persistence fields and the wrong units", () => {
  const row: OrderRow = {
    id: "o-1",
    customer_email: "ada@example.com",
    total_cents: 1234,
    internal_note: "fraud review",
  };

  const view = leakyView(row);

  assert.equal(view.internal_note, "fraud review");
  assert.equal(view.total, 1234); // cents presented as dollars
});
