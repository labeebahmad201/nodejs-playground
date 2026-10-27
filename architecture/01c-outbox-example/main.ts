// Runnable outbox example. See README.md in this folder for the walkthrough.
//
// Run with:
//   node architecture/01c-outbox-example/main.ts
//
// The point of this file is the transaction boundaries:
//   - API handlers have no transaction.
//   - External provider calls have no transaction.
//   - Payment state and the outbox row commit in ONE local transaction.
//   - The relay publishes outside any transaction.
//   - Notification records its own delivery outside the payment transaction.

import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

type PaymentCapturedEvent = {
  eventId: string;
  paymentId: string;
  amount: number;
  capturedAt: string;
};

type OutboxRow = {
  id: string;
  aggregate_id: string;
  event_type: string;
  payload: string;
  occurred_at: string;
};

const db = new DatabaseSync(":memory:");

db.exec(`
  create table payments (
    id text primary key,
    status text not null,
    amount integer not null,
    provider_reference text
  );

  create table outbox (
    id text primary key,
    aggregate_id text not null,
    event_type text not null,
    payload text not null,
    occurred_at text not null,
    published_at text
  );

  create table notification_log (
    event_id text primary key,
    status text not null,
    created_at text not null,
    updated_at text not null,
    sent_at text
  );
`);

function now(): string {
  return new Date().toISOString();
}

// A local database transaction. External calls must never happen inside it.
function transaction<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// ---------------------------------------------------------------------------
// External providers
// ---------------------------------------------------------------------------

class PaymentProvider {
  async capture(input: { idempotencyKey: string; amount: number }) {
    // This is an HTTP API call in a real system.
    // It is NOT inside a database transaction.
    console.log(`  [payment provider] capture ${input.idempotencyKey}`);
    return { providerReference: `pi_${input.idempotencyKey}` };
  }
}

class EmailProvider {
  failNext = false;

  async send(input: { idempotencyKey: string; to: string; subject: string }) {
    // This is an HTTP/SMTP call in a real system.
    // It is NOT inside a database transaction.
    if (this.failNext) {
      this.failNext = false;
      throw new Error("email provider unavailable");
    }
    console.log(`  [email provider] sent "${input.subject}" to ${input.to}`);
  }
}

// ---------------------------------------------------------------------------
// Payments module
// ---------------------------------------------------------------------------

class Payments {
  private readonly provider: PaymentProvider;

  constructor(provider: PaymentProvider) {
    this.provider = provider;
  }

  async capture(paymentId: string, amount: number) {
    // Local transaction 1: create or load the pending payment.
    // No external API call happens here.
    transaction(() => {
      db.prepare(
        `insert or ignore into payments (id, status, amount) values (?, 'PENDING', ?)`,
      ).run(paymentId, amount);
    });

    // External API call. Still no database transaction is open.
    const providerResult = await this.provider.capture({
      idempotencyKey: paymentId,
      amount,
    });

    // Local transaction 2: record the captured payment and the outbox event.
    // This is the outbox pattern: state + event record commit together.
    transaction(() => {
      const updated = db
        .prepare(
          `update payments
             set status = 'CAPTURED', provider_reference = ?
           where id = ? and status = 'PENDING'`,
        )
        .run(providerResult.providerReference, paymentId);

      if (updated.changes === 0) {
        throw new Error(`payment ${paymentId} was not pending`);
      }

      const eventId = randomUUID();

      db.prepare(
        `insert into outbox (id, aggregate_id, event_type, payload, occurred_at)
         values (?, ?, 'PaymentCaptured', ?, ?)`,
      ).run(
        randomUUID(),
        paymentId,
        JSON.stringify({
          eventId,
          paymentId,
          amount,
          capturedAt: now(),
        }),
        now(),
      );
    });

    // The transaction has ended. No provider call happens inside it.
    return { paymentId, status: "CAPTURED" as const };
  }
}

// ---------------------------------------------------------------------------
// Outbox relay
// ---------------------------------------------------------------------------

class OutboxRelay {
  private readonly publish: (event: PaymentCapturedEvent) => Promise<void>;

  constructor(publish: (event: PaymentCapturedEvent) => Promise<void>) {
    this.publish = publish;
  }

  async run() {
    // Single-process demo. Production uses SKIP LOCKED or a lease.
    const rows = db
      .prepare(
        `select id, aggregate_id, event_type, payload, occurred_at
           from outbox
          where published_at is null
          order by occurred_at
          limit 10`,
      )
      .all() as OutboxRow[];

    for (const row of rows) {
      const event = JSON.parse(row.payload) as PaymentCapturedEvent;

      try {
        // Publish outside the DB transaction.
        await this.publish(event);
        db.prepare(`update outbox set published_at = ? where id = ?`).run(
          now(),
          row.id,
        );
        console.log(`  [relay] published ${row.event_type} ${row.id}`);
      } catch (error) {
        // Leave published_at null. The relay retries later.
        console.log(
          `  [relay] publish failed: ${(error as Error).message}`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Notification module
// ---------------------------------------------------------------------------

class Notifications {
  private readonly email: EmailProvider;

  constructor(email: EmailProvider) {
    this.email = email;
  }

  async onPaymentCaptured(event: PaymentCapturedEvent) {
    // Idempotency guard: a unique event_id makes duplicate processing harmless.
    const inserted = db
      .prepare(
        `insert or ignore into notification_log (event_id, status, created_at, updated_at)
         values (?, 'SENDING', ?, ?)`,
      )
      .run(event.eventId, now(), now());

    if (inserted.changes === 0) {
      const existing = db
        .prepare(`select status from notification_log where event_id = ?`)
        .get(event.eventId) as { status: string } | undefined;

      if (existing?.status === "SENT") {
        console.log(`  [notification] duplicate ${event.eventId} ignored`);
        return;
      }

      // A failed or interrupted send can be retried.
      db.prepare(
        `update notification_log set status = 'SENDING', updated_at = ? where event_id = ?`,
      ).run(now(), event.eventId);
    }

    try {
      // External API call. No database transaction is open.
      await this.email.send({
        idempotencyKey: event.eventId,
        to: "customer@example.com",
        subject: "Payment received",
      });

      // Record the delivery after the external call succeeds.
      db.prepare(
        `update notification_log
            set status = 'SENT', sent_at = ?, updated_at = ?
          where event_id = ?`,
      ).run(now(), now(), event.eventId);
    } catch (error) {
      db.prepare(
        `update notification_log set status = 'FAILED', updated_at = ? where event_id = ?`,
      ).run(now(), event.eventId);
      throw error; // relay retries later
    }
  }
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

function show(label: string) {
  console.log(`\n${label}`);
  console.log(
    JSON.stringify(
      {
        payments: db.prepare(`select * from payments order by id`).all(),
        outbox: db.prepare(`select * from outbox order by occurred_at`).all(),
        notifications: db
          .prepare(`select * from notification_log order by created_at`)
          .all(),
      },
      null,
      2,
    ),
  );
}

async function main() {
  const paymentProvider = new PaymentProvider();
  const emailProvider = new EmailProvider();
  const payments = new Payments(paymentProvider);
  const notifications = new Notifications(emailProvider);
  const relay = new OutboxRelay((event) =>
    notifications.onPaymentCaptured(event),
  );

  // API layer: no transaction lives here.
  const postCapturePayment = async (paymentId: string, amount: number) => {
    return payments.capture(paymentId, amount);
  };

  console.log("1) API call: capture pay_1");
  await postCapturePayment("pay_1", 1000);
  show("after API call: payment captured, outbox pending");

  console.log("\n2) Relay publishes PaymentCaptured");
  await relay.run();
  show("after relay: notification sent");

  console.log("\n3) Email provider fails for pay_2");
  emailProvider.failNext = true;
  await postCapturePayment("pay_2", 2000);
  await relay.run();
  show("payment stays captured; notification is not sent");

  console.log("\n4) Relay retries after the provider recovers");
  await relay.run();
  show("notification sent on retry");

  console.log("\n5) Duplicate event is ignored");
  const original = db
    .prepare(`select payload from outbox where aggregate_id = 'pay_1'`)
    .get() as { payload: string };
  db.prepare(
    `insert into outbox (id, aggregate_id, event_type, payload, occurred_at)
     values (?, 'pay_1', 'PaymentCaptured', ?, ?)`,
  ).run(randomUUID(), original.payload, now());
  await relay.run();
  show("still one notification for pay_1");
}

await main();
