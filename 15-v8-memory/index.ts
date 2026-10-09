// 15-v8-memory/index.ts
//
// Watch V8's memory regions as we allocate, retain, then free objects.
//
// The point of the talk this documents: after garbage collection `heapUsed`
// drops, but `rss` (what the OS sees) stays high — V8 keeps the memory around
// because it expects to allocate again. That is normal, not a leak.
//
// Run:
//   node index.ts
//   node --expose-gc index.ts                 # lets us force a collection
//   node --max-semi-space-size=64 index.ts    # bigger young generation
//   node --max-semi-space-size=1  index.ts    # tiny young generation
//
// Watch `heapTotal` change with --max-semi-space-size; watch `heapUsed` vs
// `rss` diverge as objects are freed; watch the used/total ratio fall after GC.

const MB = (n: number) => (n / 1024 / 1024).toFixed(1).padStart(7) + " MB";

function snapshot(label: string) {
  const m = process.memoryUsage();
  // used/total: how full the committed heap is. Low = mostly reserved-but-free
  // (healthy); near 100% = heap nearly full (GC pressure).
  const ratio = ((m.heapUsed / m.heapTotal) * 100).toFixed(1).padStart(5) + "%";
  console.log(
    `${label.padEnd(26)}` +
      ` rss=${MB(m.rss)}` +
      ` heapTotal=${MB(m.heapTotal)}` +
      ` heapUsed=${MB(m.heapUsed)}` +
      ` used/total=${ratio}` +
      ` external=${MB(m.external)}`
  );
}

snapshot("start");

// Allocate many short-lived objects. "All objects die young": most of these
// should be reclaimed cheaply by the scavenger (young generation).
const retained: number[][] = [];
const CHUNKS = 200_000;
for (let i = 0; i < CHUNKS; i++) {
  // Keep them alive, which forces survivors to be promoted into old space.
  retained.push(new Array(64).fill(i));
  if (i % 50_000 === 0) snapshot(`after ${i.toLocaleString()} chunks`);
}
snapshot("after retaining chunks");

// Drop the references. This doesn't free anything by itself — it just makes the
// objects unreachable, i.e. eligible for collection. They're still counted in
// heapUsed until a GC runs.
// retained.length = 0;

// Force a collection if the runtime allows it. gc() only exists if you run with
// --expose-gc; TypeScript doesn't know it, so we cast globalThis and call it
// optionally. With --expose-gc we get a deterministic collection → heapUsed drops
// to the live set. Without it, no collection is forced, so heapUsed stays at the
// high value (showing why you can't trust a random snapshot).
const maybeGc = (globalThis as { gc?: () => void }).gc;
if (maybeGc) {
  maybeGc();
  snapshot("after drop + gc()");
} else {
  snapshot("after drop (no gc())");
  console.log("(run with --expose-gc to force a collection)");
}
