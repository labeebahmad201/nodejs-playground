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

`16-memory-leak-cache/index.ts` simulates 20,000 unique keys (≈8 KB per record) through a
**leaky** cache and a **bounded** cache, forcing a GC between runs:

```sh
node --expose-gc index.ts
```

Output (Node v24):

```
start                    rss=   67.5 MB heapUsed=    7.1 MB heapTotal=    8.7 MB
leaky: 20000 unique keys rss=  253.9 MB heapUsed=  166.0 MB heapTotal=  234.3 MB
leaky: post-GC           rss=  253.9 MB heapUsed=  166.0 MB heapTotal=  234.3 MB
after clear + GC         rss=  253.0 MB heapUsed=    7.2 MB heapTotal=   73.4 MB
bounded: 20000 unique keys rss=  288.2 MB heapUsed=   90.5 MB heapTotal=  220.7 MB
bounded: post-GC         rss=  288.2 MB heapUsed=   15.2 MB heapTotal=  145.7 MB

retained entries — leaky=0  bounded=1000
```

Read it:

- **Leaky post-GC `heapUsed` = 166 MB and does not drop** — every record is still reachable, so
  the GC can't free any of it. That's the leak.
- **`after clear + GC` → 7.2 MB** — proving those 166 MB *were* the cache. (And `rss` stayed at
  253 MB: V8 keeps the pages — see [`../15-v8-memory/rss.md`](../15-v8-memory/rss.md).)
- **Bounded post-GC = 15 MB** — only the capped 1,000 entries survive. The mid-run 90 MB is just
  uncollected garbage from evictions, gone after GC.

> Note: both caches are kept **reachable** at the end (a real module-level cache would be). If
> nothing read them after the GC, V8's liveness analysis would collect them regardless — the
> "dead variable is not a live root" gotcha from `15-v8-memory`.

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
