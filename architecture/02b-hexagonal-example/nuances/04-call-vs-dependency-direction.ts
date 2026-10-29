// 04 — Call direction is not dependency direction
// Scenario: at runtime the core calls the notifier; at compile time the notifier
// adapter depends on the core's port.
import { test } from "node:test";
import assert from "node:assert/strict";

type User = { id: string; email: string };

interface Users {
  save(user: User): Promise<void>;
}

interface Notifier {
  welcome(user: User): Promise<void>;
}

class Core {
  private readonly users: Users;
  private readonly notifier: Notifier;
  readonly timeline: string[] = [];

  constructor(users: Users, notifier: Notifier) {
    this.users = users;
    this.notifier = notifier;
  }

  async execute(email: string): Promise<User> {
    const user = { id: "u-1", email };
    this.timeline.push("save");
    await this.users.save(user);
    this.timeline.push("notify");
    await this.notifier.welcome(user);
    return user;
  }
}

class RecordingUsers implements Users {
  readonly calls: string[] = [];
  async save(user: User): Promise<void> {
    this.calls.push(`save:${user.id}`);
  }
}

class RecordingNotifier implements Notifier {
  readonly calls: string[] = [];
  async welcome(user: User): Promise<void> {
    this.calls.push(`welcome:${user.email}`);
  }
}

// (b) anti-pattern: the core imports the concrete adapter to call it.
class CoupledCore {
  private readonly adapter = new RecordingNotifier(); // new inside the core
  async execute(email: string): Promise<void> {
    await this.adapter.welcome({ id: "u-1", email });
  }
}

test("04: the runtime call goes outward, the source dependency inward", async () => {
  const users = new RecordingUsers();
  const notifier = new RecordingNotifier();
  const core = new Core(users, notifier); // the edge injects both adapters

  await core.execute("ada@example.com");

  assert.deepEqual(core.timeline, ["save", "notify"]);
  assert.deepEqual(users.calls, ["save:u-1"]);
  assert.deepEqual(notifier.calls, ["welcome:ada@example.com"]);
});

test("04: importing the adapter makes the core untestable in isolation", async () => {
  const core = new CoupledCore();
  await core.execute("ada@example.com");
  // There is no constructor argument to substitute; the core always sends for real.
  assert.equal((core as unknown as { adapter: RecordingNotifier }).adapter.calls.length, 1);
});
