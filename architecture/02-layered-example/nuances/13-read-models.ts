// 13 — Read models / projections
// Scenario: a summary query joins three tables without loading the aggregate.
import { test } from "node:test";
import assert from "node:assert/strict";

type OrderRow = { id: string; customerId: string; totalCents: number };
type CustomerRow = { id: string; name: string };
type ItemRow = { orderId: string; name: string; quantity: number };

type OrderSummary = {
  orderId: string;
  customerName: string;
  total: number;
  itemCount: number;
};

class FakeDb {
  readonly orders: OrderRow[] = [
    { id: "o-1", customerId: "c-1", totalCents: 2500 },
    { id: "o-2", customerId: "c-2", totalCents: 1000 },
  ];
  readonly customers: CustomerRow[] = [
    { id: "c-1", name: "Ada" },
    { id: "c-2", name: "Grace" },
  ];
  readonly items: ItemRow[] = [
    { orderId: "o-1", name: "book", quantity: 2 },
    { orderId: "o-1", name: "pen", quantity: 1 },
    { orderId: "o-2", name: "lamp", quantity: 1 },
  ];
  queries = 0;
}

// (a) correct: one projection query, only the fields the screen needs.
class OrderSummaryQuery {
  private readonly db: FakeDb;

  constructor(db: FakeDb) {
    this.db = db;
  }

  execute(): OrderSummary[] {
    this.db.queries += 1;
    return this.db.orders.map((order) => {
      const customer = this.db.customers.find((c) => c.id === order.customerId);
      const items = this.db.items.filter((item) => item.orderId === order.id);
      return {
        orderId: order.id,
        customerName: customer?.name ?? "unknown",
        total: order.totalCents / 100,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      };
    });
  }
}

// (b) anti-pattern: load the full aggregate, then reach for each child.
class AggregateReport {
  private readonly db: FakeDb;

  constructor(db: FakeDb) {
    this.db = db;
  }

  execute(): Array<{ orderId: string; items: ItemRow[] }> {
    this.db.queries += 1; // load orders
    return this.db.orders.map((order) => {
      this.db.queries += 1; // lazy-load items per order
      return {
        orderId: order.id,
        items: this.db.items.filter((item) => item.orderId === order.id),
      };
    });
  }
}

test("13: the projection returns only what the screen needs", () => {
  const db = new FakeDb();
  const rows = new OrderSummaryQuery(db).execute();

  assert.deepEqual(rows[0], {
    orderId: "o-1",
    customerName: "Ada",
    total: 25,
    itemCount: 3,
  });
  assert.equal(db.queries, 1);
});

test("13: the aggregate report triggers per-order work", () => {
  const db = new FakeDb();
  const rows = new AggregateReport(db).execute();

  assert.equal(rows.length, 2);
  assert.equal(db.queries, 3); // 1 + one per order
});
