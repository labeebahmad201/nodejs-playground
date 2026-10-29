// 16 — N+1 queries and lazy-loading boundaries
// Scenario: list orders and their items with one query per table, not one per order.
import { test } from "node:test";
import assert from "node:assert/strict";

type OrderRow = { id: string };
type ItemRow = { orderId: string; name: string };
type OrderWithItems = OrderRow & { items: ItemRow[] };

class FakeDb {
  queries = 0;
  readonly orders: OrderRow[] = [{ id: "o-1" }, { id: "o-2" }, { id: "o-3" }];
  readonly items: ItemRow[] = [
    { orderId: "o-1", name: "book" },
    { orderId: "o-2", name: "pen" },
    { orderId: "o-3", name: "lamp" },
  ];

  findOrders(): OrderRow[] {
    this.queries += 1;
    return this.orders;
  }

  findItems(orderId: string): ItemRow[] {
    this.queries += 1;
    return this.items.filter((item) => item.orderId === orderId);
  }

  findItemsForOrders(orderIds: readonly string[]): ItemRow[] {
    this.queries += 1;
    const ids = new Set(orderIds);
    return this.items.filter((item) => ids.has(item.orderId));
  }
}

// (a) correct: load orders, then load all items in one batch.
class OrderListQuery {
  private readonly db: FakeDb;

  constructor(db: FakeDb) {
    this.db = db;
  }

  execute(): OrderWithItems[] {
    const orders = this.db.findOrders();
    const items = this.db.findItemsForOrders(orders.map((order) => order.id));
    return orders.map((order) => ({
      ...order,
      items: items.filter((item) => item.orderId === order.id),
    }));
  }
}

// (b) anti-pattern: lazy-load items inside the loop.
class NPlusOneQuery {
  private readonly db: FakeDb;

  constructor(db: FakeDb) {
    this.db = db;
  }

  execute(): OrderWithItems[] {
    return this.db.findOrders().map((order) => ({
      ...order,
      items: this.db.findItems(order.id),
    }));
  }
}

test("16: the batch query uses two queries", () => {
  const db = new FakeDb();
  const rows = new OrderListQuery(db).execute();

  assert.equal(rows.length, 3);
  assert.equal(rows[0]?.items[0]?.name, "book");
  assert.equal(db.queries, 2);
});

test("16: the lazy loop uses one query per order", () => {
  const db = new FakeDb();
  const rows = new NPlusOneQuery(db).execute();

  assert.equal(rows.length, 3);
  assert.equal(db.queries, 4); // 1 + 3
});
