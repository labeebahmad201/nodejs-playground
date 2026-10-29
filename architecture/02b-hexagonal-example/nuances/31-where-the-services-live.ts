// 31 — Where the services live
// Scenario: placing an order needs an aggregate invariant, a rule that spans the
// customer and the order, and a transaction. Each one belongs somewhere different.
import { test } from "node:test";
import assert from "node:assert/strict";

type OrderLine = { sku: string; qty: number; unitPrice: number };
type Customer = { id: string; creditLimit: number };
class DomainError extends Error {}

// The aggregate: only its own state, no collaborators.
class Order {
  readonly customerId: string;
  private readonly lines: OrderLine[] = [];
  private state: "draft" | "placed" = "draft";

  constructor(customerId: string) {
    this.customerId = customerId;
  }

  addLine(line: OrderLine): void {
    if (this.state !== "draft") throw new DomainError("order is not editable");
    if (!Number.isInteger(line.qty) || line.qty <= 0) throw new DomainError("qty must be positive");
    this.lines.push(line);
  }

  place(): void {
    if (this.lines.length === 0) throw new DomainError("cannot place an empty order");
    this.state = "placed";
  }

  get total(): number {
    return this.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
  }
  get status(): string {
    return this.state;
  }
  get items(): OrderLine[] {
    return [...this.lines];
  }
}

// The domain service: a rule that needs a customer and an order, no I/O.
class CreditPolicy {
  check(customer: Customer, openTotal: number, newTotal: number): void {
    const available = customer.creditLimit - openTotal;
    if (newTotal > available) throw new DomainError(`limit exceeded: ${available}`);
  }
}

interface Customers {
  byId(id: string): Promise<Customer | null>;
}
interface Orders {
  openTotalFor(customerId: string): Promise<number>;
  save(order: Order): Promise<void>;
}

// The application service: sequence, ports, transaction.
class PlaceOrder {
  private readonly customers: Customers;
  private readonly orders: Orders;
  private readonly policy: CreditPolicy;

  constructor(customers: Customers, orders: Orders, policy: CreditPolicy) {
    this.customers = customers;
    this.orders = orders;
    this.policy = policy;
  }

  async execute(customerId: string, lines: OrderLine[]): Promise<Order> {
    const customer = await this.customers.byId(customerId);
    if (!customer) throw new DomainError("missing customer");

    const order = new Order(customerId);
    for (const line of lines) order.addLine(line);

    const openTotal = await this.orders.openTotalFor(customerId);
    this.policy.check(customer, openTotal, order.total);

    order.place();
    await this.orders.save(order);
    return order;
  }
}

// (b) anti-pattern 1: an anemic aggregate with a service that owns the rules.
class AnemicOrder {
  customerId = "";
  lines: OrderLine[] = [];
  status = "draft";
}
class OrderService {
  place(customerId: string, lines: OrderLine[]): AnemicOrder {
    const order = new AnemicOrder();
    order.customerId = customerId;
    order.lines = lines; // no validation
    order.status = "placed";
    return order;
  }
}

// (b) anti-pattern 2: the "service" is injected into the aggregate.
class CoupledOrder {
  readonly customerId: string;
  private readonly customers: Customers;
  private state = "draft";

  constructor(customerId: string, customers: Customers) {
    this.customerId = customerId;
    this.customers = customers;
  }

  async place(): Promise<void> {
    await this.customers.byId(this.customerId); // I/O for an invariant it can check alone
    this.state = "placed";
  }
  get status(): string {
    return this.state;
  }
}

test("31: the aggregate enforces its invariants with no collaborators", () => {
  const order = new Order("c-1");
  assert.throws(() => order.place(), /empty/);
  assert.throws(() => order.addLine({ sku: "s", qty: 0, unitPrice: 10 }), /positive/);

  order.addLine({ sku: "s", qty: 2, unitPrice: 10 });
  order.place();
  assert.equal(order.status, "placed");
});

test("31: the domain service is a pure rule", () => {
  const policy = new CreditPolicy();
  const customer: Customer = { id: "c-1", creditLimit: 100 };

  assert.doesNotThrow(() => policy.check(customer, 20, 80));
  assert.throws(() => policy.check(customer, 20, 81), /limit exceeded/);
});

test("31: the application service sequences the ports", async () => {
  const saved: Order[] = [];
  const customers: Customers = { byId: async () => ({ id: "c-1", creditLimit: 100 }) };
  const orders: Orders = {
    openTotalFor: async () => 20,
    save: async (order) => { saved.push(order); },
  };

  const order = await new PlaceOrder(customers, orders, new CreditPolicy())
    .execute("c-1", [{ sku: "s", qty: 2, unitPrice: 40 }]);

  assert.equal(order.status, "placed");
  assert.equal(saved.length, 1);
});

test("31: the anemic path places an empty order", () => {
  const order = new OrderService().place("c-1", []);
  assert.equal(order.status, "placed");
  assert.equal(order.lines.length, 0);
});

test("31: service-in-aggregate makes the invariant need I/O", async () => {
  let calls = 0;
  const customers: Customers = {
    byId: async () => { calls += 1; return { id: "c-1", creditLimit: 100 }; },
  };

  await new CoupledOrder("c-1", customers).place();

  assert.equal(calls, 1); // placing an empty order still queried the customer
});
