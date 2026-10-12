// Streams: move data in CHUNKS as it flows, instead of buffering it all in
// memory first. This file builds the stream types by hand and moves bytes
// through them three ways (data events, async iteration, pipeline) — then shows
// backpressure.
//
// Run: `node index.ts`

import { Readable, Writable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { once } from "node:events";

// --- 1. Readable, flowing mode: `data` events ------------------------------
// Readable.from() turns any iterable into a stream. Attaching a `data` listener
// puts the stream in "flowing" mode: chunks are emitted as fast as possible.
console.log("1. flowing mode (`data` events)");
const a = Readable.from(["alpha\n", "beta\n", "gamma\n"]);
a.on("data", (chunk) => {
  process.stdout.write(`   data <- ${JSON.stringify(chunk.toString())}\n`);
});
// `once` (node:events) attaches a one-time listener to an emitter and returns a
// promise that resolves when that event fires. The Readable `a` is itself the
// emitter: when the source pushes `null` the stream is marked ended, and once every
// chunk has been consumed it emits 'end'. `await once(a, "end")` suspends this async
// function until then, so execution can't fall through to section 2 before the data
// events fire.
await once(a, "end");
console.log("   data <- end\n");

// --- 2. Readable, paused mode: async iteration -----------------------------
// A Readable is async-iterable. `for await` pulls one chunk at a time (paused
// mode) — the consumer controls the pace, which is what backpressure needs.
console.log("2. paused mode (`for await`)");
const b = Readable.from(["one\n", "two\n", "three\n"]);
for await (const chunk of b) {
  process.stdout.write(`   for  <- ${JSON.stringify(chunk.toString())}\n`);
}
console.log();

// --- 3. Writable + Transform, wired with pipeline() ------------------------
// A Writable is a destination; a Transform is a Duplex that changes each chunk
// on the way through. pipeline() connects them and forwards errors/cleanup.
console.log("3. pipeline: Readable -> Transform -> Writable");
let bytes = 0;
const sink = new Writable({
  write(chunk, _enc, cb) {
    bytes += chunk.length;
    cb();
  },
});
const upper = new Transform({
  transform(chunk, _enc, cb) {
    cb(null, chunk.toString().toUpperCase());
  },
});
await pipeline(Readable.from(["hello\n", "streams\n"]), upper, sink);
console.log(`   wrote ${bytes} bytes through the transform\n`);

// --- 4. Backpressure: write() returns false when the buffer is full --------
// A Writable has a highWaterMark (buffer size). When it's full, write() returns
// false — that's the signal to STOP writing until the `drain` event.
console.log("4. backpressure (`write()` -> false, then `drain`)");
const slow = new Writable({
  highWaterMark: 32, // tiny buffer, so we hit the limit fast
  write(_chunk, _enc, cb) {
    setTimeout(cb, 20); // pretend each write is slow
  },
});
let n = 0;
while (slow.write(`chunk-${n}\n`)) {
  n += 1;
  if (n > 100_000) break; // safety, should never happen
}
console.log(`   write() accepted ${n} chunk(s), then returned false`);
await once(slow, "drain");
console.log("   `drain` fired -> buffer empty, safe to write again");
slow.end();

// Output (exact byte counts/paths may vary):
//   1. flowing mode (`data` events)
//      data <- "alpha\n"
//      data <- "beta\n"
//      data <- "gamma\n"
//      data <- end
//
//   2. paused mode (`for await`)
//      for  <- "one\n"
//      for  <- "two\n"
//      for  <- "three\n"
//
//   3. pipeline: Readable -> Transform -> Writable
//      wrote 14 bytes through the transform
//
//   4. backpressure (`write()` -> false, then `drain`)
//      write() accepted N chunk(s), then returned false
//      `drain` fired -> buffer empty, safe to write again
