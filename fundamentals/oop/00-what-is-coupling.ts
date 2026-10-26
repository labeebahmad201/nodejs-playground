// Tight coupling vs. coupling to an abstraction.
//
// The first consumer constructs a concrete class inside itself; the second
// receives an interface. Same feature, different amount of knowledge — and a
// different answer to "can I test this?"
//
// Run: node fundamentals/oop/00-what-is-coupling.ts

import assert from "node:assert/strict";

type Order = { id: string; email: string; total: number };
type Sent = { to: string; subject: string; body: string };

interface Mailer {
  send(to: string, subject: string, body: string): void;
}

// ---- the concrete implementations ----------------------------------------

class SmtpMailer implements Mailer {
  #host: string;

  constructor(host: string) {
    this.#host = host;
    // Deliberate: constructing the mailer is enough to open a connection.
    console.log(`[smtp] connected to ${host}`);
  }

  send(to: string, subject: string, body: string): void {
    console.log(`[smtp] ${this.#host} -> ${to}: ${subject} / ${body}`);
  }
}

class SlackMailer implements Mailer {
  send(to: string, subject: string, body: string): void {
    console.log(`[slack] -> ${to}: ${subject} / ${body}`);
  }
}

// ---- tight: the consumer writes `new` ------------------------------------

class TightOrderService {
  // The implementation is fixed here, before anyone can ask for another one.
  #mailer = new SmtpMailer("smtp.example.com");

  place(order: Order): void {
    this.#mailer.send(order.email, "Order confirmed", `Total: ${order.total}`);
  }
}

const tight = new TightOrderService();
// Constructing the service already opened the connection. A unit test that
// wants `place` gets SMTP whether it wants it or not.
tight.place({ id: "A-1", email: "ada@example.com", total: 42 });

// No constructor parameter exists for a collaborator, so this does not
// compile. At runtime the argument would be ignored and the built-in
// SmtpMailer used anyway.
// @ts-expect-error -- TightOrderService takes no constructor arguments
new TightOrderService(new SlackMailer());

// ---- loose: the consumer receives an abstraction -------------------------

class LooseOrderService {
  #mailer: Mailer;

  // Constructor injection: the dependency arrives with the object.
  constructor(mailer: Mailer) {
    this.#mailer = mailer;
  }

  place(order: Order): void {
    this.#mailer.send(order.email, "Order confirmed", `Total: ${order.total}`);
  }
}

// Parameter injection: the dependency arrives with the call.
function placeOrder(order: Order, mailer: Mailer): void {
  mailer.send(order.email, "Order confirmed", `Total: ${order.total}`);
}

// ---- the test that the tight version cannot write ------------------------

class RecordingMailer implements Mailer {
  readonly sent: Sent[] = [];

  send(to: string, subject: string, body: string): void {
    this.sent.push({ to, subject, body });
  }
}

const order: Order = { id: "A-2", email: "grace@example.com", total: 30 };
const recording = new RecordingMailer();

new LooseOrderService(recording).place(order);
assert.deepEqual(recording.sent, [
  { to: order.email, subject: "Order confirmed", body: "Total: 30" },
]);

// The same class works with any implementation; the caller decides.
new LooseOrderService(new SlackMailer()).place(order);
placeOrder(order, recording);
assert.equal(recording.sent.length, 2);

// ---- where `new` is allowed ----------------------------------------------

// The entry point — the composition root — is the one place that names a
// concrete class. Everything below it receives.
const mailer: Mailer = new SmtpMailer("smtp.example.com");
new LooseOrderService(mailer).place(order);

console.log("assertions passed");
