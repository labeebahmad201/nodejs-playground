// 08 — Do not mirror the vendor
// Scenario: the core wants to welcome a user. Email is one possible channel.
import { test } from "node:test";
import assert from "node:assert/strict";

type User = { id: string; email: string };

// (a) correct: the port states the event; the adapter chooses the channel.
interface WelcomeNotifier {
  welcome(user: User): Promise<void>;
}

class ConsoleNotifier implements WelcomeNotifier {
  readonly sent: string[] = [];
  async welcome(user: User): Promise<void> {
    this.sent.push(`console:${user.email}`);
  }
}

class QueueNotifier implements WelcomeNotifier {
  readonly sent: string[] = [];
  async welcome(user: User): Promise<void> {
    this.sent.push(`queue:${user.email}`);
  }
}

class RegisterUser {
  private readonly notifier: WelcomeNotifier;
  constructor(notifier: WelcomeNotifier) {
    this.notifier = notifier;
  }
  async execute(user: User): Promise<void> {
    await this.notifier.welcome(user);
  }
}

// (b) anti-pattern: the core's vocabulary is the SMTP vendor's.
interface SmtpMailer {
  send(to: string, subject: string, body: string): Promise<void>;
}
class VendorSmtp implements SmtpMailer {
  async send(): Promise<void> {}
}
class SmtpCoupledRegister {
  private readonly mailer: SmtpMailer;
  constructor(mailer: SmtpMailer) {
    this.mailer = mailer;
  }
  async execute(user: User): Promise<void> {
    await this.mailer.send(user.email, "Welcome", "Hello");
  }
}

test("08: swapping the channel does not edit the use case", async () => {
  const user = { id: "u-1", email: "ada@example.com" };
  const consoleNotifier = new ConsoleNotifier();
  const queueNotifier = new QueueNotifier();

  await new RegisterUser(consoleNotifier).execute(user);
  await new RegisterUser(queueNotifier).execute(user);

  assert.deepEqual(consoleNotifier.sent, ["console:ada@example.com"]);
  assert.deepEqual(queueNotifier.sent, ["queue:ada@example.com"]);
});

test("08: the vendor-shaped port cannot accept a different channel", () => {
  // A queue adapter does not implement `send(to, subject, body)`. The core's
  // vocabulary is SMTP's, so the new channel has to pretend to be an SMTP server.
  // @ts-expect-error QueueNotifier is not an SmtpMailer
  const mailer: SmtpMailer = new QueueNotifier();
  assert.ok(mailer);
});
