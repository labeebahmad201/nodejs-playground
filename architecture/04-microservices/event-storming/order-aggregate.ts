// A design-level version of the order aggregate.
//
// Event Storming gives you the vocabulary: commands, events, policies, and
// aggregates. This file shows the shape of one aggregate after the board has
// been reduced to a consistency boundary.
//
// The aggregate:
//   - owns the state needed to accept or reject its commands;
//   - enforces its invariants;
//   - returns the events that describe what happened.
//
// It does not call the payment provider, publish messages, or touch a database.
// Those are application and infrastructure concerns.

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "payment_failed"
  | "payment_unknown"
  | "confirmed";

export type OrderEvent =
  | { type: "OrderPlaced"; orderId: string; totalCents: number }
  | { type: "PaymentCaptured"; orderId: string; paymentId: string }
  | { type: "PaymentFailed"; orderId: string }
  | { type: "PaymentUnknown"; orderId: string }
  | { type: "InventoryReserved"; orderId: string }
  | { type: "OrderConfirmed"; orderId: string };

export class Order {
  readonly id: string;
  readonly totalCents: number;

  #status: OrderStatus = "pending_payment";
  #paymentId?: string;
  #inventoryReserved = false;

  private constructor(id: string, totalCents: number) {
    this.id = id;
    this.totalCents = totalCents;
  }

  static place(id: string, totalCents: number): { order: Order; events: OrderEvent[] } {
    if (totalCents <= 0) {
      throw new Error("an order must have a positive total");
    }

    return {
      order: new Order(id, totalCents),
      events: [{ type: "OrderPlaced", orderId: id, totalCents }],
    };
  }

  get status(): OrderStatus {
    return this.#status;
  }

  get paymentId(): string | undefined {
    return this.#paymentId;
  }

  get inventoryReserved(): boolean {
    return this.#inventoryReserved;
  }

  capturePayment(paymentId: string): OrderEvent[] {
    if (this.#status === "paid" || this.#status === "confirmed") {
      if (this.#paymentId === paymentId) return [];
      throw new Error("order already has a different payment");
    }

    if (this.#status === "payment_failed") {
      throw new Error("cannot capture a payment after a definite failure");
    }

    this.#status = "paid";
    this.#paymentId = paymentId;
    return [{ type: "PaymentCaptured", orderId: this.id, paymentId }];
  }

  markPaymentFailed(): OrderEvent[] {
    if (this.#status === "payment_failed") return [];
    if (this.#status === "paid" || this.#status === "confirmed") {
      throw new Error("cannot fail a payment that already succeeded");
    }

    this.#status = "payment_failed";
    return [{ type: "PaymentFailed", orderId: this.id }];
  }

  markPaymentUnknown(): OrderEvent[] {
    if (this.#status === "payment_unknown") return [];
    if (this.#status !== "pending_payment") {
      throw new Error(`cannot mark payment unknown while order is ${this.#status}`);
    }

    this.#status = "payment_unknown";
    return [{ type: "PaymentUnknown", orderId: this.id }];
  }

  recordInventoryReserved(): OrderEvent[] {
    if (this.#inventoryReserved) return [];

    this.#inventoryReserved = true;
    return [{ type: "InventoryReserved", orderId: this.id }];
  }

  confirm(): OrderEvent[] {
    if (this.#status === "confirmed") return [];
    if (this.#status !== "paid") {
      throw new Error(`cannot confirm while order is ${this.#status}`);
    }
    if (!this.#inventoryReserved) {
      throw new Error("cannot confirm before inventory is reserved");
    }

    this.#status = "confirmed";
    return [{ type: "OrderConfirmed", orderId: this.id }];
  }
}
