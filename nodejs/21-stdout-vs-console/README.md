# 21. `console.log` vs `process.stdout.write`

`process.stdout` is a **Writable stream** bound to file descriptor **1** (the terminal,
or wherever stdout is redirected). `console.log` is a **logging helper** built on top of
it — it is essentially `process.stdout.write(util.format(...args) + "\n")`. Same bytes,
different contract: one is a stream sink, the other is a formatter.

```
21-stdout-vs-console/
├── index.ts    # return value, newline/formatting, pipeability, fds, custom Console
└── README.md
```

Run it:

```sh
node index.ts
```

## The three standard streams

Every process gets three, each backed by a file descriptor:

| Stream | fd | Direction | Kind |
|---|---|---|---|
| `process.stdin` | 0 | input | Readable |
| `process.stdout` | 1 | output | Writable |
| `process.stderr` | 2 | output (errors) | Writable |

Because `stdout`/`stderr` are Writable streams, they can be **piped into**
(`src.pipe(process.stdout)`) and are valid `pipeline()` destinations. `console.log`
is *not* a stream and cannot be either.

## The differences

| | `console.log(...args)` | `process.stdout.write(chunk)` |
|---|---|---|
| What it is | logging helper | raw Writable stream |
| Formatting | `util.format` / `util.inspect` (objects pretty-printed) | none — bytes are written as-is |
| Trailing newline | always appends `\n` | none added |
| Multiple args / `%s` `%d` | yes | no (single chunk) |
| Accepted chunk | anything (it formats it) | `string` / `Buffer` / `Uint8Array` / `DataView` only |
| Return value | `undefined` | `boolean` — `false` means "buffer full, wait for `'drain'`" |
| Completion callback | no | yes: `write(chunk, cb)` |
| Pipeable / pipeline destination | no | yes |
| Backpressure-aware | no | yes |

## When to use which

- **`console.log`** — for humans: debug output, logs, printing structured values. It
  formats and newlines for you. Convenient, but you lose the backpressure signal.
- **`process.stdout.write`** — when you're treating stdout as a **stream**: writing raw
  bytes/chunks, respecting backpressure, forwarding a flush callback
  (`write(chunk, cb)`), or piping into it.

`console.log` is just `process.stdout.write` + formatting + `\n`:

```js
console.log("a")            // prints "a\n", returns undefined
process.stdout.write("a")   // prints "a",   returns true/false
```

## stderr is separate

`console.error` and `console.warn` write to **`process.stderr` (fd 2)**, not stdout.
That separation is the point: you can redirect them independently
(`node app.js >out.log 2>err.log`), so errors don't pollute the data stream.

## `console` is a `Console` instance

The global `console` is an instance of the `Console` class, which you can construct
yourself around any two writable streams — handy for routing logs elsewhere or capturing
them in tests:

```js
import { Console } from "node:console";
const log = new Console({ stdout: process.stdout, stderr: process.stderr });
log.log("goes to stdout");
```

## Sources / references

- Node.js, *Console* API — <https://nodejs.org/api/console.html>.
- Node.js, *`process.stdout`* —
  <https://nodejs.org/api/process.html#processstdout>.
- Node.js, *`util.format()`* —
  <https://nodejs.org/api/util.html#utilformatformat-args>.
- Node.js, *Stream* API (Writable) — <https://nodejs.org/api/stream.html>.
