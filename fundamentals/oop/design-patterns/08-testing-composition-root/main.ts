import { composeApplication } from "./composition.ts";

async function main(): Promise<void> {
  const app = composeApplication();
  await app.service.placeOrder("ada@example.com", 42);
  console.log("application composed and running");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
