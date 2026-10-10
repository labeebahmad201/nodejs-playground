// 17-ratelimiter-leak/load.mjs
//
// Drives load at the service with autocannon. Crucially, it gives every request
// a fresh client IP (via X-Forwarded-For, as if behind a proxy), so the
// rate-limiter's key cardinality explodes — the exact trigger from the incident.
//
// Run:  node load.mjs
//   URL=http://localhost:4100 CONNECTIONS=200 DURATION=30 node load.mjs

import autocannon from "autocannon";

const url = process.env.URL ?? "http://localhost:4100";
const connections = Number(process.env.CONNECTIONS ?? 200);
const duration = Number(process.env.DURATION ?? 30);

console.log(`autocannon -> ${url}  connections=${connections}  duration=${duration}s  (unique IP per request)`);

const instance = autocannon(
  { url, connections, duration, pipelining: 1 },
  (err, result) => {
    if (err) {
      console.error("autocannon error:", err);
      process.exitCode = 1;
      return;
    }
    console.log(autocannon.printResult(result));
  }
);

// A fresh client IP for each request (10.a.b.c -> up to ~16M unique).
let n = 0;
instance.on("response", (client) => {
  const a = (n >> 16) & 0xff;
  const b = (n >> 8) & 0xff;
  const c = n & 0xff;
  client.setHeaders({ "x-forwarded-for": `10.${a}.${b}.${c}` });
  n += 1;
});

process.on("SIGINT", () => instance.stop());
