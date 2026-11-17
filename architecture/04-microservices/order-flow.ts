// A small order service that calls a remote payment provider.
//
// The interesting failure is not "the provider is down". It is "the provider
// charged the card, but the response never arrived". The caller cannot tell
// success from failure, so a blind retry can charge the customer twice.
//
// The stable idempotency key makes the retry safe: the provider recognizes the
// second request as the same logical charge and returns the original result.
//
// Run the proof: node --test architecture/04-microservices/order-flow.test.ts

export type OrderStatus =
  | "pending"
  | "paid"
  | "payment_failed"
  | "payment_unknown";

export type Order = {
  id: string;
  totalCents: number;
  status: OrderStatus;
  paymentId?: string;
};

export interface OrderStore {
  find(id: string): Order;
  markPaid(id: string, paymentId: string): void;
  markPaymentFailed(id: string): void;
  markPaymentUnknown(id: string): void;
}

export type ChargeInput = {
  idempotencyKey: string;
  cardToken: string;
  amountCents: number;
};

export interface PaymentProvider {
  charge(input: ChargeInput): string;
}

export class PaymentTimeout extends Error {}
export class CardDeclined extends Error {}

export class PlaceOrder {
  readonly #orders: OrderStore;
  readonly #payments: PaymentProvider;
  readonly #maxAttempts: number;

  constructor(
    orders: OrderStore,
    payments: PaymentProvider,
    maxAttempts = 2,
  ) {
    this.#orders = orders;
    this.#payments = payments;
    this.#maxAttempts = maxAttempts;
  }

  execute(orderId: string, cardToken: string): void {
    const order = this.#orders.find(orderId);
    if (order.status === "paid") return;

    // Stable across retries. It identifies the logical charge, not the attempt.
    // A fresh key per attempt would make every retry a new charge.
    const idempotencyKey = `order:${order.id}:charge`;

    for (let attempt = 1; attempt <= this.#maxAttempts; attempt++) {
      try {
        const paymentId = this.#payments.charge({
          idempotencyKey,
          cardToken,
          amountCents: order.totalCents,
        });

        this.#orders.markPaid(order.id, paymentId);
        return;
      } catch (error) {
        if (error instanceof PaymentTimeout) {
          // A timeout is an unknown outcome, not a failure. Retry with the
          // same key; if the retries are exhausted, leave the order in a state
          // that a reconciliation job can resolve.
          if (attempt < this.#maxAttempts) continue;
          this.#orders.markPaymentUnknown(order.id);
          throw error;
        }

        this.#orders.markPaymentFailed(order.id);
        throw error;
      }
    }
  }
}
