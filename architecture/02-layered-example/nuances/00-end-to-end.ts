// 00 — One request, end to end
// Scenario: place an order for a customer with a credit limit.
// The chain: controller -> use case -> application service -> domain service
//            -> repository port -> adapter -> aggregate.
// The walkthrough is 02c-end-to-end-slice.md; this is the runnable version.

import { randomUUID } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";

// ── errors ──────────────────────────────────────────────────────────────
class DomainError extends Error {}
class NotFound extends Error {}

class CreditLimitExceeded extends DomainError {
  readonly available: number;
  readonly requested: number;

  constructor(available: number, requested: number) {
    super(`credit limit exceeded: available ${available}, requested ${requested}`);
    this.available = available;
    this.requested = requested;
  }
}

// ── the aggregate: Order is the root, OrderLine lives inside ────────────
type OrderLine = { sku: string; qty: number; unitPrice: number };
type OrderStatus = "draft" | "placed";

class Order {
  readonly id: string;
  readonly customerId: string;

  private readonly lines: OrderLine[];
  private state: OrderStatus;

  private constructor(id: string, customerId: string, lines: OrderLine[], state: OrderStatus) {
    this.id = id;
    this.customerId = customerId;
    this.lines = lines;
    this.state = state;
  }

  static draft(id: string, customerId: string): Order {
    return new Order(id, customerId, [], "draft");
  }

  addLine(line: OrderLine): void {
    if (this.state !== "draft") throw new DomainError("order is not editable");
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      throw new DomainError("quantity must be a positive integer");
    }
    if (line.unitPrice < 0) throw new DomainError("unit price cannot be negative");
    this.lines.push(line);
  }

  place(): void {
    if (this.lines.length === 0) throw new DomainError("cannot place an empty order");
    this.state = "placed";
  }

  get total(): number {
    return this.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
  }

  get status(): OrderStatus {
    return this.state;
  }

  get items(): OrderLine[] {
    return [...this.lines];
  }
}

type Customer = { id: string; creditLimit: number };

// ── the domain service: a rule that spans Order and Customer ────────────
// Pure: no I/O, no save, no commit. The application service loads the data
// and passes it in.
class CreditPolicy {
  check(customer: Customer, openTotal: number, newTotal: number): void {
    const available = customer.creditLimit - openTotal;
    if (newTotal > available) throw new CreditLimitExceeded(available, newTotal);
  }
}

// ── the ports: defined by the inside, in domain terms ───────────────────
interface CustomerRepository {
  find(id: string): Promise<Customer | null>;
}

interface OrderRepository {
  save(order: Order): Promise<void>;
  openTotalFor(customerId: string): Promise<number>;
}

// ── the use case is a contract ─────────────────────────────────────────
type PlaceOrderCommand = { customerId: string; lines: OrderLine[] };
type PlaceOrderResult = { orderId: string; total: number; status: OrderStatus };

interface PlaceOrderUseCase {
  execute(command: PlaceOrderCommand): Promise<PlaceOrderResult>;
}

// ── the application service: one scenario, one transaction ─────────────
class PlaceOrderService implements PlaceOrderUseCase {
  private readonly customers: CustomerRepository;
  private readonly orders: OrderRepository;
  private readonly policy: CreditPolicy;
  private readonly newId: () => string;

  constructor(
    customers: CustomerRepository,
    orders: OrderRepository,
    policy: CreditPolicy,
    newId: () => string,
  ) {
    this.customers = customers;
    this.orders = orders;
    this.policy = policy;
    this.newId = newId;
  }

  async execute(command: PlaceOrderCommand): Promise<PlaceOrderResult> {
    // A real transaction opens here; every write below uses the same handle.
    const customer = await this.customers.find(command.customerId);
    if (!customer) throw new NotFound(`customer ${command.customerId}`);

    const order = Order.draft(this.newId(), customer.id);
    for (const line of command.lines) order.addLine(line);

    const openTotal = await this.orders.openTotalFor(customer.id);
    this.policy.check(customer, openTotal, order.total);

    order.place();
    await this.orders.save(order);
    // ...and commits here. The repository never commits on its own.

    return { orderId: order.id, total: order.total, status: order.status };
  }
}

// ── the adapter: implements the port and owns the row shape ─────────────
type OrderRow = {
  id: string;
  customer_id: string;
  status: OrderStatus;
  lines: OrderLine[];
};

class InMemoryOrderRepository implements OrderRepository {
  private readonly rows = new Map<string, OrderRow>();

  async save(order: Order): Promise<void> {
    this.rows.set(order.id, {
      id: order.id,
      customer_id: order.customerId, // snake_case lives only here
      status: order.status,
      lines: order.items,
    });
  }

  async openTotalFor(customerId: string): Promise<number> {
    let total = 0;
    for (const row of this.rows.values()) {
      if (row.customer_id !== customerId || row.status !== "placed") continue;
      for (const line of row.lines) total += line.qty * line.unitPrice;
    }
    return total;
  }
}

class InMemoryCustomerRepository implements CustomerRepository {
  private readonly customers: Customer[];

  constructor(customers: Customer[]) {
    this.customers = customers;
  }

  async find(id: string): Promise<Customer | null> {
    return this.customers.find((customer) => customer.id === id) ?? null;
  }
}

// ── the controller: protocol in, protocol out ───────────────────────────
class OrdersController {
  private readonly placeOrder: PlaceOrderUseCase;

  constructor(placeOrder: PlaceOrderUseCase) {
    this.placeOrder = placeOrder;
  }

  async handle(request: unknown): Promise<{ status: number; body: unknown }> {
    if (!isPlaceOrderCommand(request)) {
      return { status: 400, body: { error: "invalid request shape" } };
    }

    try {
      const result = await this.placeOrder.execute(request);
      return { status: 201, body: result };
    } catch (error) {
      if (error instanceof DomainError) {
        return { status: 422, body: { error: error.message } };
      }
      if (error instanceof NotFound) {
        return { status: 404, body: { error: error.message } };
      }
      throw error; // unknown: log once at the edge, do not swallow
    }
  }
}

function isPlaceOrderCommand(value: unknown): value is PlaceOrderCommand {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { customerId?: unknown; lines?: unknown };
  if (typeof candidate.customerId !== "string" || !Array.isArray(candidate.lines)) {
    return false;
  }

  return candidate.lines.every((line) => {
    if (typeof line !== "object" || line === null) return false;
    const item = line as Record<string, unknown>;
    return (
      typeof item.sku === "string" &&
      typeof item.qty === "number" &&
      typeof item.unitPrice === "number"
    );
  });
}

// ── the composition root: the only place that knows the concretes ───────
function buildApp(): { controller: OrdersController; placeOrder: PlaceOrderUseCase } {
  const customers = new InMemoryCustomerRepository([{ id: "c1", creditLimit: 100 }]);
  const orders = new InMemoryOrderRepository();
  const policy = new CreditPolicy();
  const placeOrder = new PlaceOrderService(customers, orders, policy, () => randomUUID());

  return { controller: new OrdersController(placeOrder), placeOrder };
}

// ── proofs ─────────────────────────────────────────────────────────────
test("a valid order is placed: 201, with the total", async () => {
  const { controller } = buildApp();

  const response = await controller.handle({
    customerId: "c1",
    lines: [{ sku: "A", qty: 2, unitPrice: 40 }],
  });

  assert.equal(response.status, 201);
  const body = response.body as { total: number; status: string };
  assert.equal(body.total, 80);
  assert.equal(body.status, "placed");
});

test("the domain service blocks the order over the limit: 422", async () => {
  const { controller } = buildApp();
  await controller.handle({
    customerId: "c1",
    lines: [{ sku: "A", qty: 2, unitPrice: 40 }],
  });

  const response = await controller.handle({
    customerId: "c1",
    lines: [{ sku: "B", qty: 1, unitPrice: 200 }],
  });

  assert.equal(response.status, 422);
  assert.match((response.body as { error: string }).error, /credit limit/);
});

test("the aggregate rejects an invalid line: 422", async () => {
  const { controller } = buildApp();

  const response = await controller.handle({
    customerId: "c1",
    lines: [{ sku: "A", qty: 0, unitPrice: 40 }],
  });

  assert.equal(response.status, 422);
  assert.match((response.body as { error: string }).error, /positive integer/);
});

test("the controller rejects a malformed body: 400", async () => {
  const { controller } = buildApp();

  const response = await controller.handle({ customerId: "c1", lines: "nope" });

  assert.equal(response.status, 400);
});

test("a second driver reuses the use case without the controller", async () => {
  const { placeOrder } = buildApp();
  const useCase: PlaceOrderUseCase = placeOrder;

  const result = await useCase.execute({
    customerId: "c1",
    lines: [{ sku: "C", qty: 1, unitPrice: 40 }],
  });

  assert.equal(result.total, 40);
  assert.equal(result.status, "placed");
});
