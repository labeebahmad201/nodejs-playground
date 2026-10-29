// 38 — Logical layers vs. physical tiers
// Scenario: the same service code runs in one process or across a network hop. Only the
// composition root knows which; the service calls an interface either way.
import { test } from "node:test";
import assert from "node:assert/strict";

type Order = { id: string; total: number };
type Deployment = "monolith" | "split";

interface OrderRepository {
  save(order: Order): void;
}

interface Inventory {
  reserve(orderId: string): void;
}

class InMemoryOrderRepository implements OrderRepository {
  readonly rows: Order[] = [];

  save(order: Order): void {
    this.rows.push(order);
  }
}

// In-process collaborator: a map lookup in a real system.
class LocalInventory implements Inventory {
  readonly reserved: string[] = [];

  reserve(orderId: string): void {
    this.reserved.push(orderId);
  }
}

// Remote collaborator: a network hop.
class HttpInventory implements Inventory {
  readonly requests: string[] = [];

  reserve(orderId: string): void {
    this.requests.push(`POST /reserve ${orderId}`);
  }
}

// The service is identical in both deployment shapes. No URL, no branch, no fetch.
class OrderService {
  private readonly orders: OrderRepository;
  private readonly inventory: Inventory;

  constructor(orders: OrderRepository, inventory: Inventory) {
    this.orders = orders;
    this.inventory = inventory;
  }

  place(order: Order): void {
    this.orders.save(order);
    this.inventory.reserve(order.id);
  }
}

// (a) correct: the composition root chooses the shape; the service does not.
function build(deployment: Deployment) {
  const orders = new InMemoryOrderRepository();
  const inventory = deployment === "monolith" ? new LocalInventory() : new HttpInventory();
  return { service: new OrderService(orders, inventory), orders, inventory };
}

// (b) anti-pattern: the hop is hardcoded, so no deployment can turn it off.
class AlwaysRemoteService {
  readonly requests: string[] = [];
  private readonly orders: OrderRepository;

  constructor(orders: OrderRepository) {
    this.orders = orders;
  }

  place(order: Order): void {
    this.orders.save(order);
    this.requests.push(`POST /reserve ${order.id}`); // a network call in every shape
  }
}

test("38: the same service class runs in either deployment shape", () => {
  const monolith = build("monolith");
  const split = build("split");

  monolith.service.place({ id: "o-1", total: 10 });
  split.service.place({ id: "o-2", total: 20 });

  assert.equal(monolith.service.constructor, split.service.constructor);
  assert.deepEqual(monolith.orders.rows.map((order) => order.id), ["o-1"]);
  assert.deepEqual(split.orders.rows.map((order) => order.id), ["o-2"]);
});

test("38: only the split deployment pays for the network hop", () => {
  const monolith = build("monolith");
  monolith.service.place({ id: "o-1", total: 10 });
  assert.ok(monolith.inventory instanceof LocalInventory);
  assert.deepEqual(monolith.inventory.reserved, ["o-1"]);

  const split = build("split");
  split.service.place({ id: "o-2", total: 20 });
  assert.ok(split.inventory instanceof HttpInventory);
  assert.deepEqual(split.inventory.requests, ["POST /reserve o-2"]);
});

test("38: the anti-pattern hops even when deployed as one process", () => {
  const service = new AlwaysRemoteService(new InMemoryOrderRepository());
  service.place({ id: "o-3", total: 30 });

  assert.deepEqual(service.requests, ["POST /reserve o-3"]);
});
