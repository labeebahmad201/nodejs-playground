import type {
  Clock,
  Mailer,
  Order,
  OrderRepository,
} from "../06-composition-root/contracts.ts";

export class RecordingOrderRepository implements OrderRepository {
  readonly orders: Order[] = [];

  async save(order: Order): Promise<void> {
    this.orders.push(order);
  }

  all(): readonly Order[] {
    return this.orders;
  }
}

export class RecordingMailer implements Mailer {
  readonly sent: Array<{ to: string; subject: string; body: string }> = [];

  async send(to: string, subject: string, body: string): Promise<void> {
    this.sent.push({ to, subject, body });
  }
}

export class FixedClock implements Clock {
  private readonly value: Date;

  constructor(value: Date) {
    this.value = value;
  }

  now(): Date {
    return this.value;
  }
}
