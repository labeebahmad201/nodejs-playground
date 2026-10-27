import { OrderService } from "../06-composition-root/order-service.ts";
import {
  ConsoleMailer,
  InMemoryOrderRepository,
  SystemClock,
} from "../06-composition-root/infrastructure.ts";

export interface App {
  service: OrderService;
  orders: InMemoryOrderRepository;
  mailer: ConsoleMailer;
}

/**
 * The production composition root.
 *
 * It knows every concrete class. That is deliberate: this is the edge.
 * The test can call this function without starting a process or opening a port.
 */
export function composeApplication(): App {
  const orders = new InMemoryOrderRepository();
  const mailer = new ConsoleMailer();
  const clock = new SystemClock();
  const service = new OrderService(orders, mailer, clock);

  return { service, orders, mailer };
}
