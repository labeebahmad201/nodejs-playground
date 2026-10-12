// Companion to Matteo Collina's "A Deep Dive into Node.js Streams" (Platformatic,
// 2024): https://www.youtube.com/watch?v=edB964-YYpE
//
// The basic demo (index.ts) shows the four types and backpressure. This one goes
// deeper, following the masterclass: writing your own stream, the `.pipe()`
// error-handling trap vs `pipeline()`, async generators as transforms, and
// Node.js <-> Web Streams interop.
//
// Run: `node deep-dive.ts`

import { Readable, Writable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// --- 1. Writing a Readable: implement _read(), call push() / push(null) ----
// You never call `_read()` yourself — the machinery calls it when it wants more.
// push(chunk) adds data; push(null) signals end-of-stream.
console.log("1. custom Readable (`_read` + `push`)");
class Countdown extends Readable {
  #n = 3;
  _read(): void {
    this.push(this.#n > 0 ? `${this.#n}\n` : null);
    this.#n -= 1;
  }
}
for await (const chunk of new Countdown()) {
  process.stdout.write(`   ${chunk}`);
}
console.log();

// --- 2. `.pipe()` vs `pipeline()`: the error-handling trap -----------------
// "Cleaned up" = *destroyed*: the stream tears down, releases its resources (buffers,
// and for a real file/socket the file descriptor) and emits 'close' — stronger than
// merely "stopped", since an idle-but-alive stream still holds an open fd + buffered
// data. `.pipe()` wires data flow + 'end' only: it does NOT forward errors and does
// NOT destroy the other streams when one fails. So a broken transform leaves the
// source and sink dangling (a leak). `pipeline()` attaches error handling to every
// stage and destroys the whole chain on failure. This is the masterclass's headline
// reason to prefer `pipeline()`.
function boomAfter(limit: number): Transform {
  let seen = 0;
  return new Transform({
    transform(chunk, _enc, cb) {
      if (seen++ === limit) cb(new Error("BOOM"));
      else cb(null, chunk.toString().toUpperCase());
    },
  });
}

console.log("2. `.pipe()` leaks on error; `pipeline()` cleans up");

// (a) .pipe() — the transform errors, but nobody else is told.
//     On BOOM: `src` is never destroyed (it still holds its buffer / fd) and `sink`
//     never gets .end(), so both stay open (leak). The error fires only on `boom`'s
//     own 'error' — hence the manual listener (an unhandled 'error' would crash the
//     process). With in-memory streams the leak is invisible, so we print the
//     `destroyed` booleans as the observable proxy for the cleanup that should happen.
{
  const got: string[] = [];
  const sink = new Writable({ write(c, _e, cb) { got.push(c.toString()); cb(); } });
  const src = Readable.from(["a", "b", "c", "d", "e"]);
  const boom = boomAfter(2);
  boom.on("error", (e) => console.log(`   pipe: error "${e.message}"`));
  src.pipe(boom).pipe(sink);
  await sleep(50);
  console.log(
    `   pipe: got "${got.join("")}" | src.destroyed=${src.destroyed} sink.writableEnded=${sink.writableEnded}`
  );
  console.log("   pipe: -> source + sink were never cleaned up (leak)\n");
}

// (b) pipeline() — same failure, but every stream is destroyed.
{
  const got: string[] = [];
  const sink = new Writable({ write(c, _e, cb) { got.push(c.toString()); cb(); } });
  const src = Readable.from(["a", "b", "c", "d", "e"]);
  try {
    await pipeline(src, boomAfter(2), sink);
  } catch (e) {
    console.log(`   pipeline: error "${(e as Error).message}"`);
  }
  console.log(
    `   pipeline: got "${got.join("")}" | src.destroyed=${src.destroyed} sink.destroyed=${sink.destroyed}`
  );
  console.log("   pipeline: -> every stream destroyed, error propagated\n");
}

// --- 3. Async generators as transforms ------------------------------------
// An async generator is a valid transform stage: read chunks, yield new ones.
// No Transform subclass needed. (Collina calls async iterators the standard way
// to interface with streams.)
console.log("3. async generator as a transform");
await pipeline(
  Readable.from(["one\n", "two\n"]),
  async function* (source) {
    for await (const chunk of source) {
      yield chunk.toString().toUpperCase();
    }
  },
  new Writable({
    write(chunk, _enc, cb) {
      process.stdout.write(`   gen: ${chunk}`);
      cb(); // says I am done with this chunk.
    },
  })
);
console.log();

// --- 4. Node.js streams <-> Web Streams ------------------------------------
// `fetch().body` is a WHATWG ReadableStream, not a Node Readable. Convert with
// `Readable.fromWeb` / `Readable.toWeb`; both are async-iterable, so `pipeline`
// and `for await` work across the boundary.
console.log("4. Node.js <-> Web Streams interop");
const nodeReadable = Readable.from(["web\n", "streams\n"]);
const webStream = Readable.toWeb(nodeReadable);
for await (const chunk of Readable.fromWeb(webStream)) {
  process.stdout.write(`   web: ${Buffer.from(chunk).toString()}`);
}

// Output (exact cleanup booleans may vary):
//   1. custom Readable (`_read` + `push`)
//      3
//      2
//      1
//
//   2. `.pipe()` leaks on error; `pipeline()` cleans up
//      pipe: error "BOOM"
//      pipe: got "AB" | src.destroyed=false sink.writableEnded=false
//      pipe: -> source + sink were never cleaned up (leak)
//      pipeline: error "BOOM"
//      pipeline: got "AB" | src.destroyed=true sink.destroyed=true
//      pipeline: -> every stream destroyed, error propagated
//
//   3. async generator as a transform
//      gen: ONE
//      gen: TWO
//
//   4. Node.js <-> Web Streams interop
//      web: web
//      web: streams
