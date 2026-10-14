// Off-heap leak: `heapUsed` stays flat while `rss` climbs — caused by a stream
// buffer that is never drained.
//
// A Buffer's bytes live OFF the V8 JS heap (tracked under `external` / `arrayBuffers`),
// so they count toward RSS but NOT toward `heapUsed`. If a Readable is never consumed,
// every `push()` accumulates in its internal buffer: RSS grows, the JS heap does not.
//
// Run:
//   node index.ts              # leaky (default): never consume the stream
//   MODE=fixed node index.ts   # fixed: consume (discard) the stream
//
// Optional: DURATION_MS=8000 to shorten the run.

import { Readable } from "node:stream";

const MODE = process.env.MODE === "fixed" ? "fixed" : "leaky";
const DURATION_MS = Number(process.env.DURATION_MS ?? 20000);
const CHUNK_BYTES = 64 * 1024; // 64 KiB — above Buffer.poolSize, so a fresh off-heap alloc each time

// A Readable we drive by hand. `read()` is called by the machinery only when a
// consumer pulls — with no consumer, pushed chunks just pile up in the buffer.
const src = new Readable({
  read() {
    /* manual push source */
  },
});

if (MODE === "fixed") {
  // Consume and discard: the stream is drained as fast as it fills, so the buffer
  // never accumulates (backpressure respected).
  src.on("data", () => {});
}

const MB = (n: number): string => (n / 1024 / 1024).toFixed(1).padStart(6);

console.log(`MODE=${MODE} — watch heapUsed stay flat while rss / external / arrayBuffers move\n`);
console.log("   time  heapUsed     rss  external  arrayBuf  readBuf");
const t0 = Date.now();

const producer = setInterval(() => {
  // Non-zero fill on purpose: zero-filled pages may map the shared zero page and not
  // count toward RSS, so we write real bytes to force the pages resident.
  for (let i = 0; i < 16; i++) src.push(Buffer.alloc(CHUNK_BYTES, 0xab));
}, 50); // ~1 MiB / 50 ms ≈ 20 MiB/s of fresh off-heap buffers

const sampler = setInterval(() => {
  const m = process.memoryUsage();
  const s = ((Date.now() - t0) / 1000).toFixed(0).padStart(4);
  console.log(
    `   ${s}s ${MB(m.heapUsed)} ${MB(m.rss)} ${MB(m.external)} ${MB(m.arrayBuffers)} ${MB(src.readableLength)}`
  );
}, 1000);

setTimeout(() => {
  clearInterval(producer);
  clearInterval(sampler);
  const m = process.memoryUsage();
  console.log(
    `\nfinal: heapUsed=${MB(m.heapUsed)} MB  rss=${MB(m.rss)} MB  ` +
      `external=${MB(m.external)} MB  arrayBuffers=${MB(m.arrayBuffers)} MB  ` +
      `readableLength=${MB(src.readableLength)} MB`
  );
  console.log(
    MODE === "leaky"
      ? "-> heapUsed ~flat, rss/external/arrayBuffers grew: an off-heap leak."
      : "-> rss/external/arrayBuffers stayed bounded: consumed, no leak."
  );
}, DURATION_MS);
