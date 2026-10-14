# The Node.js Memory Leak That Only Shows Up in Production (and How to Reproduce It Locally)

*A real rate-limiter incident — 180 MB to 2 GB in eight hours — reproduced on a laptop. Why high RSS is not a leak, why request **cardinality** (not traffic) is the trigger, and the few lines that actually fix it.*

---

## The bug report every Node team eventually gets

There is a class of incident that shows up in almost every long-running Node.js service:

> "The service leaks memory. It climbs until the container gets OOM-killed and restarts. It's fine in staging. It only happens in production, after a few hours."

It is maddening precisely because it's invisible locally. Your machine handles the traffic fine, the heap graph looks flat, and then a customer reports a crash at 3 AM.

I found a real, documented instance of exactly this and reproduced it end to end. It's the **GitHub community discussion #196856**, and the details are almost too on-the-nose:

- A Node.js 20 microservice processing a high-volume event stream (**~5,000 events/sec**), running Fastify 4 on **AWS ECS with a 2 GB memory limit**.
- The heap climbed from **~180 MB to 2 GB over 6–8 hours**, then crashed.
- It was **not reproducible in staging**, because staging had lower traffic.
- A heap snapshot pointed at *"a `Map` inside our rate-limiter middleware accumulating entries that never get evicted."*
- A TTL cleanup interval *"only slows the growth, doesn't stop it."*
- **The fix:** replace the raw `Map` with an LRU cache with a hard size cap (`lru-cache` with `{ max, ttl }`), and move the authoritative counter to Redis.

That's a single, boring data structure — a `Map` — taking down a service. Let's reproduce it, understand why staging missed it, and see the fix with real numbers.

---

## First, fix the diagnosis: high RSS is not a leak

Before hunting a leak, you have to be able to tell a leak from **normal V8 behavior**. This is where most teams go wrong.

Matteo Collina's talk *"Node.js will use all the memory available, and that's OK!"* (dotJS 2025) nails the misconception. The question he gets most often is:

> "My application is crashing — it has a memory leak."

Followed by:

> "Do you get an out-of-memory error? Does it crash badly?" — *"Oh, no. Absolutely not. It reaches a certain level of memory consumption and then **we kill it**."*

**If you stop killing it, it probably won't crash.** V8 deliberately holds on to memory it has taken from the OS. When it frees objects, it doesn't hand the pages back — it keeps them, because *"this has happened before and it will happen again."* Returning memory to the kernel is expensive, and it expects to allocate again.

You can see this in one run. Allocate a lot, drop it all, force a GC:

```
start                      rss=  67.6 MB heapUsed=   7.1 MB heapTotal=  8.7 MB used/total= 82.3%
after retaining chunks     rss= 232.1 MB heapUsed= 119.3 MB heapTotal=215.0 MB used/total= 55.5%
after drop + gc()          rss= 227.7 MB heapUsed=   7.2 MB heapTotal=137.9 MB used/total=  5.2%
```

Look at the last line: **`heapUsed` collapsed from 119 MB to 7 MB, `used/total` dropped to 5.2%, and RSS stayed at ~228 MB.** That is not a leak. That is V8 keeping a reserved, reusable heap.

So the rule is:

- **`heapUsed` / `heapTotal`** tells you how much of the reserved heap is actually *live*.
- **`rss`** is just the blob of physical RAM the process is holding.
- A **leak** is when the **post-GC `heapUsed` floor keeps climbing** and never comes back down.
- **Don't kill a process for high RSS.** It climbs right back, and you've thrown away a healthy process.

With that lens, a real leak looks very specific: a line that goes up and to the right, and stays there.

---

## The pattern: a cache with no eviction policy

The single most common Node.js memory leak is a **module-level cache that grows and never evicts**.

```js
const cache = new Map();

function handleRequest(id) {
  if (!cache.has(id)) cache.set(id, makeRecord(id)); // added
  return cache.get(id);                              // ...and never removed
}
```

A module-level collection is **reachable for the life of the process**. Every entry it holds is live and can never be collected — no matter how long ago it was used. If the keys are unbounded (unique users, sessions, or in our case **client IPs**), the `heapUsed` floor climbs forever.

This isn't a hypothetical. It's literally the default in `express-session`:

> "The default server-side session storage, `MemoryStore`, is purposely not designed for a production environment. **It will leak memory under most conditions**..."
> — the Express docs, in bold

The bug is never *"caching is bad."* It's **"caching with no eviction policy."**

### A minimal reproduction (zero dependencies)

Before building the full service, reproduce the shape of the bug in ~30 lines. Here's the core of the [minimal example](https://github.com/labeebahmad201/nodejs-playground/tree/main/nodejs/16-memory-leak-cache):

```js
// ~8 KB of numbers stands in for a "session"/"user" record the cache holds.
function makeRecord(id) {
  return { id, data: new Array(1024).fill(id) };
}

// ❌ Leaky: module-level Map, keyed by a unique id, NEVER evicted.
const leaky = new Map();
function handleLeaky(id) {
  if (!leaky.has(id)) leaky.set(id, makeRecord(id));
  return leaky.get(id);
}

// ✅ Bounded: hard size cap + evict the oldest (real apps use lru-cache).
const bounded = new Map();
const MAX = 1000;
function handleBounded(id) {
  if (!bounded.has(id)) {
    if (bounded.size >= MAX) bounded.delete(bounded.keys().next().value);
    bounded.set(id, makeRecord(id));
  }
  return bounded.get(id);
}
```

Run 60,000 unique keys through each, in a **natural** setting — no forced GC, V8 collects on its own, exactly as in production:

```
mode=leaky  (no forced GC — V8 collects on its own)
start            rss=   69.1 MB heapUsed=    7.7 MB used/total= 86.1%
after 10,000     rss=  196.6 MB heapUsed=   87.4 MB used/total= 57.3%
after 20,000     rss=  280.2 MB heapUsed=  166.5 MB used/total= 70.8%
after 30,000     rss=  362.8 MB heapUsed=  245.5 MB used/total= 77.7%
after 40,000     rss=  447.2 MB heapUsed=  326.2 MB used/total= 82.0%
after 50,000     rss=  529.8 MB heapUsed=  405.2 MB used/total= 84.6%
after 60,000     rss=  612.4 MB heapUsed=  484.1 MB used/total= 86.6%
```

```
mode=bounded  (no forced GC — V8 collects on its own)
start            rss=   68.9 MB heapUsed=    7.7 MB used/total= 86.1%
after 10,000     rss=  195.8 MB heapUsed=   86.7 MB used/total= 57.1%
after 20,000     rss=  218.7 MB heapUsed=   75.0 MB used/total= 53.0%
after 30,000     rss=  218.8 MB heapUsed=   68.5 MB used/total= 50.8%
after 40,000     rss=  218.8 MB heapUsed=   59.8 MB used/total= 47.5%
after 50,000     rss=  218.8 MB heapUsed=   54.5 MB used/total= 45.2%
after 60,000     rss=  218.8 MB heapUsed=   50.4 MB used/total= 43.3%
```

Read the two trends:

- **Leaky:** `heapUsed` rises ~80 MB per 10k keys and **never comes down**.
- **Bounded:** `heapUsed` peaks, then **plateaus and declines** (87 → 50 MB) as V8 naturally reclaims evicted entries. Only the capped 1,000 stay live.

The **trend** is the leak. Not the absolute number — the trend.

---

## The production-shaped reproduction

A minimal script proves the pattern. But the incident had a specific shape: a *running service*, real traffic, and a monitoring gap. So I built three small pieces:

```
17-ratelimiter-leak/
├── server.ts    # per-client-IP rate limiter (MODE=leaky | bounded) + GET /metrics
├── load.mjs     # autocannon load generator — a UNIQUE client IP per request
├── monitor.ts   # polls /metrics every second; prints the memory + cache trend
└── README.md
```

The service keys a rate-limit bucket by client IP (from `X-Forwarded-For`, as behind a proxy) — the exact structure from the incident:

```js
// ❌ Leaky: module-level Map keyed by client id, NEVER evicted.
const leaky = new Map();

// ✅ Bounded: hard size cap + TTL, recency-refreshed (a tiny LRU).
const bounded = new Map();

function allow(map, id, cap) {
  const now = Date.now();
  let b = map.get(id);

  if (b && now - b.windowStart > TTL_MS) {
    map.delete(id);
    b = undefined;
  }

  if (!b) {
    if (cap !== undefined && map.size >= cap) {
      map.delete(map.keys().next().value); // evict oldest
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
```

It also exposes the numbers that matter:

```js
if (req.url === "/metrics") {
  const m = process.memoryUsage();
  res.end(JSON.stringify({
    rss: m.rss,
    heapTotal: m.heapTotal,
    heapUsed: m.heapUsed,
    external: m.external,
    arrayBuffers: m.arrayBuffers,
    usedRatio: m.heapUsed / m.heapTotal,
    cacheSize: MODE === "leaky" ? leaky.size : bounded.size,
  }));
  return;
}
```

---

## The insight: it's cardinality, not traffic

Here's the part that explains why staging never caught it — and it's the most useful thing in this whole exercise.

The leak is driven by the number of **distinct client keys**, *not* request volume. Hammer the service from one IP a million times and the map holds exactly **one** entry:

```sh
# same client IP every time -> cache stays at 1 (NO leak, even after 1M requests)
for i in $(seq 5); do curl -s localhost:4100 >/dev/null; done
curl -s localhost:4100/metrics          # {"cacheSize":1,...}

# a different client IP each time -> cache grows
for i in $(seq 5); do curl -s -H "x-forwarded-for: 10.0.0.$i" localhost:4100 >/dev/null; done
curl -s localhost:4100/metrics          # {"cacheSize":6,...}
```

Staging had low traffic *and low cardinality* — a handful of test IPs. Production sat behind a proxy, so **every request looked like a new client**. The load generator reproduces this by spoofing a fresh `X-Forwarded-For` on every single request:

```js
// A fresh client IP for each request (10.a.b.c -> up to ~16M unique).
let n = 0;
instance.on("response", (client) => {
  const a = (n >> 16) & 0xff;
  const b = (n >> 8) & 0xff;
  const c = n & 0xff;
  client.setHeaders({ "x-forwarded-for": `10.${a}.${b}.${c}` });
  n += 1;
});
```

That's the trigger. It's not "lots of requests." It's **lots of *different* requests** — a cardinality problem, not a throughput problem.

---

## Watching it happen

`monitor.ts` polls `/metrics` and prints the trend you'd actually alert on. Under a 20-second load with ~726k requests, the **leaky** server:

```
[monitor]   2s heapUsed=18.1MB rss=110.5MB used/total=57% cache=13810
[monitor]   6s heapUsed=44.5MB rss=168.9MB used/total=47% cache=176981
[monitor]  10s heapUsed=93.9MB rss=248.6MB used/total=50% cache=337461
[monitor]  14s heapUsed=115.8MB rss=259.7MB used/total=59% cache=466519
[monitor]  18s heapUsed=120.9MB rss=263.1MB used/total=55% cache=599966
[monitor]  22s heapUsed=119.9MB rss=274.2MB used/total=52% cache=725523
726k requests in 20.07s
```

Cache: **13,810 → 725,523**. Heap: **18 MB → ~120 MB**, climbing. RSS: **110 MB → 274 MB**.

Same load, same duration, **bounded** server:

```
[monitor]   2s heapUsed=14.7MB rss=101.6MB used/total=65% cache=6677
[monitor]   4s heapUsed=22.4MB rss=114.1MB used/total=67% cache=10000
[monitor]   6s heapUsed=25.5MB rss=131.1MB used/total=49% cache=10000
[monitor]  14s heapUsed=37.2MB rss=155.3MB used/total=47% cache=10000
[monitor]  22s heapUsed=23.3MB rss=139.0MB used/total=29% cache=10000
536k requests in 20.05s
```

Cache: **capped at 10,000**. Heap: flat and oscillating around ~30 MB (the oscillation is just natural GC). RSS: stops climbing.

Two signals to alert on:

- **`cacheSize`** — a monotonic rise in key count is the direct signal of an unbounded cache.
- **`heapUsed` slope** — a climbing post-GC floor is a live-set leak.

Alert on the **slope**, not the absolute value. In a container, the absolute number means almost nothing — V8 will happily fill whatever you give it.

---

## The fix

Bound the cache so it *cannot* grow without limit:

```js
import { LRUCache } from "lru-cache";

const rateLimiter = new LRUCache({ max: 100_000, ttl: 60_000 });
```

Three things matter here, and the incident teaches all of them:

1. **A hard size cap, not just a TTL.** The incident's team had a cleanup interval — *"it only slows the growth, doesn't stop it."* A sweep runs on a timer; cardinality doesn't wait. A `max` cap evicts on write, so the bound holds no matter how fast keys arrive.
2. **Eviction policy, always.** If you cache something keyed by user input, the key space is unbounded by definition. `lru-cache` with `{ max, ttl }` is the de-facto standard.
3. **Cross-instance correctness.** A per-process map also lets a client bypass the limit by hitting a different instance. The incident's second fix was to move the authoritative counter to **Redis**.

The root cause, in one line: **cardinality you don't control (client IPs) + a cache with no eviction policy.**

---

## The other leak: stable heap, rising RSS

Everything above is a **JS-heap leak** — you can see it in `heapUsed`. But there's a second, sneakier category that a heap-only observer will completely miss:

**Off-heap leaks** — where `heapUsed` stays flat while **`rss` climbs**.

The usual suspects: caches of `Buffer`/`ArrayBuffer`, native addons, and unresolved async operations holding native handles. These live in **`external`** / **`arrayBuffers`** memory (V8-tracked C++ memory, mostly Buffers), not the JS heap. Here's the shape:

```js
// Off-heap leak: the heap is stable, but RSS grows forever.
const buffers = new Map(); // module-level, never evicted

function cachePayload(id, buf) {
  buffers.set(id, buf); // Buffer memory is "external", not heapUsed
}
```

Because the retention is in `external`/`arrayBuffers` (and `rss`), a dashboard that only charts `heapUsed` looks perfectly healthy — right up until the OOM killer arrives. This is why `server.ts` exposes `external` and `arrayBuffers` too.

The signatures, side by side:

| What rises | What it means |
|---|---|
| post-GC **`heapUsed`** floor | **JS-heap leak** (live objects: Maps, closures, listeners) |
| **`rss` / `external` / `arrayBuffers`** floor, flat `heapUsed` | **Off-heap leak** (Buffers, native, handles) |

A leaky repro that proves *"heap stable, RSS grows"* is the next thing on my list. It's a genuinely different debugging path, and most observability setups don't cover it.

---

## Takeaways

1. **High RSS is not a leak.** V8 reserves and keeps memory on purpose. Read the **post-GC `heapUsed` floor**, not the absolute RSS.
2. **A leak is a trend, not a number.** `heapUsed` that climbs and never comes back = leak. Alert on the slope.
3. **The classic leak is a `Map` with no eviction.** Module-level cache, unbounded keys, no `max`/`ttl`.
4. **It's usually cardinality, not traffic.** A million requests from one client is fine; a thousand requests from a thousand clients is a leak. This is exactly why staging misses it.
5. **Fix it with a bound.** `lru-cache` `{ max, ttl }`, a `WeakMap`, or no global cache at all. A TTL sweep alone loses the race.
6. **Watch `external`/`arrayBuffers`, too.** Off-heap leaks keep the heap flat while RSS climbs.

---

## Reproduce it yourself

All of this — the minimal pattern, the production-shaped service, the load generator, and the monitor — is in the repo:

**https://github.com/labeebahmad201/nodejs-playground** (`nodejs/16-memory-leak-cache`, `nodejs/17-ratelimiter-leak`)

```sh
git clone https://github.com/labeebahmad201/nodejs-playground
cd nodejs-playground/nodejs/17-ratelimiter-leak

# terminal 1 — the service
MODE=leaky node server.ts        # or MODE=bounded

# terminal 2 — load with a unique client IP per request
DURATION=20 CONNECTIONS=200 node load.mjs

# terminal 3 — watch the memory + cache trend
node monitor.ts
```

For deeper diagnosis, `clinic` (`npx clinic doctor -- node server.ts`, `npx clinic heapprofiler`) and `node --inspect` → Chrome DevTools → **Memory → heap snapshots** (diff two, follow the retainer path to the offending `Map`) are the tools to reach for.

If you've chased one of these in production, I'd love to hear what the culprit was — leave it in the responses.

*The incident reproduced here is GitHub community discussion #196856; the memory model draws on Matteo Collina's dotJS 2025 talk "Node.js will use all the memory available, and that's OK!" and the V8 team's writing on the Orinoco garbage collector.*
