// Appendix A — The vocabulary: object, class, value object, entity, model, aggregate
// Scenario: the same domain, labelled precisely. Money is a value object, Order is an
// entity and an aggregate root, OrderSummary is a read model, and a DTO is a shape.
import { test } from "node:test";
import assert from "node:assert/strict";

// Value object: no identity, immutable, equality by value.
class Money {
  readonly cents: number;
  readonly currency: string;

  constructor(cents: number, currency: string) {
    if (!Number.isInteger(cents)) throw new Error("cents must be an integer");
    this.cents = cents;
    this.currency = currency;
    Object.freeze(this);
  }

  equals(other: Money): boolean {
    return this.cents === other.cents && this.currency === other.currency;
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) throw new Error("currency mismatch");
    return new Money(this.cents + other.cents, this.currency);
  }
}

// A value object that lives inside the aggregate.
class OrderLine {
  readonly sku: string;
  readonly price: Money;
  readonly quantity: number;

  constructor(sku: string, price: Money, quantity: number) {
    if (quantity <= 0) throw new Error("quantity must be positive");
    this.sku = sku;
    this.price = price;
    this.quantity = quantity;
  }

  get subtotal(): Money {
    return new Money(this.price.cents * this.quantity, this.price.currency);
  }
}

// Entity and aggregate root: identity survives change; the root guards the invariant.
class Order {
  readonly id: string;
  private status: "draft" | "placed" = "draft";
  private readonly lines: OrderLine[] = [];

  constructor(id: string) {
    this.id = id;
  }

  place(): void {
    if (this.status !== "draft") throw new Error("already placed");
    this.status = "placed";
  }

  sameIdentity(other: Order): boolean {
    return this.id === other.id;
  }

  addLine(line: OrderLine): void {
    if (this.lines.length >= 100) throw new Error("too many lines");
    this.lines.push(line);
  }

  get total(): Money {
    return this.lines.reduce(
      (sum, line) => sum.add(line.subtotal),
      new Money(0, "USD"),
    );
  }

  get lineCount(): number {
    return this.lines.length;
  }
}

// Read model: a shape built for one query, not the aggregate.
type OrderSummary = { id: string; total: string };

function toSummary(order: Order): OrderSummary {
  return { id: order.id, total: `$${(order.total.cents / 100).toFixed(2)}` };
}

// DTO: carries data across a boundary, no behaviour.
type OrderDto = { id: string; totalCents: number };

function toDto(order: Order): OrderDto {
  return { id: order.id, totalCents: order.total.cents };
}

test("A: a value object compares by value and cannot be mutated", () => {
  const a = new Money(1000, "USD");
  const b = new Money(1000, "USD");

  assert.ok(a.equals(b));
  assert.ok(!a.equals(new Money(1000, "EUR")));
  assert.throws(() => a.add(new Money(1, "EUR")), /currency mismatch/);
  assert.throws(() => {
    (a as unknown as { cents: number }).cents = 5;
  }, /read only|not extensible|Cannot assign/i);
});

test("A: an entity compares by identity, even after it changes", () => {
  const order = new Order("o-1");
  const same = new Order("o-1");
  same.place();
  same.addLine(new OrderLine("book", new Money(1000, "USD"), 1));

  assert.ok(order.sameIdentity(same));
  assert.equal(order.sameIdentity(new Order("o-2")), false);
  assert.notEqual(order.total.cents, same.total.cents);
});

test("A: the aggregate root enforces the invariant", () => {
  const order = new Order("o-1");
  order.addLine(new OrderLine("book", new Money(1000, "USD"), 2));
  order.addLine(new OrderLine("pen", new Money(250, "USD"), 1));

  assert.equal(order.total.cents, 2250);
  assert.throws(() => order.addLine(new OrderLine("x", new Money(1, "USD"), 0)), /positive/);

  for (let i = order.lineCount; i < 100; i += 1) {
    order.addLine(new OrderLine(`sku-${i}`, new Money(1, "USD"), 1));
  }
  assert.throws(() => order.addLine(new OrderLine("one-too-many", new Money(1, "USD"), 1)), /too many/);
});

test("A: read models and DTOs are shapes, not domain objects", () => {
  const order = new Order("o-1");
  order.addLine(new OrderLine("book", new Money(1000, "USD"), 1));

  assert.deepEqual(toSummary(order), { id: "o-1", total: "$10.00" });
  assert.deepEqual(toDto(order), { id: "o-1", totalCents: 1000 });
  assert.equal("addLine" in toDto(order), false); // a DTO has no behaviour
});
