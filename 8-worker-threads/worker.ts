// This file is BOTH:
//   - a normal module, imported by index.ts for the "on the main thread" demo, and
//   - the worker entry point, spawned via `new Worker(new URL("./worker.ts", ...))`.
//
// The `if (parentPort)` guard makes the top-level code run ONLY inside a worker.
// In the main thread `parentPort` is null, so importing this file has no side effects.

import { parentPort, workerData } from "node:worker_threads";

// Deliberately CPU-heavy: naive primality test, O(n·√n). No I/O, no awaits — it
// holds the thread it runs on until it returns.
export function countPrimes(limit: number): number {
  let count = 0;
  for (let n = 2; n <= limit; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) {
      if (n % d === 0) {
        prime = false;
        break;
      }
    }
    if (prime) count++;
  }
  return count;
}

if (parentPort) {
  // We're on a worker thread. Compute and send the result back to the main thread.
  parentPort.postMessage(countPrimes(workerData as number));
}
