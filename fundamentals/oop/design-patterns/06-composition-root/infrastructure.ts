import type { Clock, Mailer, Order, OrderRepository } from "./contracts.ts";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders: Order[] = [];

  async save(order: Order): Promise<void> {
    this.orders.push(order);
    console.log(`[db] saved order ${order.id} for ${order.customerEmail}`);
  }

  all(): readonly Order[] {
    return this.orders;
  }
}

export class ConsoleMailer implements Mailer {
  readonly sent: Array<{ to: string; subject: string; body: string }> = [];

  async send(to: string, subject: string, body: string): Promise<void> {
    this.sent.push({ to, subject, body });
    console.log(`[mail] ${to}: ${subject} — ${body}`);
  }
}
