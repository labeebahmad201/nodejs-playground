// The event loop in three steps. Run: `node index.ts`

import { readFile } from "node:fs";

const blank = () => console.log();

// 1. Microtasks drain before any timer. In ESM the promise jobs drain before
// process.nextTick (the reverse of CommonJS) — see README.
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
