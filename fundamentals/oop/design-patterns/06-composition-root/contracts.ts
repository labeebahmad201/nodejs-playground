export interface Order {
  id: string;
  customerEmail: string;
  total: number;
  placedAt: Date;
}

export interface Clock {
  now(): Date;
}

export interface OrderRepository {
  save(order: Order): Promise<void>;
}

export interface Mailer {
  send(to: string, subject: string, body: string): Promise<void>;
}
