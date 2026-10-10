# 17. Rate-limiter memory leak — production-like reproduction

A production-shaped reproduction of a **real, verified incident**: an in-memory,
per-client rate limiter whose `Map` grows with request cardinality until the process OOMs.

Unlike `16-memory-leak-cache` (a minimal, dependency-free demo), this is a **running service +
load generator + monitoring tool**, so we can watch the leak happen and then apply the fix.

## The verified case

**GitHub community discussion #196856** — *"Memory leak in long-running Node.js service, heap
grows indefinitely despite manual cleanup"* (<https://github.com/orgs/community/discussions/196856>):

- Node.js 20 microservice processing a high-volume event stream (**~5k events/sec**), Fastify 4, on
  **AWS ECS with a 2 GB limit**.
- Heap climbed **~180 MB → 2 GB in 6–8 h**, then crashed. Not reproducible in staging (lower traffic).
- Heap snapshot pointed at **"a `Map` inside our rate-limiter middleware accumulating entries that
  never get evicted."** A TTL cleanup interval **"only slows the growth, doesn't stop it"** — client
  IPs are unique enough that the map grows faster than the interval can evict.
- **Fix:** replace the raw `Map` with an **LRU cache with a hard size cap** (`lru-cache`
  `{ max, ttl }`), and move the authoritative counter to Redis for cross-instance consistency.

That is exactly the "unbounded cache" pattern from `16-memory-leak-cache`, in the wild.

## The scenario we built

```
17-ratelimiter-leak/
├── server.ts    # the service: per-client-IP rate limiter (MODE=leaky | bounded) + /metrics
├── load.mjs     # autocannon load generator — a UNIQUE client IP per request
├── monitor.ts   # polls /metrics every second; prints the memory + cache trend
└── README.md
```

- **`server.ts`** keys a rate-limit bucket by client IP (`X-Forwarded-For`, as behind a proxy).
  `MODE=leaky` uses a module-level `Map` that is **never evicted**; `MODE=bounded` caps entries
  (`MAX`) with a TTL + recency eviction (a tiny LRU). It also exposes **`GET /metrics`**
  (`process.memoryUsage()` + cache size + `used/total`) and logs memory every 2 s.
- **`load.mjs`** drives load with **autocannon** and gives **every request a fresh client IP**
  (`10.a.b.c`), so the key cardinality explodes — the incident's exact trigger.
- **`monitor.ts`** is the monitoring tool: it polls `/metrics` and prints the trend you'd alert on.

## Run it

Three terminals (or background them):

```sh
# 1) the service
MODE=leaky node server.ts            # leaky (default); or MODE=bounded node server.ts

# 2) the load (unique IP per request)
DURATION=20 CONNECTIONS=200 node load.mjs

# 3) the monitoring tool
node monitor.ts
```

## Real output (Node v24, this machine)

**Leaky** — cache and heap climb monotonically; they never come back down:

```
rate-limiter service  MODE=leaky  http://localhost:3210
[monitor]   2s heapUsed=18.1MB rss=110.5MB used/total=57% cache=13810
[monitor]   4s heapUsed=28.1MB rss=135.3MB used/total=48% cache=95673
[monitor]   6s heapUsed=44.5MB rss=168.9MB used/total=47% cache=176981
[monitor]   8s heapUsed=43.2MB rss=176.0MB used/total=42% cache=258012
[monitor]  10s heapUsed=93.9MB rss=248.6MB used/total=50% cache=337461
[monitor]  12s heapUsed=64.9MB rss=255.7MB used/total=34% cache=414515
[monitor]  14s heapUsed=115.8MB rss=259.7MB used/total=59% cache=466519
[monitor]  16s heapUsed=116.8MB rss=246.4MB used/total=58% cache=518512
[monitor]  18s heapUsed=120.9MB rss=263.1MB used/total=55% cache=599966
[monitor]  20s heapUsed=109.9MB rss=270.2MB used/total=49% cache=679694
[monitor]  22s heapUsed=119.9MB rss=274.2MB used/total=52% cache=725523
726k requests in 20.07s
```

The `monitor.ts` tool, watching the same run:

```
   1.1s  mode=leaky   heapUsed=   10.9 MB rss=   79.4 MB used/total= 73% cache=0
   3.1s  mode=leaky   heapUsed=   19.0 MB rss=  110.4 MB used/total= 59% cache=29988
   5.1s  mode=leaky   heapUsed=   32.9 MB rss=  132.8 MB used/total= 57% cache=105599
   7.1s  mode=leaky   heapUsed=   37.2 MB rss=  143.7 MB used/total= 55% cache=176148
   9.1s  mode=leaky   heapUsed=   56.3 MB rss=  177.0 MB used/total= 53% cache=257762
```

**Bounded** (the fix) — cache caps at `MAX`, heap plateaus, RSS stops climbing:

```
rate-limiter service  MODE=bounded  http://localhost:3211
[monitor]   2s heapUsed=14.7MB rss=101.6MB used/total=65% cache=6677
[monitor]   4s heapUsed=22.4MB rss=114.1MB used/total=67% cache=10000
[monitor]   6s heapUsed=25.5MB rss=131.1MB used/total=49% cache=10000
[monitor]  10s heapUsed=25.4MB rss=132.5MB used/total=49% cache=10000
[monitor]  14s heapUsed=37.2MB rss=155.3MB used/total=47% cache=10000
[monitor]  20s heapUsed=30.7MB rss=138.7MB used/total=38% cache=10000
[monitor]  22s heapUsed=23.3MB rss=139.0MB used/total=29% cache=10000
536k requests in 20.05s
```

Same load, same duration: **cache 725k → capped at 10k**, and the heap trend goes from
**climbing** to **flat/oscillating** (the oscillation is just natural GC; no forced GC here).

## What the monitoring shows (and what you'd alert on)

- **`cache`** — the direct signal: a monotonic rise in key count = unbounded cache.
- **`heapUsed` trend** — climbing floor = live-set leak (`used/total` stays elevated).
- **`rss`** — climbs and, even after the cache is capped, **doesn't shrink** (V8 keeps pages —
  see `../15-v8-memory/rss.md`).
- Alert on the **trend/slope** of `heapUsed` and `cache`, not absolute values.

## The fix

```js
import { LRUCache } from "lru-cache";
const rateLimiter = new LRUCache({ max: 100_000, ttl: 60_000, ttlAutopurge: false });
```

- **Bound it:** `lru-cache` `{ max, ttl }` (as in `server.ts` `MODE=bounded`).
- **Don't rely on a TTL sweep interval** — the incident shows it loses the race against cardinality.
- **Cross-instance:** keep the authoritative counter in Redis (the incident's second fix); a
  per-process map also lets a client bypass the limit by hitting different instances.
- **Root cause:** cardinality you don't control (client IPs) + a cache with no eviction policy.

## Deeper diagnosis (clinic + `--inspect`)

- `npx clinic doctor -- node server.ts` — flags event-loop/GC/memory issues.
- `npx clinic heapprofiler -- node server.ts` — allocation hotspots.
- `node --inspect server.ts` → Chrome DevTools → **Memory → heap snapshots**, diff two snapshots,
  follow the **retainer path** to the rate-limiter `Map`.

## References

- GitHub community discussion #196856 (the verified incident):
  <https://github.com/orgs/community/discussions/196856>
- `lru-cache` — <https://github.com/isaacs/node-lru-cache>
- `autocannon` — <https://github.com/mcollina/autocannon>
- `clinic` — <https://github.com/clinicjs/node-clinic>
- Minimal pattern + more cases: [`../16-memory-leak-cache`](../16-memory-leak-cache)
- RSS / heap semantics: [`../15-v8-memory`](../15-v8-memory)
