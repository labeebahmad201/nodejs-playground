// 17-ratelimiter-leak/monitor.ts
//
// A tiny monitoring tool: polls the service's /metrics every second and prints
// a live memory + cache trend. This is the "tool for monitoring" — the thing
// that would page you when the heap starts climbing and never comes back.
//
// Run:  node monitor.ts
//   URL=http://localhost:4100/metrics INTERVAL_MS=1000 node monitor.ts

const URL = process.env.URL ?? "http://localhost:4100/metrics";
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? 1000);

const MB = (n: number) => (n / 1048576).toFixed(1).padStart(7) + " MB";

interface Metrics {
  mode: string;
  uptimeSec: number;
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  usedRatio: number;
  cacheSize: number;
}

async function sample(): Promise<void> {
  try {
    const res = await fetch(URL);
    const m = (await res.json()) as Metrics;
    console.log(
      `${String(m.uptimeSec).padStart(6)}s  mode=${m.mode.padEnd(7)}` +
        ` heapUsed=${MB(m.heapUsed)}` +
        ` rss=${MB(m.rss)}` +
        ` used/total=${(m.usedRatio * 100).toFixed(0).padStart(3)}%` +
        ` cache=${m.cacheSize}`
    );
  } catch (err) {
    console.error("metrics fetch failed:", (err as Error).message);
  }
}

console.log(`polling ${URL} every ${INTERVAL_MS}ms  (Ctrl-C to stop)`);
const timer = setInterval(sample, INTERVAL_MS);
process.on("SIGINT", () => {
  clearInterval(timer);
  process.exit(0);
});
void sample();
