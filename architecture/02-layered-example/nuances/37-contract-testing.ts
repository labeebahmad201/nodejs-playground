// 37 — Contract testing
// Scenario: the consumer owns a contract; every provider implementation must satisfy it.
// HttpGateway here is a stand-in: this file proves the suite's mechanism, not a network
// call. In real use the same adapter is constructed with a stub URL (PRs) or a sandbox URL
// (nightly); the endpoint changes, the code path does not.
import { test } from "node:test";
import assert from "node:assert/strict";

type ChargeResult = { id: string; status: "paid" | "failed" };

interface PaymentGateway {
  charge(amount: number): Promise<ChargeResult>;
}

class FakeGateway implements PaymentGateway {
  async charge(_amount: number): Promise<ChargeResult> {
    return { id: "fake-1", status: "paid" };
  }
}

class HttpGateway implements PaymentGateway {
  async charge(_amount: number): Promise<ChargeResult> {
    return { id: "http-1", status: "paid" };
  }
}

// (b) anti-pattern: a mock that returns a shape the real provider never returns.
class BadMockGateway {
  async charge(_amount: number): Promise<unknown> {
    return { ok: true };
  }
}

// (a) correct: one contract, run against every implementation.
async function assertPaymentContract(gateway: PaymentGateway): Promise<void> {
  const result = await gateway.charge(10);
  assert.equal(typeof result.id, "string");
  assert.ok(result.id.length > 0);
  assert.ok(result.status === "paid" || result.status === "failed");
}

test("37: the fake and the HTTP adapter satisfy the same contract", async () => {
  await assertPaymentContract(new FakeGateway());
  await assertPaymentContract(new HttpGateway());
});

test("37: the bad mock fails the contract", async () => {
  await assert.rejects(
    assertPaymentContract(new BadMockGateway() as unknown as PaymentGateway),
    /string/,
  );
});
