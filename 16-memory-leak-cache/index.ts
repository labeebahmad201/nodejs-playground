// 16-memory-leak-cache/index.ts
//
// The most common Node.js memory leak: a module-level cache / Map with no
// eviction. Reproduced in a NATURAL setting — no forced GC (no --expose-gc);
// V8 collects on its own, exactly as it would in production.
//
// Real-world instances (cited in README):
//   - express-session's default MemoryStore — Express docs: "It will leak
//     memory under most conditions"
//   - nodejs/node#59733 — a package.json-metadata cache that ballooned heap
//
// Run one mode:
//   node index.ts leaky      # the leak: heapUsed climbs and never plateaus
//   node index.ts bounded    # the fix:  heapUsed plateaus

const MB = (n: number) => (n / 1024 / 1024).toFixed(1).padStart(7) + " MB";

function snapshot(label: string) {
  const m = process.memoryUsage();
  const ratio = ((m.heapUsed / m.heapTotal) * 100).toFixed(1).padStart(5) + "%";
  console.log(
    `${label.padEnd(16)}` +
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

// ❌ Leaky: a module-level cache keyed by a unique id, NEVER evicted. This is
// exactly the express-session MemoryStore pattern: entries go in, nothing
// expires them, so they stay reachable for the life of the process.
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

const mode = process.argv[2] === "bounded" ? "bounded" : "leaky";
const TOTAL = 60_000; // unique keys (unique users / sessions / request ids)
const SAMPLE = 10_000;

console.log(`mode=${mode}  (no forced GC — V8 collects on its own)`);
snapshot("start");

for (let i = 1; i <= TOTAL; i++) {
  if (mode === "leaky") handleLeaky(i);
  else handleBounded(i);
  if (i % SAMPLE === 0) snapshot(`after ${i.toLocaleString()}`);
}

// Keep the cache reachable (as a real module-level cache is) and report it.
console.log(`\nretained entries = ${(mode === "leaky" ? leaky : bounded).size}`);
