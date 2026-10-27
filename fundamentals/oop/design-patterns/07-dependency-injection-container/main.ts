// This file is the composition root.
// It is the only file that imports the container.
import { Container } from "./container.ts";
import type {
  Clock,
  Mailer,
  OrderRepository,
} from "../06-composition-root/contracts.ts";
import { OrderService } from "../06-composition-root/order-service.ts";
import {
  ConsoleMailer,
  InMemoryOrderRepository,
  SystemClock,
} from "../06-composition-root/infrastructure.ts";

const tokens = {
  clock: Symbol("Clock"),
  orderRepository: Symbol("OrderRepository"),
  mailer: Symbol("Mailer"),
  orderService: Symbol("OrderService"),
} as const;

async function main(): Promise<void> {
  const container = new Container();

  container.register<Clock>(
    tokens.clock,
    () => new SystemClock(),
    "singleton",
  );

  container.register<OrderRepository>(
    tokens.orderRepository,
    () => new InMemoryOrderRepository(),
    "singleton",
  );

  container.register<Mailer>(
    tokens.mailer,
    () => new ConsoleMailer(),
    "singleton",
  );

  container.register<OrderService>(
    tokens.orderService,
    (c) =>
      new OrderService(
        c.resolve<OrderRepository>(tokens.orderRepository),
        c.resolve<Mailer>(tokens.mailer),
        c.resolve<Clock>(tokens.clock),
      ),
  );

  const first = container.resolve<OrderService>(tokens.orderService);
  const second = container.resolve<OrderService>(tokens.orderService);

  await first.placeOrder("ada@example.com", 42);
  await second.placeOrder("grace@example.com", 30);

  const repository = container.resolve<InMemoryOrderRepository>(
    tokens.orderRepository,
  );
  const repositoryAgain = container.resolve<InMemoryOrderRepository>(
    tokens.orderRepository,
  );
  const mailer = container.resolve<ConsoleMailer>(tokens.mailer);

  console.log(`[container] OrderService is transient: ${first !== second}`);
  console.log(`[container] repository is singleton: ${repositoryAgain === repository}`);
  console.log(`[container] saved orders: ${repository.all().length}`);
  console.log(`[container] sent emails: ${mailer.sent.length}`);

  if (first === second) {
    throw new Error("expected transient OrderService instances");
  }
  if (repositoryAgain !== repository) {
    throw new Error("expected a singleton OrderRepository");
  }
  if (repository.all().length !== 2) {
    throw new Error("expected two saved orders");
  }
  if (mailer.sent.length !== 2) {
    throw new Error("expected two sent emails");
  }

  console.log("assertions passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
