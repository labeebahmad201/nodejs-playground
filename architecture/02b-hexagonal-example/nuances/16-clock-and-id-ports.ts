// 16 — Time and identity are driven ports
// Scenario: a registration test must assert the exact timestamp and id.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FixedClock, sequentialIds } from "../_shared.ts";

type User = { id: string; email: string; registeredAt: Date };

interface Clock {
  now(): Date;
}
interface Ids {
  next(): string;
}

// (a) correct: the core receives time and identity.
class RegisterUser {
  private readonly clock: Clock;
  private readonly ids: Ids;
  constructor(clock: Clock, ids: Ids) {
    this.clock = clock;
    this.ids = ids;
  }
  execute(email: string): User {
    return { id: this.ids.next(), email, registeredAt: this.clock.now() };
  }
}

// (b) anti-pattern: the core reads the system clock and generates its own ids.
class SelfTimedRegister {
  execute(email: string): User {
    return { id: globalThis.crypto.randomUUID(), email, registeredAt: new Date() };
  }
}

test("16: fixed ports make the result exact", () => {
  const register = new RegisterUser(new FixedClock("2000-01-01T00:00:00.000Z"), { next: sequentialIds("u") });

  const user = register.execute("ada@example.com");

  assert.deepEqual(user, {
    id: "u-1",
    email: "ada@example.com",
    registeredAt: new Date("2000-01-01T00:00:00.000Z"),
  });
});

test("16: the self-timed core cannot be asserted exactly", () => {
  const user = new SelfTimedRegister().execute("ada@example.com");

  assert.notEqual(user.registeredAt.toISOString(), "2000-01-01T00:00:00.000Z");
  assert.match(user.id, /^[0-9a-f-]{36}$/);
  // The test can only assert a shape and a range, not the behavior it cares about.
});
