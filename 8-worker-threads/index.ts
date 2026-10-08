// worker_threads: run JavaScript on a real OS thread, in the same process.
// Run: `node index.ts`
//
// The JS we write normally runs on ONE thread. A single CPU-bound function blocks
// everything on that thread — including the event loop, so timers, I/O callbacks and
// other requests all wait. `worker_threads` gives you additional threads that each get
// their own event loop and V8 isolate, to move such work off the main thread.
//
// This example runs the SAME CPU-bound job twice, with a heartbeat timer ticking in the
// background, and counts how many ticks happen while the job is "busy":
//   1. on the main thread  -> the loop is blocked, ~0 ticks
//   2. on a worker thread  -> the loop stays free, ticks keep coming

import { Worker, threadId } from "node:worker_threads";
import { countPrimes } from "./worker.ts";

const LIMIT = 1_500_000;
const TICK_MS = 25;

// A timer is a cheap way to observe whether the event loop can run.
function heartbeat() {
  let ticks = 0;
  const id = setInterval(() => ticks++, TICK_MS);
  return { get ticks() { return ticks; }, stop: () => clearInterval(id) };
}

console.log(`main thread id: ${threadId}`);
console.log(`work: count primes below ${LIMIT.toLocaleString()}\n`);

// --- 1. CPU work on the main thread ----------------------------------------
{
  const beat = heartbeat();
  const t0 = performance.now();
  const primes = countPrimes(LIMIT);
  const ms = performance.now() - t0;
  const ticks = beat.ticks;
  beat.stop();
  console.log(`[main thread]   ${primes.toLocaleString()} primes in ${ms.toFixed(0)}ms`);
  console.log(`                heartbeat ticks while busy: ${ticks}  <- loop was blocked\n`);
}

// --- 2. The same CPU work on a worker thread -------------------------------
{
  const beat = heartbeat();
  const t0 = performance.now();
  const primes = await new Promise<number>((resolve, reject) => {
    // `new Worker(entryPoint, options)` spawns a NEW OS THREAD and runs `entryPoint`
    // as its own module, with its own V8 isolate and event loop. It starts immediately
    // (asynchronously) on construction, so we must attach listeners to hear from it.
    //
    // Entry point: `new URL("./worker.ts", import.meta.url)`
    //   - `import.meta.url` is THIS file's absolute URL, e.g. "file:///.../8-worker-threads/index.ts".
    //   - `new URL("./worker.ts", <base>)` resolves the sibling path against that base,
    //     producing an absolute URL to worker.ts. Because it's anchored to this file
    //     (not the current working directory), it still works no matter where `node` is
    //     launched from. A bare "./worker.ts" string would be resolved relative to cwd.
    //   - The `.ts` extension is because we run TypeScript directly via Node's type
    //     stripping; a compiled project would point at "./worker.js".
    //
    // Options: `{ workerData: LIMIT }`
    //   - `workerData` is the initial value handed to the worker, read there as the
    //     imported `workerData` binding. It is structured-cloned (a deep COPY), not
    //     shared — mutating it in the worker does not affect this thread.
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { workerData: LIMIT });
    worker.once("message", resolve);   // result posted back via parentPort
    worker.once("error", reject);
  });
  const ms = performance.now() - t0;
  const ticks = beat.ticks;
  beat.stop();
  console.log(`[worker thread] ${primes.toLocaleString()} primes in ${ms.toFixed(0)}ms`);
  console.log(`                heartbeat ticks while busy: ${ticks}  <- loop stayed free`);
}

// Output (timings/ticks vary by machine; the contrast is the point):
//   main thread id: 0
//   work: count primes below 1,500,000
//
//   [main thread]   114,155 primes in 242ms
//                   heartbeat ticks while busy: 0  <- loop was blocked
//
//   [worker thread] 114,155 primes in 307ms
//                   heartbeat ticks while busy: 11  <- loop stayed free
