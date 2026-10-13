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

**2 — `setImmediate` vs `setTimeout` inside I/O.** The confusing part: timers is at the
**top** of the loop, yet `setImmediate` (check) runs first here. The reason is *where*
they're scheduled, not the list order. Both are scheduled from the `readFile` callback,
which runs in the **poll** phase — already past this lap's timers phase:

```
iteration N
  ├─ timers      (already passed — our setTimeout is not here)
  ├─ pending
  ├─ poll        ← readFile callback runs; schedules setTimeout + setImmediate
  ├─ check       ← setImmediate fires   (still ahead this lap)
  └─ close
iteration N+1
  ├─ timers      ← setTimeout fires      (waits for the next lap)
  └─ ...
```

`setImmediate` is later in the same cycle; `setTimeout` is in timers, which already
went by, so it waits for the **next** lap. A 0ms timer is never "now" — it's "the next
time the timers phase comes around." Outside an I/O callback (e.g. top level), the
order of these two is not guaranteed at all.

**3 — blocking the loop.** A synchronous busy-wait for 200ms prevents *any* timer from
firing. The `0ms` timer fires only after the loop is free, ~200ms late. This is why
CPU-heavy work must be offloaded to `worker_threads` (topic 23) or chunked.

## Why the top-level `await`?

Each of the three steps is wrapped in `await new Promise(...)` — not to use the promise's
value, but as a **sequencer**. The `await` parks the module (yields back to the event
loop) until that step's event fires, then resumes with the next step. Without it the
three demos would schedule their timers at once and their output would interleave.
Top-level `await` is legal here precisely because the file is ESM.

## Where the ESM/CJS setting comes from

The module system is **not** decided in `index.ts`. Node walks **up** from the file's
directory to the nearest `package.json` and reads its `"type"` field:

- `"type": "module"` → `.js`/`.ts` are ESM
- `"type": "commonjs"` (or absent) → `.js`/`.ts` are CJS
- an explicit `.mjs` / `.cjs` extension overrides the `package.json`

For `5-event-loop/index.ts` that nearest ancestor is the repo-root
[`package.json`](../package.json), which sets `"type": "module"` — so this file is ESM.

## Gotcha: `process.nextTick` vs promises is not universal

Because that root `package.json` sets `"type": "module"`, this file is **ESM**, so here
the *promise* job drains before `process.nextTick`. In **CommonJS** the two lines flip:

| Module system | Order after sync code |
|---------------|-----------------------|
| CommonJS      | `nextTick` → promise  |
| ESM (this repo) | promise → `nextTick` |

Reason: ESM top-level code is already running inside a promise-driven evaluation, so
V8's microtask queue is drained before Node's `nextTick` queue. Don't treat "nextTick
is always first" as a universal rule — it depends on the scheduling context.
