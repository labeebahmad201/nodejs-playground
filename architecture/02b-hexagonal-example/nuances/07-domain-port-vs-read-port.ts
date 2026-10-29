// 07 — Domain port vs. read port
// Scenario: a summary screen needs counts. Loading every aggregate to count it is
// a query problem wearing a domain costume.
import { test } from "node:test";
import assert from "node:assert/strict";

type Order = { id: string; customerId: string; total: number; status: "open" | "paid" };
type OrderSummary = { customerId: string; openTotal: number; count: number };

interface Orders {
  byId(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

// (a) correct: a separate read port answers the question with one pass.
interface OrderReports {
  summaryFor(customerId: string): Promise<OrderSummary>;
}

class MemoryOrders implements Orders, OrderReports {
  readonly rows: Order[] = [];
  loads = 0;

  async byId(id: string): Promise<Order | null> {
    this.loads += 1;
    return this.rows.find((order) => order.id === id) ?? null;
  }
  async save(order: Order): Promise<void> {
    this.rows.push(order);
  }
  async summaryFor(customerId: string): Promise<OrderSummary> {
    const mine = this.rows.filter((order) => order.customerId === customerId && order.status === "open");
    return {
      customerId,
      openTotal: mine.reduce((sum, order) => sum + order.total, 0),
      count: mine.length,
    };
  }
}

// (b) anti-pattern: the use case loads every aggregate to compute a number.
async function summaryByLoadingEverything(orders: Orders, ids: string[], customerId: string): Promise<OrderSummary> {
  let openTotal = 0;
  let count = 0;
  for (const id of ids) {
    const order = await orders.byId(id); // one "query" per id
    if (order && order.customerId === customerId && order.status === "open") {
      openTotal += order.total;
      count += 1;
    }
  }
  return { customerId, openTotal, count };
}

test("07: the read port answers the summary in one call", async () => {
  const orders = new MemoryOrders();
  await orders.save({ id: "o-1", customerId: "c-1", total: 40, status: "open" });
  await orders.save({ id: "o-2", customerId: "c-1", total: 60, status: "paid" });
  await orders.save({ id: "o-3", customerId: "c-1", total: 20, status: "open" });

  const summary = await orders.summaryFor("c-1");

  assert.deepEqual(summary, { customerId: "c-1", openTotal: 60, count: 2 });
  assert.equal(orders.loads, 0);
});

test("07: loading aggregates costs one load per row", async () => {
  const orders = new MemoryOrders();
  await orders.save({ id: "o-1", customerId: "c-1", total: 40, status: "open" });
  await orders.save({ id: "o-2", customerId: "c-1", total: 20, status: "open" });

  const summary = await summaryByLoadingEverything(orders, ["o-1", "o-2"], "c-1");

  assert.equal(summary.openTotal, 60);
  assert.equal(orders.loads, 2);
});
