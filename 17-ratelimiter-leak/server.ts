// 17-ratelimiter-leak/server.ts
//
// Production-like reproduction of a real incident (GitHub community #196856):
// a Node microservice whose in-memory, per-client-IP rate limiter grows without
// bound under high request cardinality, until the process OOMs.
//
//   GET /          -> handled request (a per-client rate-limit bucket)
//   GET /metrics   -> JSON: process.memoryUsage() + cache size + used/total
//
// Run:
//   MODE=leaky   node server.ts     # the leak (default)
//   MODE=bounded node server.ts     # the fix (capped + TTL)
//   PORT=3000 MODE=leaky node server.ts
//
// Then, in another terminal:  node load.mjs   (unique client IPs via autocannon)
// and:                        node monitor.ts (poll /metrics)

import http from "node:http";

const MODE = process.env.MODE === "bounded" ? "bounded" : "leaky";
const PORT = Number(process.env.PORT ?? 3000);
const MAX = Number(process.env.MAX ?? 10_000); // bounded: max entries
const TTL_MS = Number(process.env.TTL_MS ?? 60_000); // bounded: idle expiry
const WINDOW_MS = 1_000; // rate-limit window
const LIMIT = 100; // requests allowed per window per client

interface Bucket {
  count: number;
  windowStart: number;
}

// ❌ Leaky: module-level Map keyed by client id, NEVER evicted. Under high
// cardinality (unique client IPs) it grows for the life of the process.
const leaky = new Map<string, Bucket>();

// ✅ Bounded: hard size cap + TTL, recency-refreshed (a tiny LRU). Real apps
// use `lru-cache` with { max, ttl }.
const bounded = new Map<string, Bucket>();

function clientId(req: http.IncomingMessage): string {
  const xff = req.headers["x-forwarded-for"];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "unknown";
}

function allow(map: Map<string, Bucket>, id: string, cap?: number): boolean {
  const now = Date.now();
  let b = map.get(id);

  if (b && now - b.windowStart > TTL_MS) {
    map.delete(id);
    b = undefined;
  }

  if (!b) {
    if (cap !== undefined && map.size >= cap) {
      map.delete(map.keys().next().value as string); // evict oldest
    }
    map.set(id, { count: 1, windowStart: now });
    return true;
  }

  // refresh recency (for LRU-ish eviction)
  map.delete(id);
  map.set(id, b);

  if (now - b.windowStart > WINDOW_MS) {
    b.count = 1;
    b.windowStart = now;
    return true;
  }
  b.count += 1;
  return b.count <= LIMIT;
}

const server = http.createServer((req, res) => {
  if (req.url === "/metrics") {
    const m = process.memoryUsage();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        mode: MODE,
        uptimeSec: Number(process.uptime().toFixed(1)),
        rss: m.rss,
        heapTotal: m.heapTotal,
        heapUsed: m.heapUsed,
        external: m.external,
        arrayBuffers: m.arrayBuffers,
        usedRatio: Number((m.heapUsed / m.heapTotal).toFixed(4)),
        cacheSize: MODE === "leaky" ? leaky.size : bounded.size,
      })
    );
    return;
  }

  const id = clientId(req);
  const ok = MODE === "leaky" ? allow(leaky, id) : allow(bounded, id, MAX);
  if (!ok) {
    res.writeHead(429, { "content-type": "text/plain" });
    res.end("rate limited\n");
    return;
  }
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("ok\n");
});

server.listen(PORT, () => {
  console.log(`rate-limiter service  MODE=${MODE}  http://localhost:${PORT}`);
  console.log(`  GET /        -> per-client bucket (limit ${LIMIT}/${WINDOW_MS}ms)`);
  console.log(`  GET /metrics -> memory + cache size`);
  console.log(`  note: cache grows with DISTINCT client IPs, not request count`);
  if (MODE === "bounded") console.log(`  bounded: MAX=${MAX} entries, TTL=${TTL_MS}ms`);
});

// Built-in monitoring: log memory + cache size every 2s.
setInterval(() => {
  const m = process.memoryUsage();
  const cache = MODE === "leaky" ? leaky.size : bounded.size;
  const ratio = ((m.heapUsed / m.heapTotal) * 100).toFixed(0);
  console.log(
    `[monitor] ${String(process.uptime().toFixed(0)).padStart(3)}s` +
      ` heapUsed=${(m.heapUsed / 1048576).toFixed(1)}MB` +
      ` rss=${(m.rss / 1048576).toFixed(1)}MB` +
      ` used/total=${ratio}%` +
      ` cache=${cache}`
  );
}, 2000).unref();
