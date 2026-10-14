# 22. Off-heap leak: `heapUsed` flat, `rss` climbing

A memory leak where the **JS heap looks perfectly healthy** but the process still eats
RAM. The cause here is an **unconsumed stream buffer**: a `Readable` nobody reads keeps
`push()`-ed `Buffer`s in its internal queue. A Buffer's bytes live **off the V8 heap**,
so they show up in `rss` / `external` / `arrayBuffers` but **not** in `heapUsed` — the
one number a heap-only monitor watches.

```
22-offheap-stream-leak/
├── index.ts    # leaky (never consume) vs fixed (consume) — prints the memory numbers
└── README.md
```

Run:

```sh
node index.ts              # leaky (default): never consume the stream
MODE=fixed node index.ts   # fixed: consume (discard) the stream
DURATION_MS=8000 node index.ts   # shorten the run
```

## The three numbers

| Metric | What it measures |
|---|---|
| `heapUsed` | live **JS objects** on V8's heap (the only thing the GC manages) |
| `rss` | **resident set size** — all physical RAM the process currently holds |
| `external` / `arrayBuffers` | memory V8 *tracks* but that lives outside the JS heap — mostly `Buffer`s / `ArrayBuffer`s (`arrayBuffers` ⊂ `external`) |

So `rss` ⊇ heap + off-heap. A `Buffer` is a tiny JS wrapper around a backing store
`malloc`'d **outside** the heap, so its bytes never touch `heapUsed`.

## The leak

A `Readable` is only drained when someone **consumes** it. With no consumer, every
`push(chunk)` just appends to the internal buffer — and the producer that ignores
`push()`'s `false` return never stops. `readableLength` (buffered bytes) grows without
bound, each `Buffer` holding real off-heap pages.

## What you'll see

`MODE=leaky` — `heapUsed` is flat, everything off-heap climbs and never recovers:

```
   time  heapUsed     rss  external  arrayBuf  readBuf
      1s    7.6   86.0   28.8   19.0   19.0
      4s    7.7  146.6   85.4   78.0   78.0
      7s    7.9  206.1  144.4  137.0  137.0
final: heapUsed=8.0 MB  rss=225.3 MB  arrayBuffers=156.0 MB  readableLength=156.0 MB
-> heapUsed ~flat, rss/external/arrayBuffers grew: an off-heap leak.
```

`MODE=fixed` — the stream is consumed and discarded, so the buffer stays empty; `external`
oscillates in a bounded band and `rss` settles at an allocator **high-water mark** instead
of climbing:

```
   time  heapUsed     rss  external  arrayBuf  readBuf
      1s    7.5   87.0    8.4    1.0    0.0
      7s    7.5  134.3   19.6   12.3    0.0
     14s    7.7  142.4   38.4   31.0    0.0
final: heapUsed=7.8 MB  rss=142.4 MB  arrayBuffers=51.0 MB  readableLength=0.0 MB
-> rss/external/arrayBuffers stayed bounded: consumed, no leak.
```

The tell is **`readableLength`**: it grows without bound when leaky and stays `0` when
fixed. (Even the fixed run's `rss` rises to a high-water mark — freed pages aren't
returned to the OS immediately — but it *plateaus*; the leaky run never does.)

## The fix

Consume the stream — attach a `data` handler, `for await`, or `pipe`/`pipeline` into a
destination — and/or **respect backpressure** (stop `push`-ing / `write`-ing when you get
`false`). A drained buffer stays empty and bounded:

```js
src.on("data", () => {});   // consume & discard
// or: for await (const _ of src) {}
```

## Gotcha: zero-filled pages may not count as RSS

`Buffer.alloc(n)` (or `allocUnsafe`) can map the OS's shared **zero page**, so RSS may not
move even though `external` grows. This demo fills with a **non-zero** byte
(`Buffer.alloc(n, 0xab)`) to force real resident pages. On Linux/macOS the accounting
differs slightly, but the *shape* — flat `heapUsed`, rising off-heap numbers — is the
same.

## Detecting this in production

`heapUsed` flat (a rising-floor check would miss it) while **`rss` / `external` /
`arrayBuffers`** rise is the signature of an **off-heap** leak. Watch the off-heap numbers,
not just the heap; and remember an idle-but-alive stream still holds its buffer and fd.
See `15-v8-memory` for the GC/RSS model.

## Sources / references

- Node.js, `process.memoryUsage()` —
  <https://nodejs.org/api/process.html#processmemoryusage>.
- Node.js, *Diagnostics: Memory* — <https://nodejs.org/en/learn/diagnostics/memory>.
- Node.js, *Buffer* API — <https://nodejs.org/api/buffer.html>.
- V8, *Trash talk: the Orinoco garbage collector* — <https://v8.dev/blog/trash-talk>.
