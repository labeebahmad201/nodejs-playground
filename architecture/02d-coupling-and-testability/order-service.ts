// The version with seams. The dependencies arrive from outside, so a test can
// replace the database, payment provider, and mailer without touching the use case.
//
// Run the proof: node --test architecture/02d-coupling-and-testability/order-service.test.ts

export type Order = {
  id: string;
  totalCents: number;
  customerEmail: string;
};

export type OrderStatus = "pending" | "paid";

export interface OrderRepo {
  find(id: string): Order;
  markPaid(id: string): void;
}

export interface Payments {
  charge(token: string, cents: number): void;
}

export interface Notifier {
  sendOrderConfirmation(order: Order): void;
}

export class PlaceOrderService {
  readonly #repo: OrderRepo;
  readonly #payments: Payments;
  readonly #notifier: Notifier;

  constructor(repo: OrderRepo, payments: Payments, notifier: Notifier) {
    this.#repo = repo;
    this.#payments = payments;
    this.#notifier = notifier;
  }

  placeOrder(orderId: string, cardToken: string): void {
    const order = this.#repo.find(orderId);
    this.#payments.charge(cardToken, order.totalCents);
    this.#repo.markPaid(orderId);
    this.#notifier.sendOrderConfirmation(order);
  }
}
