// This file is the composition root.
// It is the only file that imports the concrete infrastructure.
import { OrderService } from "./order-service.ts";
import {
  ConsoleMailer,
  InMemoryOrderRepository,
  SystemClock,
} from "./infrastructure.ts";

async function main(): Promise<void> {
  const customerEmail = process.env.CUSTOMER_EMAIL ?? "ada@example.com";
  const rawTotal = process.env.ORDER_TOTAL ?? "42";
  const total = Number(rawTotal);

  if (!Number.isFinite(total)) {
    throw new Error(`ORDER_TOTAL must be a number, got ${rawTotal}`);
  }

  const orders = new InMemoryOrderRepository();
  const mailer = new ConsoleMailer();
  const clock = new SystemClock();

  const service = new OrderService(orders, mailer, clock);
  const order = await service.placeOrder(customerEmail, total);

  console.log("[root] composed OrderService with in-memory db, console mail, system clock");
  console.log(`[root] order ${order.id} total ${order.total}`);

  if (orders.all().length !== 1) {
    throw new Error("expected one saved order");
  }
  if (mailer.sent.length !== 1) {
    throw new Error("expected one sent email");
  }
  if (!(order.placedAt instanceof Date)) {
    throw new Error("expected the clock to return a Date");
  }

  console.log("assertions passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
