# 5. Event loop & async model

Node runs your JavaScript on **one thread**. Asynchronous work is scheduled onto the
**event loop**, which cycles through phases and fires callbacks. Understanding the
order things run in is the key to reasoning about async code.

## Phases (simplified)

```
   ┌───────────────────────────┐
┌─▶│           timers          │  setTimeout / setInterval (due timers)
│  ├───────────────────────────┤
│  │     pending callbacks     │  some system callbacks
│  ├───────────────────────────┤
│  │           poll            │  I/O callbacks (fs, net, ...)
│  ├───────────────────────────┤
│  │           check           │  setImmediate
│  ├───────────────────────────┤
│  │      close callbacks      │  socket.on('close'), ...
└──┤                           │
   └───────────────────────────┘
        ↑ microtasks drain between phases and after each callback
```

Between phases (and after each callback) Node drains the **microtask** queues:
`process.nextTick` callbacks and V8 **promise jobs**. Only when those are empty does
the loop advance to the next phase.

## Run it

```sh
node index.ts
```

## Expected output

```
1 sync start
1 sync end
1 promise microtask
1 process.nextTick microtask
1 setTimeout (timers phase)

2 readFile callback (poll phase)
2 setImmediate (check phase)
2 setTimeout (timers phase)

3 main thread busy for 200ms (no callbacks ran)
3 the 0ms timer actually fired after ~200ms
```

## What each part shows

**1 — microtasks beat timers.** All synchronous code runs first (`sync start`/`sync
end`). Then the microtask queues drain (`promise microtask`, `process.nextTick
microtask`) *before* the `0ms` timer, because a timer must wait for the timers phase.

**2 — `setImmediate` vs `setTimeout` inside I/O.** From a poll-phase I/O callback,
`setImmediate` (check phase) always runs **before** `setTimeout(…, 0)` (timers phase,
next loop turn). Outside I/O, the order of these two is not guaranteed.

**3 — blocking the loop.** A synchronous busy-wait for 200ms prevents *any* timer from
firing. The `0ms` timer fires only after the loop is free, ~200ms late. This is why
CPU-heavy work must be offloaded to `worker_threads` (topic 23) or chunked.

## Gotcha: `process.nextTick` vs promises is not universal

This playground is **ESM** (`"type": "module"`), so here the *promise* job drains
before `process.nextTick`. In **CommonJS** the two lines flip:

| Module system | Order after sync code |
|---------------|-----------------------|
| CommonJS      | `nextTick` → promise  |
| ESM (this repo) | promise → `nextTick` |

Reason: ESM top-level code is already running inside a promise-driven evaluation, so
V8's microtask queue is drained before Node's `nextTick` queue. Don't treat "nextTick
is always first" as a universal rule — it depends on the scheduling context.
