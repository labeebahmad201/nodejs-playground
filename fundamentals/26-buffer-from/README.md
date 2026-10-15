# Buffer.from — turning values into bytes

*A `Buffer` is Node's type for **raw bytes** — a fixed-length sequence of 8-bit values (a subclass of
`Uint8Array`). `Buffer.from(...)` is the standard way to **create** one: from a string (with an
encoding), another buffer, an array of bytes, or an `ArrayBuffer`. The **encoding** argument is the
part that matters.*

Part of the language-agnostic [`fundamentals/`](../) track. Companion to `25-base64` and
`24-hashing-encryption-encoding`.

## What a Buffer is

A **Buffer** is a chunk of raw memory holding bytes — not text. Strings are *text + an encoding*;
Buffers are the bytes themselves. Node uses them everywhere binary shows up: files, sockets, crypto,
hashes, base64/hex.

## What `Buffer.from` does

It's a set of overloads that turn *something* into bytes:

| Call | Meaning |
| --- | --- |
| `Buffer.from(string[, encoding])` | encode text → bytes (default `"utf8"`) |
| `Buffer.from(buffer)` | **copy** bytes from another `Buffer` / `Uint8Array` |
| `Buffer.from(arrayBuffer[, offset[, length]])` | a **view** sharing memory — **no copy** |
| `Buffer.from(array)` | from an array of byte values (`0–255`) |
| `Buffer.from(object)` | via the object's `valueOf()` / `Symbol.toPrimitive` |

It always returns a `Buffer`.

## The encoding argument

The second argument (only for strings) decides how the text is interpreted:

| Encoding | Meaning |
| --- | --- |
| `"utf8"` *(default)* | standard text; 1–4 bytes per char |
| `"base64"` / `"base64url"` | **decode** Base64 text into bytes |
| `"hex"` | decode hex (`"6869"` → `68 69`) |
| `"latin1"` / `"binary"` | 1 byte per char |
| `"ascii"` | 7-bit |
| `"utf16le"` / `"ucs2"` | 2 bytes per char |

## Examples

```js
Buffer.from("hi");               // <Buffer 68 69>          (UTF-8: 2 bytes)
Buffer.from("aGk=", "base64");   // <Buffer 68 69>          (decodes to "hi")
Buffer.from("6869", "hex");      // <Buffer 68 69>
Buffer.from([0x68, 0x69]);       // <Buffer 68 69>
Buffer.from("hi", "utf16le");    // <Buffer 68 00 69 00>    (2 bytes per char)
```

Round-trips are just `from` + `toString`:

```js
Buffer.from("hi").toString("base64");      // "aGk="
Buffer.from("aGk=", "base64").toString();  // "hi"
```

## Copies vs views

The source type decides whether you get an independent copy or a shared view:

```js
const a = Buffer.from("hi");

const copy = Buffer.from(a);   // COPIES the bytes
a[0] = 0x48;
copy[0];                       // 0x68 — unaffected

const ab   = new ArrayBuffer(4);
const view = Buffer.from(ab);  // VIEWS the same memory (no copy)
view[0] = 0x41;
new Uint8Array(ab)[0];         // 0x41 — shared
```

## `Buffer.from` vs `alloc` vs `allocUnsafe`

| Call | Use |
| --- | --- |
| `Buffer.from(x)` | create from existing data (string / array / buffer) |
| `Buffer.alloc(n)` | `n` **zero-filled** bytes — safe |
| `Buffer.allocUnsafe(n)` | `n` **uninitialized** bytes — fast, may expose old memory |

## Why it exists / where it's used

- **crypto** — keys, hashes, signatures, HMAC tags
- **base64 / hex** conversions
- **I/O** — reading files, sockets, streams (bytes)
- **binary protocols** — building/parsing wire formats

## Pitfalls

- **`new Buffer()` is deprecated and unsafe** — use `Buffer.from(...)` or `Buffer.alloc(...)`.
- **Default is `utf8`.** `Buffer.from("aGk=")` gives the bytes of the four characters, **not** `"hi"` —
  you must pass `"base64"`.
- **`Buffer.from(arrayBuffer)` shares memory** — mutating either side changes both.
- **`Buffer` is Node-only.** In the browser, use `Uint8Array` / `TextEncoder` / `TextDecoder`.

## One-line summary

**`Buffer.from(...)` creates a `Buffer` (a raw-byte sequence, a `Uint8Array` subclass) from a string
(with an encoding that decides the interpretation), another buffer, a byte array, or an ArrayBuffer —
copying for most inputs but sharing memory for an `ArrayBuffer` — and it's the standard Node way to get
bytes for crypto, encoding, and I/O.**

## References

- Node.js — *Buffer* — <https://nodejs.org/api/buffer.html>
- Node.js — *Buffer.from()* — <https://nodejs.org/api/buffer.html#static-method-bufferfromstring-encoding>
- Related: `25-base64`, `24-hashing-encryption-encoding`
