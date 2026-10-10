# 16. Memory leak: unbounded cache (the #1 pattern)

The single most common Node.js memory leak: **a module-level cache / `Map` that grows and never
evicts.** You add a cache for speed, forget a size cap or TTL, and it grows forever — one entry
per unique user / session / request id.

This directory reproduces it (dependency-free) and shows the fix, and cites the real-world
instances it's modeled on.

## Real, documented instances

- **`express-session`'s default `MemoryStore`** — the Express docs warn in bold:
  > "The default server-side session storage, `MemoryStore`, is purposely not designed for a
  > production environment. **It will leak memory under most conditions**, does not scale past
  > a single process, and is meant for debugging and developing."
  > — <https://expressjs.com/en/resources/middleware/session/>

  Confirmed by users hitting the runtime warning: *"Warning: connect.session() MemoryStore is
  not designed for a production environment, as it will leak memory…"* —
  <https://github.com/expressjs/session/issues/556>. The community fix is a bounded store
  (`memorystore`, built on `lru-cache`): <https://github.com/roccomuso/memorystore>.

- **Node.js core, `nodejs/node#59733`** — *"Significant heap usage regression in Node 22.19.0"*.
  A new **`package.json`-metadata cache** ballooned heap: *"a map from any module file path to
  deserialized `package.json` metadata. This duplicates cache data when multiple module files
  share the same parent `package.json` file"* — a degenerate case with packages like `date-fns`.
  <https://github.com/nodejs/node/issues/59733>

- **A real production service** (GitHub community discussion) — heap climbing after 6–8 hours
  at ~5k events/sec; fixed by replacing the raw `Map` with an LRU cache: *"ditch the `Map`
  entirely and use an LRU cache with a hard size cap… the heap flatlined immediately."* —
  <https://github.com/orgs/community/discussions/196856>

## Why it leaks

A module-level collection is **reachable for the lifetime of the process**, so every entry it
holds is live and can never be collected — no matter how long ago it was used:

```
handleRequest(id):
    if (!cache.has(id)) cache.set(id, makeRecord(id))   // entry added
    return cache.get(id)                                 // …and NEVER removed
```

Under real traffic the keys are effectively unbounded (unique users/sessions/request ids), so
`heapUsed`'s **post-GC floor climbs forever** — the leak signature.

## Reproduce it

`16-memory-leak-cache/index.ts` runs a workload of 60,000 unique keys (≈8 KB per record) in a
**natural** setting — **no forced GC**; V8 collects on its own, as in production. Run each mode:

```sh
node index.ts leaky      # the leak
node index.ts bounded    # the fix
```

**Leaky** — `heapUsed` climbs linearly and never plateaus:

```
mode=leaky  (no forced GC — V8 collects on its own)
start            rss=   69.1 MB heapUsed=    7.7 MB heapTotal=    8.9 MB used/total= 86.1%
after 10,000     rss=  196.6 MB heapUsed=   87.4 MB heapTotal=  152.4 MB used/total= 57.3%
after 20,000     rss=  280.2 MB heapUsed=  166.5 MB heapTotal=  235.0 MB used/total= 70.8%
after 30,000     rss=  362.8 MB heapUsed=  245.5 MB heapTotal=  315.8 MB used/total= 77.7%
after 40,000     rss=  447.2 MB heapUsed=  326.2 MB heapTotal=  398.0 MB used/total= 82.0%
after 50,000     rss=  529.8 MB heapUsed=  405.2 MB heapTotal=  478.8 MB used/total= 84.6%
after 60,000     rss=  612.4 MB heapUsed=  484.1 MB heapTotal=  559.3 MB used/total= 86.6%

retained entries = 60000
```

**Bounded** — `heapUsed` rises, then **plateaus** as V8 reclaims evicted entries on its own:

```
mode=bounded  (no forced GC — V8 collects on its own)
start            rss=   68.9 MB heapUsed=    7.7 MB heapTotal=    8.9 MB used/total= 86.1%
after 10,000     rss=  195.8 MB heapUsed=   86.7 MB heapTotal=  151.9 MB used/total= 57.1%
after 20,000     rss=  218.7 MB heapUsed=   75.0 MB heapTotal=  141.4 MB used/total= 53.0%
after 30,000     rss=  218.8 MB heapUsed=   68.5 MB heapTotal=  134.9 MB used/total= 50.8%
after 40,000     rss=  218.8 MB heapUsed=   59.8 MB heapTotal=  125.9 MB used/total= 47.5%
after 50,000     rss=  218.8 MB heapUsed=   54.5 MB heapTotal=  120.7 MB used/total= 45.2%
after 60,000     rss=  218.8 MB heapUsed=   50.4 MB heapTotal=  116.4 MB used/total= 43.3%

retained entries = 1000
```

Read it:

- **Leaky:** `heapUsed` rises ~80 MB per 10k keys and **never comes down** — each record is
  reachable for the life of the process, so no GC can free it. The **trend is the leak.**
- **Bounded:** `heapUsed` rises to a peak, then **plateaus and declines** (87 → 50 MB) as V8
  naturally collects evicted entries. Only the capped 1,000 stay live.
- `rss` tells the same story: 69 → 612 MB (leaky) vs a plateau at ~219 MB (bounded). And RSS
  doesn't shrink in the bounded run — V8 keeps pages (see [`../15-v8-memory/rss.md`](../15-v8-memory/rss.md)).

> Without a forced GC the `used/total` ratio is noisier (it includes uncollected garbage), so
> read the **`heapUsed` trend** here: a floor that keeps climbing = leak; one that plateaus =
> healthy. For clean post-GC numbers, see [`../15-v8-memory`](../15-v8-memory).

## The fix

Bound the cache so it *cannot* grow without limit. In order of preference:

1. **`lru-cache` with `max` + `ttl`** (the de-facto standard):
   ```js
   import { LRUCache } from "lru-cache";
   const cache = new LRUCache({ max: 5_000, ttl: 1000 * 60 * 5 });
   ```
2. **`WeakMap` / `WeakRef`** when keys are objects and you *don't* need to keep them alive —
   entries vanish when the key is collected.
3. **No global cache at all** — scope it per request, or don't memoize unbounded input.

The bug is never "cache is bad"; it's **"cache with no eviction policy."**

## Detection

- Watch the **post-GC `heapUsed` floor** trend — a rising floor = a live-set leak.
- Take a **heap snapshot** (`node --inspect` → Chrome DevTools → Memory) and diff two snapshots;
  look for an object type whose count grew, then follow the **retainer path** back to the
  module-level `Map`.
- Metrics per process: `heapUsed`/`heapTotal` + `rss` (`15-v8-memory`, `ROADMAP.md`).

## References

- Express session middleware docs (MemoryStore warning):
  <https://expressjs.com/en/resources/middleware/session/>
- `expressjs/session` issue #556 (the warning in the wild):
  <https://github.com/expressjs/session/issues/556>
- `roccomuso/memorystore` — the leak-free bounded MemoryStore:
  <https://github.com/roccomuso/memorystore>
- `nodejs/node` issue #59733 — package.json-metadata cache heap regression:
  <https://github.com/nodejs/node/issues/59733>
- GitHub community discussion #196856 — production service fixed with an LRU cache:
  <https://github.com/orgs/community/discussions/196856>
- `lru-cache` — <https://github.com/isaacs/node-lru-cache>
