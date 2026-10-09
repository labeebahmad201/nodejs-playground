# 15. V8 memory & GC — "Node.js will use all the memory available, and that's OK!"

Notes from **Matteo Collina, "Node.js will use all the memory available, and that's OK!"**,
dotJS 2025, Paris (Folies Bergère), recorded 3 Apr 2025 — <https://www.youtube.com/watch?v=_OnTUIYxGRs>.
This directory is a *summary of the talk* plus a small local reproduction of its central
claim. The benchmark numbers quoted below are the talk's, not ours (we couldn't run Watt).

## The complaint vs the reality

The question Collina says he gets most often:

> "My application is crashing — it has a memory leak."

Then the follow-up questions:

> "Do you get an out-of-memory error? Does it crash badly?" — "Oh, no. Absolutely not. It
> reaches a certain level of memory consumption and then **we kill it**."

**If you stop killing it, it probably won't crash.** Node taking memory and *holding* it is
**normal and expected** — the title of the talk. The whole talk explains why, and what to do
instead.

## What a memory leak actually is

> A memory leak is a situation in which memory that is no longer needed is **not being
> released**, typically because nothing can reach it anymore and it lingers.

These are hard to find. Collina's example: a real leak in `node-fetch` — **months to track
down, one hour to fix**. Real leaks are elusive; "my RSS is high" is not the same thing.

## V8's garbage collector, in one picture

The theory behind every GC (the **generational hypothesis**): **"all objects die young."**
In a web app, a request creates objects, uses them, and throws them away — so most memory is
garbage almost immediately.

V8 splits the heap into generations:

```
                    young generation ("new space")          old generation ("old space")
                    ┌───────────────┬───────────────┐        ┌───────────────────────────┐
   allocate  ─────▶ │  from-space   │   to-space    │  ────▶ │   long-lived objects      │
                    │  (live objs)  │   (empty)     │ promote│   mark-sweep / mark-compact│
                    └───────────────┴───────────────┘        └───────────────────────────┘
                       scavenger: copy survivors, then swap        slower, runs to reclaim
```

- **New space / scavenger** — new objects land in *from-space*. When it fills, the
  **scavenger** copies the *survivors* into *to-space*, then the two halves are **swapped**.
  This is fast (copy the few live objects, drop everything else).
- **Promotion** — objects that keep surviving are **promoted into old space** (the talk
  describes survivors of two collections being moved up).
- **Old space / mark-sweep** — when old space fills, V8 **marks** unused objects and
  **sweeps/compacts** them. This is much slower.
- **It's concurrent.** Marking and sweeping run largely on **background/helper threads** —
  "all parallel", invisible while your app runs.

> The full mechanics — new space vs old space, the scavenger's copy-then-swap, and exactly
> when objects are promoted — are in [`gc.md`](./gc.md), backed by V8's own blog posts.

## Why RSS doesn't come back down

The crucial detail: **V8 only returns memory to the OS on compaction** (and even then,
conservatively). Until a compact happens, the pages it reserved stay mapped — so the
**RSS stays high** even after objects are freed. V8 is hoarding because *"this has happened
before and it will happen again"* — it expects to allocate again, and returning memory to the
OS is expensive.

You can see this locally (below): after freeing everything, `heapUsed` collapses from
**119 MB → 7 MB** while `rss` stays at **~228 MB**. That gap is *normal*, not a leak.

> Precise model of the number itself — resident vs swapped vs dropped — in
> [`rss.md`](./rss.md).

## What to actually monitor

Two numbers together, not one:

| Metric | Meaning |
|---|---|
| **`heapUsed / heapTotal`** | how much of the heap V8 has reserved is actually live |
| **`rss`** | the blob of memory V8 has taken from the OS |

A high `rss` with a healthy `heapUsed/heapTotal` ratio is a *reserved* heap, not a leak. A
leak shows as `heapUsed` climbing and **never coming back down** after GC. (See `ROADMAP.md`
→ "Per-process metrics to track".)

## What `heapTotal` is, and why it rises

**`heapTotal` = the total size of the V8 managed heap that V8 has *committed* (reserved)** —
the capacity of the container, in bytes, summed across all heap spaces (new + old + others).
It is **always ≥ `heapUsed`**. Think: `heapUsed` = how much is in the warehouse; `heapTotal` =
how big the warehouse is. V8 grows the warehouse so it doesn't have to keep expanding mid-work.

Why it rises:

1. **You allocate live objects** — V8 must grow the heap to hold them. In our run, retaining
   200k arrays pushed `heapTotal` from **8.7 → 215 MB** to hold the ~119 MB live set.
2. **V8's heap-growing strategy deliberately over-grows.** V8 sets the next GC point from the
   live size **plus slack**:
   > "At the end of a full garbage collection, V8's heap growing strategy determines when the
   > next garbage collection will happen based on **the amount of live objects with some
   > additional slack**." — <https://v8.dev/blog/optimizing-v8-memory>

   That headroom is why `heapTotal` sits *above* `heapUsed`, and why GC runs less often.
3. **It grows in steps** — V8 commits heap in pages/chunks; as pages fill and survivors get
   promoted to old space, it commits more (the staircase in the snapshots).
4. **Fragmentation** — scattered dead objects leave gaps; V8 may commit new pages instead of
   reusing the holes (until compaction).

Why it **doesn't** fall back down: after the objects die, `heapTotal` does **not** return to
8.7 — it fell only 215 → 138 MB and stayed there with a 7 MB live set. V8 **keeps capacity to
reuse** (handing memory back is expensive, and it expects to allocate again — the talk's
point), and it only shrinks on **compaction** or its own heuristic, not the instant objects die.
The gap `heapTotal − heapUsed` at the end (~131 MB) is **slack + free space** held on purpose.

How to read it:

| `heapTotal` | `heapUsed` | Meaning |
|---|---|---|
| rising | rising | genuinely growing live data (normal under load, or a leak) |
| rising | **flat** | V8 **reserving headroom** (slack) or fragmentation — *not* a leak |
| flat | rising | live data growing inside existing capacity → GC pressure |

The cap: `heapTotal` can't grow forever — it's bounded by `--max-old-space-size` (old space)
plus the young generation. When it **hits that ceiling and still can't free enough**, you get
**out-of-memory**. So `heapTotal` climbing toward your limit with `heapUsed` flat is the signal
to reduce retention or raise the limit — *before* the OOM.

## Takeaway 1 — don't kill it at 80%

> **"Don't kill Node.js if it reaches 80% of available memory. It's 100% normal. It will
> take all the memory that it can."**

Killing/restarting on an RSS threshold is a common ops mistake: it throws away a healthy
process that was simply holding reusable memory. Watch the *trend of live heap*, not the
absolute RSS number.

## Why allocation size matters (the request pattern)

For each request, the ideal is that **all of its allocations are collected by the scavenger**
(young generation) and nothing is promoted to old space:

```
request → parse headers/body → build query → [await DB] → process/SSR → response
             (sync allocations)              (async gap)     (sync allocations)
```

The more a single request allocates, the higher the chance some of it **spills into old
space**, where it is only reclaimed by the slow mark-sweep. Under **concurrency**, multiply
by the number of in-flight requests.

The talk's example: **React server-side rendering allocates ~5–20 MB per render** (every
`div` is an object), so concurrent SSR requests allocate a lot at once.

## Takeaway 2 — tune the heap (trade memory for compute)

The heap sizes are **configurable**, and you *should* tune them in production:

```sh
node --max-semi-space-size=64 app.js   # one semi-space = 64 MB → young gen ≈ 192 MB (3×)
node --max-old-space-size=4096 app.js  # old generation ceiling
```

- `--max-semi-space-size` sets **one semi-space**. The young generation is **three times** a
  semi-space by default: the scavenger uses **two** semi-spaces (from-space/to-space) **plus**
  a new large-object space sized proportionally. Node docs: *"the young generation size of the
  V8 heap is three times … the size of the semi-space"*; V8's
  `YoungGenerationSizeFromSemiSpaceSize` is `semi_space_size * (2 + 1)`. So `=64` gives a
  **~192 MB** young generation, not 64 MB. (With `--minor-ms` the factor is 2×.)
- A bigger young generation means **more allocations are collected cheaply** and **less is
  promoted to old space**, giving a healthier (shorter/thinner) GC cycle.
- **Node 20 → Node 22 change:** V8 changed how it computes the default semi-space size —
  it now derives it from **available memory**. In a small container (say 500 MB) that can
  leave the semi-space at **~1 MiB** (young generation ~3 MiB), which performs badly. **Set it
  explicitly.**

The trade: **spend some memory to buy compute/latency**. Collina calls this "usually a very
good tradeoff."

## The demo and the numbers

Collina runs a Next.js SSR app under **Watt** (Platformatic's multi-threaded Node application
server) and watches it with **Watt Admin** (live heap/CPU/event-loop metrics from the main
thread). Defaults looked like: **new space ~1.74 MB**, **old space ~29 MB**. Bombarding it
with `autocannon` showed a tiny, jittery new space and CPU/ELU pegged.

After setting the semi-spaces to **64 MB each** and re-running:

- the process RSS **grew** (expected — more reserved heap),
- the new space **grew a lot**, **less was promoted to old space**, and the GC cycle became
  **thinner/healthier**,
- **P99 latency** (baseline **106 ms**) dropped by **~8–10%**,
- **throughput** rose by **~10%**.

One configuration line, ~10% latency and ~10% throughput — "seems free."

## Reproduce it locally

`15-v8-memory/index.ts` allocates 200k chunks, retains them, then drops them and forces a GC.
Run it three ways to see `heapTotal` respond to the flag and `rss` refuse to shrink:

```sh
node --expose-gc index.ts
node --max-semi-space-size=64 --expose-gc index.ts
node --max-semi-space-size=1  --expose-gc index.ts
```

Default output:

```
start                      rss=   67.6 MB heapTotal=    8.7 MB heapUsed=    7.1 MB used/total= 82.3% external=    9.5 MB
after 0 chunks             rss=   75.1 MB heapTotal=    8.7 MB heapUsed=    7.7 MB used/total= 88.3% external=    9.8 MB
after 50,000 chunks        rss=  127.0 MB heapTotal=   87.6 MB heapUsed=   34.9 MB used/total= 39.9% external=    7.4 MB
after 100,000 chunks       rss=  174.2 MB heapTotal=  160.5 MB heapUsed=   62.5 MB used/total= 39.0% external=    7.4 MB
after 150,000 chunks       rss=  202.8 MB heapTotal=  186.3 MB heapUsed=   90.6 MB used/total= 48.7% external=    7.4 MB
after retaining chunks     rss=  232.1 MB heapTotal=  215.0 MB heapUsed=  119.3 MB used/total= 55.5% external=    7.4 MB
after drop + gc()          rss=  227.7 MB heapTotal=  137.9 MB heapUsed=    7.2 MB used/total=  5.2% external=    7.4 MB
```

The punchline is the last line: **`heapUsed` fell 119 MB → 7 MB and `used/total` collapsed to
5.2%, while `rss` stayed at ~228 MB.** That is V8 keeping memory it expects to reuse — *not* a
leak. (`heapTotal` also shrinks much more with `--max-semi-space-size=1`: ~12 MB vs ~138 MB,
showing what V8 reserves is tunable.)

## Liveness gotcha: a dead variable is not a live root

If you comment out `retained.length = 0` (the drop) in `index.ts`, the post-GC `heapUsed`
**still falls**. That's not a bug — it's liveness. **Lexical scope ≠ liveness:** an object is
live only if it is *reachable from a root the program can still observe*. A local variable
that is never read again after some point is **dead** there, so it stops being a GC root.

In `index.ts`, the only thing that touches `retained` after the loop is the drop line. Remove
it and nothing references `retained` again → it's dead → the scavenger/major GC reclaims it
regardless. (So the "drop" was redundant *in outcome* — the variable had already gone dead.)

The deciding factor is liveness **at the moment GC runs**:

| Variant | After `gc()` | Why |
|---|---|---|
| never touch `retained` again | **freed** (~4 MB) | the binding is dead after the loop → not a root |
| `console.log(retained.length)` **after** `gc()` | **kept** (~112 MB) | the future read forces it live across the call |
| `globalThis.retained = retained` | **kept** (~112 MB) | reachable from a real root (the global object) |

A read *before* `gc()` with nothing after would still leave it dead at collection time — it's
not "did I ever touch it", it's "is it still needed when GC runs".

**Why this matters beyond the demo:** it's why micro-benchmarks lie. The JIT/GC can eliminate
allocations whose results are never observed, so a benchmark can "use less memory" or "run
faster" than real code. To keep objects alive deterministically, make them observable — read
the value after the GC point, or store it on `globalThis`.

## Lessons learned

The causal chain, end to end:

```
many objects per request  →  nursery (new space) fills  →  scavenge runs
      →  the scavenge is STOP-THE-WORLD  →  the main thread / event loop is PAUSED
      →  in-flight requests wait, responses are delayed  →  latency spike
```

1. **The signal is live data, not total memory.** Read `heapUsed`/`heapTotal` (post-GC) and
   the `rss` *trend*. High RSS with a flat live floor is hoarding, not a leak.

2. **The nursery is a budget for cheap garbage.** New space absorbs the per-request objects
   that die young. If it's too small, it fills fast.

3. **GC pauses the event loop.** The scavenger is **parallel but stop-the-world** — helper
   threads do the copying, but **JavaScript does not run on the main thread** during it. A
   major GC is mostly concurrent (marking/sweeping in the background) but still pauses the main
   thread for marking finalization + compaction.
   > "Parallel … is still a 'stop-the-world' approach" — *Trash talk*, <https://v8.dev/blog/trash-talk>

4. **What slows down = the main thread / event loop.** While a collection is paused, no
   handler runs: in-flight requests wait, responses are delayed, timers/I-O callbacks are late.
   That *is* the latency spike.

5. **Small nursery → frequent scavenges → cumulative pause time.** Each scavenge is cheap, but
   happening constantly they add up to visible p99 latency and lower throughput. A small
   nursery also forces more promotion to old space → more major GCs → longer pauses.

6. **Allocation rate drives minor GC; retention drives major GC.**
   - Many *short-lived* objects per request → nursery fills → frequent scavenges.
   - Objects you **keep alive** (across `await`, caches, closures, module state) → survive →
     promoted to old space → major GC / growth. (Pure garbage doesn't "pile up"; retention does.)

7. **The fix has two layers:**
   - **Root fix (code):** allocate less and **retain less** per request. Short-lived garbage is
     cheap; retention is what hurts.
   - **Mitigation (config):** raise `--max-semi-space-size` so the nursery fills less often →
     fewer scavenges + less promotion → lower latency. Cost: more RSS (the talk: ~10% latency,
     ~10% throughput).

8. **Measure before tuning.** Watch post-GC `heapUsed`, `heapUsed/heapTotal`, `rss`, GC pause
   time (`PerformanceObserver` GC entries), and event-loop lag; then benchmark
   `--max-semi-space-size` values (16/32/64/128). See `ROADMAP.md` → "Per-process metrics".

9. **Don't kill a process for high RSS.** It climbs right back. Act only when the **live floor**
   is genuinely climbing toward the limit.

## Caveats

- Watt / Watt Admin are **Platformatic products**; the demo and its numbers are from the talk
  and were **not** reproduced here. The local script only reproduces the heap/RSS behavior.
- Defaults and the Node 20→22 semi-space change are as **described in the talk**; confirm on
  your own Node version before tuning production.

## References

- Talk — Matteo Collina, *Node.js will use all the memory available, and that's OK!*, dotJS
  2025: <https://www.youtube.com/watch?v=_OnTUIYxGRs>
- Speaker's talk list — <https://nodeland.dev/talks.html>
- Node.js docs — `--max-semi-space-size` / `--max-old-space-size` (CLI):
  <https://nodejs.org/api/cli.html#--max-semi-space-sizesize-in-megabytes>
- Node.js docs — `process.memoryUsage()`: <https://nodejs.org/api/process.html#processmemoryusage>
- V8 blog — *Trash talk: the Orinoco garbage collector*: <https://v8.dev/blog/trash-talk>
- V8 blog — *Optimizing V8 memory consumption* (heap-growing strategy): <https://v8.dev/blog/optimizing-v8-memory>
- Book — *The Definitive Guide for Node.js in the Enterprise* (Platformatic); see
  `ROADMAP.md` → Sources.
