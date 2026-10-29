// 27 — Eventual consistency
// Scenario: the write model and the read projection are updated asynchronously.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sleep } from "../_shared.ts";

type Order = { id: string; total: number };
type OrderView = { status: "pending" } | { status: "ready"; total: number };

// (a) correct: the read side is a projection and can be stale.
class Projection {
  private readonly rows = new Map<string, Order>();

  apply(order: Order): void {
    this.rows.set(order.id, order);
  }

  get(orderId: string): OrderView {
    const row = this.rows.get(orderId);
    return row ? { status: "ready", total: row.total } : { status: "pending" };
  }
}

class WriteModel {
  private readonly orders = new Map<string, Order>();
  private readonly projection: Projection;

  constructor(projection: Projection) {
    this.projection = projection;
  }

  save(order: Order): void {
    this.orders.set(order.id, order);
    setTimeout(() => this.projection.apply(order), 10);
  }

  get(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }
}

// (b) anti-pattern: read the write model and pretend the projection is current.
function readYourWrites(writeModel: WriteModel, orderId: string): OrderView {
  const row = writeModel.get(orderId);
  return row ? { status: "ready", total: row.total } : { status: "pending" };
}

test("27: the projection is stale until the async update lands", async () => {
  const projection = new Projection();
  const writeModel = new WriteModel(projection);

  writeModel.save({ id: "o-1", total: 42 });

  assert.deepEqual(projection.get("o-1"), { status: "pending" });

  await sleep(20);

  assert.deepEqual(projection.get("o-1"), { status: "ready", total: 42 });
});

test("27: reading the write model hides the replication lag", () => {
  const projection = new Projection();
  const writeModel = new WriteModel(projection);

  writeModel.save({ id: "o-2", total: 42 });

  assert.deepEqual(projection.get("o-2"), { status: "pending" });
  assert.deepEqual(readYourWrites(writeModel, "o-2"), { status: "ready", total: 42 });
  // The UI looks consistent only because it is reading the wrong store.
});
