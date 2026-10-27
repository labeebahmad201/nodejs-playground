# Outbox example

A runnable example of the outbox pattern, with the transaction boundaries made explicit.

Run it:

```sh
node architecture/01c-outbox-example/main.ts
```

## What to look at

The point is not the SQLite code. The point is where the transactions start and stop.

| Code | Inside a transaction? |
| --- | --- |
| `postCapturePayment` API handler | No |
| `Payments.capture` transaction 1: create `PENDING` | Yes, local |
| `paymentProvider.capture` external API call | **No** |
| `Payments.capture` transaction 2: `CAPTURED` + outbox row | Yes, local |
| `OutboxRelay.run` publish | **No** |
| `Notifications.onPaymentCaptured` email call | **No** |
| `Notifications` delivery log update | Local write only |

The two rules to notice:

1. **No external API call is inside a database transaction.**
2. **Payment state and the outbox row commit in the same local transaction.**

## What the demo shows

1. `pay_1` is captured. The payment row and `PaymentCaptured` outbox row commit together.
2. The relay publishes the event and Notification sends the receipt.
3. `pay_2` is captured while the email provider is down. The payment stays captured; the outbox row remains pending.
4. The relay retries and the receipt is sent.
5. A duplicate event is published. Notification ignores it because the `event_id` is already `SENT`.

## Production caveats

This is a single-process SQLite demo, not production code.

- It does not use `FOR UPDATE SKIP LOCKED` or a lease, so multiple relay instances would need real claiming.
- It publishes in-process, not to a broker.
- It uses SQLite's `BEGIN`/`COMMIT`, not a production database transaction helper.
- The email provider is fake; real external calls need idempotency and reconciliation.
- Retention, dead letters, metrics, and alerting are omitted.

See [01c — Outbox pattern](../01c-outbox-pattern.md) and [01d — Outbox implementation](../01d-outbox-implementation.md) for the full trade-offs and build details.
