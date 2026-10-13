# Streams

A **stream** is an interface for data that arrives (or leaves) **over time in
chunks**, instead of all at once. As the saying goes, *"streams are arrays over time."* You
meet them everywhere in Node: `fs.createReadStream`, HTTP request/response bodies,
`process.stdin`/`stdout`, `zlib`, `crypto`, sockets.

Why they matter:

- **Memory efficiency** — process a 10 GB file without ever holding 10 GB in RAM.
- **Improved response time** — act on the first chunk before the last arrives.
- **Scalability for real-time processing** — handle high-volume data with bounded resources.
- **Backpressure** — a slow consumer can tell a fast producer to slow down, instead of the
  buffer growing without bound (a classic OOM/leak — see `17-ratelimiter-leak`).

> **Note on performance:** if the whole dataset is *already in memory*, streams add overhead,
> complexity and can be *slower*. Streams pay off when data is large or arrives over time.

## Runnable demos

| File | Covers |
|---|---|
| [`index.ts`](./index.ts) | The basics: the four types, flowing vs paused, `pipeline()`, backpressure. |
| [`deep-dive.ts`](./deep-dive.ts) | Companion to Matteo Collina's masterclass: writing custom streams, the `.pipe()` error trap, async generators as transforms, Web Streams interop. |

Run either with `node index.ts` / `node deep-dive.ts`.

## The four types

| Type | Direction | You implement | Examples |
|---|---|---|---|
| **Readable** | source (read from) | `_read()` | `fs.ReadStream`, `http.IncomingMessage`, `process.stdin` |
| **Writable** | sink (write to) | `_write()` | `fs.WriteStream`, `process.stdout`, `res` |
| **Duplex** | both | `_read()` + `_write()` | `net.Socket` (TCP), TLS sockets |
| **Transform** | both, output from input | `_transform()` | `zlib.createGzip()`, `crypto` ciphers |

All streams extend **`EventEmitter`**. A **`PassThrough`** is a trivial Transform that forwards
chunks unchanged.

## How to consume a Readable

1. **Flowing mode** — attach a `data` listener; chunks are pushed as fast as they can be
   emitted. Easy, but *you* don't control the pace. (`'data'`, `'end'`, `'error'`, `'close'`.)
2. **Paused mode** — call `.read()` (often driven by the `'readable'` event); you pull one
   chunk at a time.
3. **Async iteration** — `for await (const chunk of readable)`. **This is the recommended
   interface**: readable code, `try/catch` error handling, and backpressure for free because
   the consumer controls the pace.

```js
readable.on("data", (chunk) => { /* flowing */ });
for await (const chunk of readable) { /* paused, pull-based — preferred */ }
```

## Writing a stream

You implement the underscore method; the machinery calls it for you.

```js
import { Readable, Writable, Transform } from "node:stream";

class Countdown extends Readable {        // source
  #n = 3;
  _read() { this.push(this.#n > 0 ? `${this.#n}\n` : null); this.#n--; } // null = end
}
const upper = new Transform({             // map
  transform(chunk, enc, cb) { cb(null, chunk.toString().toUpperCase()); },
});
class Sink extends Writable {             // destination
  _write(chunk, enc, cb) { process.stdout.write(chunk, cb); } // forward cb: respects stdout's backpressure
}
```

`push(chunk)` adds data; `push(null)` signals end-of-stream.

The `_write(chunk, enc, cb)` callback is the **"done with this chunk" signal**. `_write`
may be asynchronous, so the stream waits until you call `cb` before handing you the next
chunk — that is how a Writable serializes writes and applies backpressure. Call it
**exactly once**: `cb()` / `cb(null)` = success, `cb(err)` = error (emits `'error'`).
Forget it and the stream stalls forever; call it twice and you get `ERR_MULTIPLE_CALLBACK`.
Here `process.stdout.write(chunk, cb)` forwards it, so "done" means stdout has actually
flushed the chunk.

## Backpressure (the important part)

Every Writable has a **`highWaterMark`** (its internal buffer size, default 16 KiB for byte
streams, and a *count* in object mode). When you `write()`:

- it returns **`true`** — buffer has room, keep writing;
- it returns **`false`** — buffer is full: **stop and wait for the `'drain'` event**.

Ignoring that `false` is how you get unbounded memory growth. `pipe()` and `pipeline()` handle
this for you; hand-rolled loops must respect it.

```js
if (!writable.write(chunk)) await once(writable, "drain"); // full -> wait
```

## `.pipe()` vs `pipeline()`

`pipeline()` (from `node:stream`, or the promise form in `node:stream/promises`) is the
**preferred** way to connect streams.

- `readable.pipe(dest)` — convenient, but it **does not forward errors and does not clean up**
  the other streams. If a middle transform errors, the source and destination are left dangling
  (a leak). This is the masterclass's headline reason to avoid it for pipelines.
- `pipeline(src, ...transforms, dst)` — forwards errors, **destroys every stream** in the chain
  on failure, and calls back / resolves when done.

```js
import { pipeline } from "node:stream/promises";
await pipeline(
  createReadStream("big.log"),
  createGzip(),
  createWriteStream("big.log.gz")
);
```

`deep-dive.ts` runs the same failure through both APIs side by side and prints each stream's
`destroyed` state — `pipe()` leaves `src.destroyed=false`, `pipeline()` leaves it `true`.

## Async generators as transforms

An async generator is a valid pipeline stage — no `Transform` subclass needed:

```js
await pipeline(
  source,
  async function* (s) { for await (const c of s) yield c.toString().toUpperCase(); },
  process.stdout
);
```

## The evolution of streams

| Version | Node | What changed |
|---|---|---|
| **Streams 0** | 2009 (Node 0.x) | No `Stream` class; modules implemented `read`/`write`; `util.pump()` moved data. |
| **Streams 1 (Classic)** | v0.4.0 (2011) | `Stream` class + `.pipe()` introduced. |
| **Streams 2** | v0.10.0 (2012) | `Readable`/`Writable`/`Duplex`/`Transform`; `'readable'` event; old mode via `data` listener or `pause()`/`resume()`. |
| **Streams 3** | v0.11.5 (2013) | Fixed mixing `data` + `readable` handlers; **current** implementation. |

## `objectMode`

By default streams carry **bytes** (`Buffer`/`Uint8Array`/string). With `objectMode: true` a
chunk can be *any* JS value except `null` (which still means end-of-stream). The
`highWaterMark` then counts **objects, not bytes**.

## Streams vs Web Streams

Node has two stream implementations: the classic `node:stream` API and the **WHATWG
`ReadableStream`/`WritableStream`/`TransformStream`** (`node:stream/web`), used by `fetch()`.
Their APIs differ and they are **not** directly compatible — convert with `Readable.toWeb()` /
`Readable.fromWeb()` (and the `Writable`/`Duplex` equivalents). Both are async-iterable, so
`pipeline` and `for await` work across the boundary. A `fetch` body is a
`ReadableStream<Uint8Array>`, so you need a `TextDecoderStream` to get strings.

```js
const { body } = await fetch(url);        // WHATWG ReadableStream
await pipeline(body, new TextDecoderStream(), async function* (s) {
  for await (const chunk of s) yield chunk.toUpperCase();
}, process.stdout);
```

## Mental model

> A stream is a **pull/push boundary with a buffer and a contract**. Readables produce chunks,
> Writables consume them, Transforms map between, and the `highWaterMark` + `'drain'` handshake
> is how they agree on a pace neither can exceed. Wire them with `pipeline()`, consume them with
> `for await`, and let backpressure do its job.

## Sources / references

- **Matteo Collina — _A Deep Dive into Node.js Streams_ (masterclass, Platformatic, 2024-04-22)**
  — <https://www.youtube.com/watch?v=edB964-YYpE>. This directory follows its outline: why
  streams, how to consume, the evolution across Node versions, how to write one, and processing
  large data.
- Node.js, *How To Use Streams* (derived from Collina's Platformatic blog) —
  <https://nodejs.org/learn/modules/how-to-use-streams>.
- Node.js, *Backpressuring in Streams* —
  <https://nodejs.org/en/learn/modules/backpressuring-in-streams>.
- Node.js, *Stream* API — <https://nodejs.org/api/stream.html>.
- Node.js, *Web Streams API* — <https://nodejs.org/api/webstreams.html>.
- Platformatic blog, *A guide to reading and writing Node.js streams* —
  <https://blog.platformatic.dev/a-guide-to-reading-and-writing-nodejs-streams>.
