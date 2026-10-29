// 34 — Domain events
// Scenario: record the event in the outbox inside the same transaction as the write.
import { test } from "node:test";
import assert from "node:assert/strict";

class EventBus {
  readonly published: string[] = [];

  publish(event: string): void {
    this.published.push(event);
  }
}

class Store {
  readonly committedOrders: string[] = [];
  private pendingOrders: string[] = [];
  private pendingEvents: string[] = [];
  private outbox: string[] = [];

  begin(): void {
    this.pendingOrders = [];
    this.pendingEvents = [];
  }

  addOrder(id: string): void {
    this.pendingOrders.push(id);
  }

  addEvent(event: string): void {
    this.pendingEvents.push(event);
  }

  commit(): void {
    this.committedOrders.push(...this.pendingOrders);
    this.outbox.push(...this.pendingEvents);
    this.pendingOrders = [];
    this.pendingEvents = [];
  }

  rollback(): void {
    this.pendingOrders = [];
    this.pendingEvents = [];
  }

  drainOutbox(): string[] {
    const events = [...this.outbox];
    this.outbox = [];
    return events;
  }
}

// (a) correct: the event and the order commit together; the relay runs after.
class OrderService {
  private readonly store: Store;
  private readonly bus: EventBus;

  constructor(store: Store, bus: EventBus) {
    this.store = store;
    this.bus = bus;
  }

  place(id: string, fail: boolean): void {
    this.store.begin();
    try {
      this.store.addOrder(id);
      this.store.addEvent(`OrderPlaced:${id}`);
      if (fail) throw new Error("order failed");
      this.store.commit();
    } catch (error) {
      this.store.rollback();
      throw error;
    }

    for (const event of this.store.drainOutbox()) {
      this.bus.publish(event);
    }
  }
}

// (b) anti-pattern: publish before the transaction commits.
class BadOrderService {
  private readonly store: Store;
  private readonly bus: EventBus;

  constructor(store: Store, bus: EventBus) {
    this.store = store;
    this.bus = bus;
  }

  place(id: string, fail: boolean): void {
    this.bus.publish(`OrderPlaced:${id}`);
    if (fail) throw new Error("order failed");
    this.store.committedOrders.push(id);
  }
}

test("34: a failed write records no event", () => {
  const store = new Store();
  const bus = new EventBus();
  const service = new OrderService(store, bus);

  assert.throws(() => service.place("o-1", true), /order failed/);

  assert.deepEqual(store.committedOrders, []);
  assert.deepEqual(bus.published, []);
});

test("34: a successful write records the order and publishes after commit", () => {
  const store = new Store();
  const bus = new EventBus();
  const service = new OrderService(store, bus);

  service.place("o-2", false);

  assert.deepEqual(store.committedOrders, ["o-2"]);
  assert.deepEqual(bus.published, ["OrderPlaced:o-2"]);
});

test("34: the anti-pattern publishes even when the order rolls back", () => {
  const store = new Store();
  const bus = new EventBus();
  const service = new BadOrderService(store, bus);

  assert.throws(() => service.place("o-3", true), /order failed/);

  assert.deepEqual(store.committedOrders, []);
  assert.deepEqual(bus.published, ["OrderPlaced:o-3"]); // a phantom event
});
