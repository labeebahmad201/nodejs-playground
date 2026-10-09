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

## Why RSS doesn't come back down

The crucial detail: **V8 only returns memory to the OS on compaction** (and even then,
conservatively). Until a compact happens, the pages it reserved stay mapped — so the
**RSS stays high** even after objects are freed. V8 is hoarding because *"this has happened
before and it will happen again"* — it expects to allocate again, and returning memory to the
OS is expensive.

You can see this locally (below): after freeing everything, `heapUsed` collapses from
**119 MB → 7 MB** while `rss` stays at **~228 MB**. That gap is *normal*, not a leak.

## What to actually monitor

Two numbers together, not one:

| Metric | Meaning |
|---|---|
| **`heapUsed / heapTotal`** | how much of the heap V8 has reserved is actually live |
| **`rss`** | the blob of memory V8 has taken from the OS |

A high `rss` with a healthy `heapUsed/heapTotal` ratio is a *reserved* heap, not a leak. A
leak shows as `heapUsed` climbing and **never coming back down** after GC. (See `ROADMAP.md`
→ "Per-process metrics to track".)

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
node --max-semi-space-size=64 app.js   # young generation: 64 MB per semi-space (128 MB total)
node --max-old-space-size=4096 app.js  # old generation ceiling
```

- `--max-semi-space-size` sets **one semi-space**; the young generation is **two** of them.
- A bigger young generation means **more allocations are collected cheaply** and **less is
  promoted to old space**, giving a healthier (shorter/thinner) GC cycle.
- **Node 20 → Node 22 change:** V8 changed how it computes the default semi-space size —
  it now derives it from **available memory**. In a small container (say 500 MB) that can
  leave the young generation at **~1 MB**, which performs badly. **Set it explicitly.**

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
start                      rss=   67.7 MB heapTotal=    8.7 MB heapUsed=    7.1 MB external=    9.5 MB
after 0 chunks             rss=   75.2 MB heapTotal=    8.7 MB heapUsed=    7.7 MB external=    9.8 MB
after 50,000 chunks        rss=  127.1 MB heapTotal=   87.1 MB heapUsed=   34.9 MB external=    7.4 MB
after 100,000 chunks       rss=  174.2 MB heapTotal=  160.7 MB heapUsed=   62.5 MB external=    7.4 MB
after 150,000 chunks       rss=  202.8 MB heapTotal=  186.3 MB heapUsed=   90.6 MB external=    7.4 MB
after retaining chunks     rss=  232.0 MB heapTotal=  214.7 MB heapUsed=  119.3 MB external=    7.4 MB
after drop + gc()          rss=  227.6 MB heapTotal=  137.9 MB heapUsed=    7.2 MB external=    7.4 MB
```

The punchline is the last line: **`heapUsed` fell 119 MB → 7 MB, `rss` stayed at ~228 MB.**
That is V8 keeping memory it expects to reuse — *not* a leak. (`heapTotal` also shrinks much
more with `--max-semi-space-size=1`: ~12 MB vs ~138 MB, showing what V8 reserves is tunable.)

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
- Book — *The Definitive Guide for Node.js in the Enterprise* (Platformatic); see
  `ROADMAP.md` → Sources.
