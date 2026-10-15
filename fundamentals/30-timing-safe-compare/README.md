# Timing-safe comparison — `crypto.timingSafeEqual`

*Comparing secrets with* `===` *leaks how much of the value was correct, through **time**. An attacker measures that to guess the secret byte by byte.* `timingSafeEqual` *compares every byte in constant time, leaking nothing.*

Part of the language-agnostic `fundamentals/` track. Used in `23-hmac`, `22-jwt`, and `29-password-hashing`.

## The problem: comparison short-circuits

```js
"abcX" === "abcY"   // fails at byte 4
"XXXX" === "abcY"   // fails at byte 1
```

A normal comparison stops at the **first difference**, so it returns **faster when fewer bytes match**. That timing difference is a side channel.

## The attack (timing attack)

1. Try all 256 values for byte 1; the correct one makes the compare run *slightly* longer (it proceeds to byte 2).
2. Keep the slowest, move to byte 2, repeat.
3. Reconstruct the secret without brute-forcing the whole space.

It works over a network too — send many requests and average out the noise to see the microsecond difference.

## The fix: constant-time compare

`timingSafeEqual(a, b)` always compares **all** bytes, so it takes the same time no matter where (or whether) the values differ:

```js
import { timingSafeEqual } from "node:crypto";

const a = Buffer.from(computedMac);
const b = Buffer.from(receivedMac);
const ok = a.length === b.length && timingSafeEqual(a, b);
```

## Constraints

- Both arguments must be **Buffers of equal length**, or it **throws** — guard the length first.
- **Length still leaks** — but you normally compare fixed-size values (MACs, hashes), so it's constant.
- For **variable-length** secrets, **hash/HMAC both sides first** to a fixed length, then compare.

## When to use it

- MAC / signature tags (HMAC verification)
- Session tokens and cookies
- API keys
- Password-hash checks (the libraries already do this)
- CSRF tokens

## Why not just write your own loop?

JIT compilation, branch prediction, and CPU caches can reintroduce timing differences — a hand-rolled loop isn't guaranteed to be constant-time. Use the vetted primitive.

## Run it

[`index.ts`](index.ts) benchmarks a naive compare against `timingSafeEqual` as the shared prefix grows:

```sh
node index.ts   # Node 24 runs TypeScript directly
```

```
shared prefix |   naive (ns) |   safe (ns)
            0 |          5.4 |        50.9
            5 |         12.4 |        52.5
           20 |         27.0 |        52.6
           27 |         34.4 |        52.7
```

The naive time **rises** with the matching prefix — that's the leak. The safe time stays **flat**.

## One-line summary

`timingSafeEqual` **compares two buffers in constant time so the runtime doesn't reveal how many bytes matched — closing the timing-attack side channel that** `===` **opens, where an attacker guesses a secret byte by byte by measuring how long the comparison takes.**

## References

- Node.js — *crypto.timingSafeEqual* — <https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b>
- CWE-208 — *Observable Timing Discrepancy* — <https://cwe.mitre.org/data/definitions/208.html>
- Related: `23-hmac`, `29-password-hashing`, `22-jwt`