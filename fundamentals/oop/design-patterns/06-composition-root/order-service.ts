import { randomUUID } from "node:crypto";
import type { Clock, Mailer, Order, OrderRepository } from "./contracts.ts";

export class OrderService {
  private readonly orders: OrderRepository;
  private readonly mailer: Mailer;
  private readonly clock: Clock;

  constructor(orders: OrderRepository, mailer: Mailer, clock: Clock) {
    this.orders = orders;
    this.mailer = mailer;
    this.clock = clock;
  }

  async placeOrder(customerEmail: string, total: number): Promise<Order> {
    const order: Order = {
      id: randomUUID(),
      customerEmail,
      total,
      placedAt: this.clock.now(),
    };

    await this.orders.save(order);
    await this.mailer.send(customerEmail, "Order confirmed", `Total: ${total}`);

    return order;
  }
}
