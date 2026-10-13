# 8. Worker threads — real threads, same process

The code in `index.ts` runs a CPU-bound job twice — once on the **main thread** and once
on a **worker thread** — while a heartbeat timer ticks in the background. On the main
thread the event loop is blocked (≈0 ticks); on a worker it stays free (ticks keep coming).
Same result, different responsiveness.

## First, what is a thread?

A **thread** is the smallest unit the OS scheduler runs: an independent path of execution
that shares the process's memory with its sibling threads. A **process** owns memory and
at least one thread. Two useful consequences:

- Threads in one process **share memory** (fast, but races are possible).
- Separate processes **don't share memory** (safe isolation, but you must copy/ask).

## The "single-threaded" myth

It's true that your **JavaScript** runs on one thread. It is not true that the **process**
has only one thread. Even a trivial Node program typically has several OS threads:

- the **main thread**, where your JS runs;
- **libuv's threadpool** (default 4 threads, `UV_THREADPOOL_SIZE`) for `fs`, `dns`,
  `zlib`, `crypto` and friends — the I/O that can't be done asynchronously by the OS;
- **V8's** helper threads (compiler, GC, ...).

So "Node is single-threaded" really means "**your JS** is single-threaded" — the runtime
around it is not. (This is Matteo Collina's "Node.js: more threads than you think".) Those
threads are managed *for* you; `worker_threads` is how you add **your own JS threads**.

## What `worker_threads` gives you

`worker_threads` spawns additional JS threads **inside the same process**. Each worker
gets:

- its **own V8 isolate** — its own heap and JS globals (no shared variables as in a
  browser Web Worker);
- its **own event loop** (libuv) — so it can do async I/O too;
- its own `require`/imports and `process` reference (with caveats).

Nothing is shared by default. You exchange data by **message passing**, using the
[structured-clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)
(a deep copy; functions, prototypes and most class identity don't survive). For genuine
shared memory you opt in with `SharedArrayBuffer` + `Atomics`.

## The API in one picture

```ts
// main thread
import { Worker } from "node:worker_threads";

const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  workerData: 42,            // copied once, available as workerData in the worker
});

worker.on("message", (msg) => console.log(msg)); // worker -> main (postMessage)
worker.on("error", (err) => console.error(err)); // uncaught error in the worker
worker.on("exit", (code) => console.log("exited", code));
worker.postMessage("hello");                 // main -> worker

// worker thread (worker.ts)
import { parentPort, workerData } from "node:worker_threads";
parentPort?.postMessage(workerData * 2);
parentPort?.on("message", (msg) => console.log(msg));
```

Handy flags: `isMainThread` (same file, both roles), `threadId`, `worker.terminate()`,
plus `MessageChannel`, `BroadcastChannel`, `SharedArrayBuffer`/`Atomics`.

## When to use it — and when not

| Work | Right tool |
|---|---|
| CPU-bound (hashing, parsing, image/CPU-heavy compute) | **worker_threads** |
| I/O-bound (`fs`, `net`, `fetch`, DB) | nothing — the event loop already handles it (or libuv's threadpool) |
| Fully isolate a crash-prone/untrusted job, or use native addons with their own state | **`child_process`** |
| Use multiple CPU cores for a **server** | **`cluster`** (separate processes sharing a socket) |

The rule of thumb: **`worker_threads` is for CPU, not for I/O.** A worker won't make I/O
faster; it will just add memory and copies.

## The other side of the coin (costs)

- **Not free.** Every worker is a full V8 isolate + event loop: non-trivial memory
  (megabytes) and startup time (tens of ms). Spawning one per request is an anti-pattern.
- **Data is copied.** `postMessage` structured-clones the value. Big payloads cost memory
  and CPU; use transferables (`ArrayBuffer` transfer) or `SharedArrayBuffer` when needed.
- **Pool them.** Keep a fixed set of workers and queue jobs — that's what
  [Piscina](https://github.com/piscinajs/piscina) does, and it's the usual production
  shape.
- **Lifecycle is yours.** Terminate idle workers; a leaked worker keeps the process alive.
- **Errors are local.** An uncaught error in a worker emits `'error'` on the `Worker`
  object — it doesn't automatically take down the main thread, but an unhandled `'error'`
  event will.

## Run it

```sh
node index.ts
```

## Output

```
main thread id: 0
work: count primes below 1,500,000

[main thread]   114,155 primes in 242ms
                heartbeat ticks while busy: 0  <- loop was blocked

[worker thread] 114,155 primes in 307ms
                heartbeat ticks while busy: 11  <- loop stayed free
```

The worker takes about the same wall-clock time for the job, but the **heartbeat keeps
ticking** because the blocking work sits on a different thread than the event loop. (The
worker pays a small startup cost, so its reported time can be a little higher.)

## References

- Node.js docs, *Worker threads* — <https://nodejs.org/api/worker_threads.html>
- Node.js docs, *Cluster* — <https://nodejs.org/api/cluster.html>
- Node.js docs, *Child process* — <https://nodejs.org/api/child_process.html>
- MDN, *Structured clone algorithm* —
  <https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm>
- Matteo Collina, *Node.js: More Threads Than You Think* —
  <https://www.youtube.com/watch?v=r5PIqYyRiAg>
- Piscina (worker pool) — <https://github.com/piscinajs/piscina>
- *The Definitive Guide for Node.js in Enterprise*, Appendix A (The Node.js Event Loop)
  and Ch. 7 (Scaling / Ensuring Scalability & Resilience).
