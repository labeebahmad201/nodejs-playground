// 16-memory-leak-cache/index.ts
//
// The most common Node.js memory leak: a module-level cache / Map with no
// eviction. Reproduced dependency-free. Real-world instances (cited in README):
//   - express-session's default MemoryStore — Express docs: "It will leak
//     memory under most conditions"
//   - nodejs/node#59733 — a package.json-metadata cache that ballooned heap
//
// Run:
//   node index.ts
//   node --expose-gc index.ts     # force GC so we can read the live-set floor

const MB = (n: number) => (n / 1024 / 1024).toFixed(1).padStart(7) + " MB";

function snapshot(label: string) {
  const m = process.memoryUsage();
  const ratio = ((m.heapUsed / m.heapTotal) * 100).toFixed(1).padStart(5) + "%";
  console.log(
    `${label.padEnd(24)}` +
      ` rss=${MB(m.rss)}` +
      ` heapUsed=${MB(m.heapUsed)}` +
      ` heapTotal=${MB(m.heapTotal)}` +
      ` used/total=${ratio}`
  );
}

// ~8 KB of numbers stands in for a "session"/"user" record the cache holds.
function makeRecord(id: number): { id: number; data: number[] } {
  return { id, data: new Array(1024).fill(id) };
}

const N = 20_000; // unique keys (unique users / sessions / request ids)

// ❌ Leaky: a module-level cache keyed by a unique id, NEVER evicted. This is
// exactly the express-session MemoryStore pattern: entries go in, nothing
// expires them, so they stay reachable (and counted in heapUsed) forever.
const leaky = new Map<number, { id: number; data: number[] }>();
function handleLeaky(id: number) {
  if (!leaky.has(id)) leaky.set(id, makeRecord(id));
  return leaky.get(id);
}

// ✅ Bounded: a hard size cap + evict the oldest. Real apps use `lru-cache`
// with `max` + `ttl`; the point is that it CANNOT grow without bound.
const bounded = new Map<number, { id: number; data: number[] }>();
const MAX = 1_000;
function handleBounded(id: number) {
  if (!bounded.has(id)) {
    if (bounded.size >= MAX) bounded.delete(bounded.keys().next().value as number);
    bounded.set(id, makeRecord(id));
  }
  return bounded.get(id);
}

const gc = (globalThis as { gc?: () => void }).gc;

snapshot("start");

// --- Leaky cache: the live-set floor climbs and never comes back -------------
for (let i = 0; i < N; i++) handleLeaky(i);
snapshot(`leaky: ${N} unique keys`);
gc?.();
snapshot("leaky: post-GC");

// Reset so the two runs don't interfere.
leaky.clear();
gc?.();
snapshot("after clear + GC");

// --- Bounded cache: flat, because it evicts ---------------------------------
for (let i = 0; i < N; i++) handleBounded(i);
snapshot(`bounded: ${N} unique keys`);
gc?.();
snapshot("bounded: post-GC");

// Keep both caches reachable, as a real module-level cache would be — otherwise
// V8's liveness analysis would collect them (the "dead variable" gotcha).
console.log(`\nretained entries — leaky=${leaky.size}  bounded=${bounded.size}`);
if (!gc) console.log("(run with --expose-gc to read the post-GC live-set floor)");
