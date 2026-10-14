# New space vs old space (and when objects are promoted)

How V8's generational garbage collector works: the two generations, the scavenger's
copy-then-swap, the exact moment objects are promoted to the old generation, and the full map
of heap spaces (regular + large-object) with the sizes each flag controls.

Everything here is backed by **V8's own blog posts** (official) — quoted inline. Node's
`--max-semi-space-size` / `--max-old-space-size` flags are cited to the Node CLI docs.

## The two generations

V8 splits its heap into generations. The **young generation** is itself split into a
**nursery** and an **intermediate** sub-generation; then there is the **old generation**.

> "V8 partitions its managed heap into generations where objects are initially allocated in
> the 'nursery' of the young generation. Upon surviving a garbage collection, objects are
> copied into the intermediate generation, which is still part of the young generation.
> After surviving another garbage collection, these objects are moved into the old
> generation."
> — *Orinoco: young generation garbage collection*, <https://v8.dev/blog/orinoco-parallel-scavenger>

The reason for the split is the **generational hypothesis**:

> "The Generational Hypothesis … basically states that most objects die young. In other
> words, most objects are allocated and then almost immediately become unreachable … This
> holds not only for V8 or JavaScript, but for most dynamic languages."
> — *Trash talk: the Orinoco garbage collector*, <https://v8.dev/blog/trash-talk>

The design pays off because the collector is a **moving/copying** collector: it only pays for
objects that **survive** (a small fraction), not for the many that die.

## New space (young generation)

- **Semi-space design:** the scavenger operates on **two semi-spaces** (halves). At any time
  **one half is available for allocation** (called **from-space**) and **the other is empty**
  (called **to-space**).
- **Size:** "the young generation is relatively small (up to 16MiB in V8)". *(V8,
  orinoco-parallel-scavenger)* Note the young generation as a whole is sized at **three times**
  a semi-space by default (the two scavenger semi-spaces **plus** a new large-object space;
  V8's `YoungGenerationSizeFromSemiSpaceSize` is `semi_space_size * (2 + 1)`), which is what
  `--max-semi-space-size` scales. See "Tuning" below.
- The young-generation collector is the **Minor GC**, a.k.a. the **Scavenger**. The
  whole-heap collector is the **Major GC (Mark-Compact)**.

> "In the Scavenger, which only collects within the young generation, surviving objects are
> always evacuated to a new page. V8 uses a 'semi-space' design for the young generation.
> This means that half of the total space is always empty, to allow for this evacuation step.
> During a scavenge, this initially-empty area is called 'To-Space'. The area we copy from is
> called 'From-Space'."
> — *Trash talk*, <https://v8.dev/blog/trash-talk>

### Copy survivors, then swap

A scavenge (evacuation) does three things, interleaved:

1. **Copy** every *live* object from from-space into to-space, leaving a **forwarding
   address** at the old location.
2. **Update pointers** so references point at the new locations.
3. **Swap the halves.**

> "We then switch around the two spaces i.e. To-Space becomes From-Space and vice-versa. Once
> GC is completed, new allocations happen at the next free address in the From-Space."
> — *Trash talk*

The "swap" here is **only a relabeling of the two halves in RAM** — *not* the OS swap (which
writes cold pages to disk; see [`rss.md`](./rss.md)). After the swap, the old from-space is
**entirely garbage**, so it is freed in one shot (just reset the bump pointer).

## When objects are promoted to old space

**Promotion happens during a scavenge, at the moment each surviving object is being copied.**
The rule is **age**: an object that has already survived one collection is no longer copied
into to-space — it is moved to the **old generation** instead.

> "Live objects that have already been copied once are considered part of the intermediate
> generation and are promoted to the old generation."
> — *Orinoco: young generation garbage collection*

Stated the other way, in terms of GC cycles:

> "Objects that survive a second GC are evacuated into the old generation, rather than
> To-Space."
> — *Trash talk*

So the lifetime path is:

```
allocated in nursery
        │
        ├─ survive GC #1 ──▶ copied to To-Space  = intermediate (still young)
        │
        └─ survive GC #2 ──▶ promoted to OLD generation
```

Only **live (reachable)** objects are promoted — garbage is simply dropped when the half is
wiped. (The scavenger's root set is the call stack, globals, and old→young references tracked
by write barriers; it does not trace the entire old generation each time.)

## Old space (old generation)

The old generation is collected by the **Major GC (Mark-Compact)**, which collects the whole
heap and runs in three phases:

- **Marking** — find reachable objects starting from the root set (execution stack, globals),
  following every pointer. Reachability is the proxy for liveness.
- **Sweeping** — add the gaps left by dead objects to **free-lists** (bucketed by size).
- **Compaction** — optionally **evacuate/compact** some pages, chosen by a **fragmentation
  heuristic**, copying survivors into other pages. Not every page is compacted; the rest are
  just swept.

> "The major GC also chooses to evacuate/compact some pages, based on a fragmentation
> heuristic. … This is why we choose to compact only some highly fragmented pages, and just
> perform sweeping on others, which does not copy surviving objects."
> — *Trash talk*

Most of this runs **off the main thread**: concurrent marking and concurrent sweeping happen
in the background, and compaction/pointer-updating are **parallel** across helper threads.

> "Major GC in V8 starts with concurrent marking. … The major GC uses concurrent marking and
> sweeping, and parallel compaction and pointer updating."
> — *Trash talk*

## The full space map (regular + large-object spaces)

The talk simplifies to "new space" and "old space," but **each generation actually has a
*regular* space and a *large-object* space**. Objects above `kMaxRegularHeapObjectSize` — half
a V8 page, **~128 KB** on x64/arm64 where a page is 256 KB — go into a large-object space
instead of the regular one:

```cpp
// src/base/build_config.h
constexpr int kPageSizeBits = 18;                 // V8 page = 2^18 = 256 KB (x64/arm64)
// src/common/globals.h
constexpr int kMaxRegularHeapObjectSize = (1 << (kPageSizeBits - 1));  // 2^17 = 128 KB
```

```cpp
// src/common/globals.h — the spaces, named
enum AllocationSpace {
  NEW_SPACE,      // young generation, regular objects
  OLD_SPACE,      // old generation, regular objects
  NEW_LO_SPACE,   // young generation LARGE objects
  LO_SPACE,       // old generation LARGE objects
  CODE_SPACE,     // old generation JIT code
  ...
};
constexpr bool IsAnyNewSpace(AllocationSpace s) { return s == NEW_SPACE || s == NEW_LO_SPACE; }
```

Why a separate space: large objects don't fit the regular page/free-list model, and the
scavenger is a *copying* collector — evacuating huge objects would be very expensive. So V8
gives them their own pages and does **not** evacuate them in a scavenge; the major GC reclaims
them.

Map (with sizes for `--max-semi-space-size=64`, i.e. S = 64 MiB):

```
V8 managed heap   (heapTotal = capacity; heapUsed = occupied)
│
├─ YOUNG GENERATION  = 3S = 192 MiB
│  │
│  ├─ NEW_SPACE              = 2S = 128 MiB
│  │    ├─ from-space        =  S =  64 MiB   ┐ scavenger copies live from→to,
│  │    └─ to-space          =  S =  64 MiB   ┘ then swaps the two
│  │
│  └─ NEW_LO_SPACE           =  S =  64 MiB     young large objects (> ~128 KB)
│
└─ OLD GENERATION  ≤ --max-old-space-size
   ├─ OLD_SPACE                                  regular long-lived objects
   ├─ LO_SPACE                                   old large objects
   └─ CODE_SPACE                                 JIT-compiled code
```

| `--max-semi-space-size` (S) | `NEW_SPACE` (2S) | `NEW_LO_SPACE` (S) | **young gen (3S)** | old gen |
|---|---|---|---|---|
| **1 MiB** (small-container default) | 2 MiB | 1 MiB | **3 MiB** | ≤ `--max-old-space-size` |
| **16 MiB** | 32 MiB | 16 MiB | **48 MiB** | ≤ `--max-old-space-size` |
| **64 MiB** | 128 MiB | 64 MiB | **192 MiB** | ≤ `--max-old-space-size` |
| **128 MiB** | 256 MiB | 128 MiB | **384 MiB** | ≤ `--max-old-space-size` |

Which flag controls which spaces (from `Heap::MaxReserved` in `src/heap/heap.cc`):

```
--max-semi-space-size  ──▶  NEW_SPACE (2 semi-spaces) + NEW_LO_SPACE   (whole young gen = 3S)
--max-old-space-size   ──▶  OLD_SPACE + LO_SPACE + CODE_SPACE          (old generation)
```

So raising the semi-space grows the **whole nursery** (all three young spaces) and leaves the
old generation untouched. Total heap cap ≈ `3S + old_max` (the `MaxReserved` formula). All of
these are **maximums** — V8 may use less.

Mapping back to the talk's wording:

| The talk said | V8 actually has |
|---|---|
| "new space" | `NEW_SPACE` (regular) **+** `NEW_LO_SPACE` (large) |
| "old space" | `OLD_SPACE` (regular) **+** `LO_SPACE` (large) **+** `CODE_SPACE` |

## Tuning the two spaces (Node)

- `--max-semi-space-size` sizes **one semi-space**. The **young generation total is 3×** that
  by default (two scavenger semi-spaces + a new large-object space;
  `YoungGenerationSizeFromSemiSpaceSize = semi_space_size * (2 + 1)`), so `=64` → ~192 MB.
  Node docs state this explicitly: *"the young generation size of the V8 heap is three times
  … the size of the semi-space"*. With `--minor-ms` the factor is 2×.
- `--max-old-space-size` sets the **old generation** ceiling.

See the talk write-up in [`README.md`](./README.md) for why a bigger young generation (less
promotion, shorter GC cycles) trades memory for latency. References:
Node CLI docs, <https://nodejs.org/api/cli.html#--max-semi-space-sizesize-in-megabytes> and
<https://nodejs.org/api/cli.html#--max-old-space-sizesize-in-megabytes>.

## References (official)

- V8 — *Orinoco: young generation garbage collection* (2017):
  <https://v8.dev/blog/orinoco-parallel-scavenger>
- V8 — *Trash talk: the Orinoco garbage collector* (2019): <https://v8.dev/blog/trash-talk>
- V8 — *Orinoco: a new garbage collector* (background/parallel/concurrent):
  <https://v8.dev/blog/orinoco>
- Node.js CLI docs — `--max-semi-space-size`, `--max-old-space-size`:
  <https://nodejs.org/api/cli.html#--max-semi-space-sizesize-in-megabytes>
- V8 source — `src/common/globals.h` (`AllocationSpace` enum, `kMaxRegularHeapObjectSize`):
  <https://github.com/v8/v8/blob/main/src/common/globals.h>
- V8 source — `src/heap/heap.cc` (`YoungGenerationSizeFromSemiSpaceSize`, `MaxReserved`):
  <https://github.com/v8/v8/blob/main/src/heap/heap.cc>
- V8 source — `src/base/build_config.h` (`kPageSizeBits`):
  <https://github.com/v8/v8/blob/main/src/base/build_config.h>
