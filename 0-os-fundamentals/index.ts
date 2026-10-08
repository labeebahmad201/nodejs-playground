// Topic 0 — OS & runtime fundamentals, made observable from Node.
// Run: `node index.ts`
//
// worker_threads, the event loop, I/O and limits are thin layers over OS primitives.
// This file pokes at those primitives from JS so the concepts stop being abstract.
// Each section maps to a bullet in ROADMAP.md topic 0.

import { openSync, closeSync, readdirSync } from "node:fs";
import { Worker, threadId } from "node:worker_threads";
import os from "node:os";
import v8 from "node:v8";

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const rule = (title: string) => console.log(`\n=== ${title} ===`);

// ---------------------------------------------------------------------------
// 1. Process vs thread
//    A process owns memory and >=1 thread; threads in it share that memory.
//    A Worker is a thread: same pid, different threadId.
// ---------------------------------------------------------------------------
rule("1. Process vs thread");
console.log(`this process pid : ${process.pid}`);
console.log(`this thread id   : ${threadId}   (0 = main thread)`);

const workerRoundTrip = await new Promise<{ threadId: number; pid: number; echoed: unknown }>(
  (resolve, reject) => {
    const worker = new Worker(new URL("./thread-probe.ts", import.meta.url));
    worker.on("message", (msg: {
      kind: string; threadId: number; pid: number; echoed?: unknown;
    }) => {
      if (msg.kind === "hello") {
        console.log(`worker thread id : ${msg.threadId}`);
        console.log(`worker pid       : ${msg.pid}`);
        console.log(`same process?    : ${msg.pid === process.pid}`);
        worker.postMessage("ping");
      } else if (msg.kind === "echo") {
        console.log(`IPC round-trip   : main -> worker -> main ("${msg.echoed}")`);
        worker.terminate();
        resolve({ threadId: msg.threadId, pid: msg.pid, echoed: msg.echoed });
      }
    });
    worker.once("error", reject);
  },
);
void workerRoundTrip;

// ---------------------------------------------------------------------------
// 2. Address space & memory: RSS (resident) vs heap vs virtual reservations
// ---------------------------------------------------------------------------
rule("2. Memory (RSS vs heap)");
const mem = process.memoryUsage();
console.log(`rss          : ${mb(mem.rss)}   (resident set: physical RAM actually used)`);
console.log(`heapTotal    : ${mb(mem.heapTotal)}   (V8 heap committed)`);
console.log(`heapUsed     : ${mb(mem.heapUsed)}   (live objects)`);
console.log(`external     : ${mb(mem.external)}   (C++ objects, e.g. Buffers)`);
console.log(`arrayBuffers : ${mb(mem.arrayBuffers)}   (ArrayBuffer backing stores)`);
const heap = v8.getHeapStatistics();
console.log(`V8 heap_size_limit: ${mb(heap.heap_size_limit)}   (reserved, not resident)`);

// ---------------------------------------------------------------------------
// 3. File descriptors: the integer handles behind all I/O
// ---------------------------------------------------------------------------
rule("3. File descriptors");
function openFdCount(): number {
  for (const dir of ["/dev/fd", "/proc/self/fd"]) {
    try {
      return readdirSync(dir).length;
    } catch {
      // try the next location
    }
  }
  return -1;
}
const before = openFdCount();
const fd = openSync(import.meta.filename, "r");
const during = openFdCount();
closeSync(fd);
const after = openFdCount();
console.log(`open fds before : ${before}`);
console.log(`openSync -> fd   : ${fd}   (a raw descriptor; sockets/pipes take these too)`);
console.log(`open fds while   : ${during}   (+1 for the file we opened)`);
console.log(`open fds after   : ${after}   (closed again)`);

// ---------------------------------------------------------------------------
// 4. Scheduler & cores
// ---------------------------------------------------------------------------
rule("4. Scheduler & cores");
console.log(`os.cpus()            : ${os.cpus().length}`);
console.log(`os.availableParallelism(): ${os.availableParallelism()}   (usable cores)`);
console.log(`load average (1m)    : ${os.loadavg()[0].toFixed(2)}`);
console.log(`voluntary ctx switches  : ${process.resourceUsage().voluntaryContextSwitches}`);
console.log(`involuntary ctx switches: ${process.resourceUsage().involuntaryContextSwitches}`);

// ---------------------------------------------------------------------------
// 5. Resource limits: the OS walls (ulimit / rlimits / cgroups)
// ---------------------------------------------------------------------------
rule("5. Resource limits (rlimits)");
type Limit = { soft: number | string; hard: number | string };
const limits = (process.report.getReport() as { userLimits?: Record<string, Limit> }).userLimits;
if (limits) {
  for (const [name, l] of Object.entries(limits)) {
    if (/open_files|processes|stack/.test(name)) {
      console.log(`${name.padEnd(22)} soft=${l.soft} hard=${l.hard}`);
    }
  }
}
console.log(`max RSS so far       : ${mb(process.resourceUsage().maxRSS * 1024)}`);

// ---------------------------------------------------------------------------
// 6. Signals
// ---------------------------------------------------------------------------
rule("6. Signals");
const onSigint = () => {};
process.on("SIGINT", onSigint);
console.log(`SIGINT handlers now  : ${process.listenerCount("SIGINT")}   (OS delivers these to the process)`);
process.removeListener("SIGINT", onSigint);
console.log(`SIGINT handlers after: ${process.listenerCount("SIGINT")}`);

console.log("\nAll plain numbers above come from the running process and your OS; they vary by machine.");

// Representative output (values vary):
//   === 1. Process vs thread ===
//   this process pid : 12345
//   this thread id   : 0   (0 = main thread)
//   worker thread id : 1
//   worker pid       : 12345
//   same process?    : true
//   IPC round-trip   : main -> worker -> main ("ping")
//   === 2. Memory (RSS vs heap) ===
//   rss          : 45.2 MB ...
//   === 3. File descriptors ===
//   open fds before : 13
//   openSync -> fd   : 20
//   ...
//   === 4. Scheduler & cores ===
//   os.cpus()            : 10
//   ...
//   === 5. Resource limits (rlimits) ===
//   open_files             soft=1048575 hard=unlimited
//   max_user_processes     soft=4000 hard=6000
//   stack_size_bytes       soft=8372224 hard=67092480
//   === 6. Signals ===
//   SIGINT handlers now  : 1
//   SIGINT handlers after: 0
