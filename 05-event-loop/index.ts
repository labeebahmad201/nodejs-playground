// The event loop in three steps. Run: `node index.ts`
//
// Each step is wrapped in `await new Promise(...)`. The await isn't for a value:
// it parks this module until that step's event fires, so the three demos run in
// order instead of interleaving.
//
// ESM vs CJS — which decides step 1's ordering — is not set in this file. Node walks
// up from this directory to the nearest package.json and reads its "type" field.
// That file is ../package.json ("type": "module"), so this file is ESM. The .mjs/.cjs
// extension, if present, would override it.
//
// Each step prints its expected output in the comment right above it, so you can read
// the file top-to-bottom without running it.

import { readFile } from "node:fs";

const blank = () => console.log();

// 1. Microtasks drain before any timer. In ESM the promise jobs drain before
// process.nextTick (the reverse of CommonJS) — see README.
//
// This timer is scheduled at top level, before the loop ever starts turning, so it
// sits in the loop's FIRST phase (timers) and fires on the first lap. But microtasks
// always drain before any phase callback, so they print first.
//
// Output:
//   1 sync start
//   1 sync end
//   1 promise microtask
//   1 process.nextTick microtask
//   1 setTimeout (timers phase)
await new Promise<void>((resolve) => {
  console.log("1 sync start");
  setTimeout(() => {
    console.log("1 setTimeout (timers phase)");
    resolve();
  }, 0);
  Promise.resolve().then(() => console.log("1 promise microtask"));
  process.nextTick(() => console.log("1 process.nextTick microtask"));
  console.log("1 sync end");
});

blank();

// 2. Inside an I/O callback, the check phase (setImmediate) runs before timers.
//
// Wait — timers is at the TOP of the loop, so why does setImmediate (check) win?
// Because it's not about the list order, it's about WHERE you scheduled them. Both
// are scheduled from the readFile callback, which runs in the POLL phase — already
// past this lap's timers phase. The loop is a cycle:
//
//   iteration N
//     timers     -- already passed; our setTimeout is NOT here
//     pending
//     poll       <-- readFile callback runs; schedules setTimeout + setImmediate
//     check      -- setImmediate fires  (still ahead this lap)
//     close
//   iteration N+1
//     timers     -- setTimeout fires     (waits for the next lap)
//
// So timers "at the top" is exactly why it only comes around again next lap. A 0ms
// timer is never "now"; it's "the next time the timers phase arrives".
//
// Output:
//   2 readFile callback (poll phase)
//   2 setImmediate (check phase)
//   2 setTimeout (timers phase)
await new Promise<void>((resolve) => {
  readFile(import.meta.filename, () => {
    console.log("2 readFile callback (poll phase)");
    setTimeout(() => {
      console.log("2 setTimeout (timers phase)");
      resolve();
    }, 0);
    setImmediate(() => console.log("2 setImmediate (check phase)"));
  });
});

blank();

// 3. A synchronous loop blocks the loop: no timer can fire until it finishes.
//
// The 0ms timer is scheduled, then we busy-wait 200ms. While JS is running the loop
// cannot turn, so the timer can't fire. Its delay is measured from scheduling to
// actually running, so it reports ~200ms.
//
// Output:
//   3 main thread busy for 200ms (no callbacks ran)
//   3 the 0ms timer actually fired after ~200ms
const start = Date.now();
let firedAfter = -1;
setTimeout(() => {
  firedAfter = Date.now() - start;
}, 0);

const until = start + 200;
while (Date.now() < until) {
  // busy-wait 200ms on the main thread
}
console.log("3 main thread busy for 200ms (no callbacks ran)");

await new Promise<void>((resolve) => {
  setTimeout(() => {
    console.log(`3 the 0ms timer actually fired after ~${firedAfter}ms`);
    resolve();
  }, 0);
});
