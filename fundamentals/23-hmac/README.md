# HMAC — Hash-based Message Authentication Code

*An **HMAC** is a **keyed hash**: it folds a secret into a hash so the result proves two things at
once — the message wasn't **changed** (integrity) and it came from someone who holds the key
(authenticity). It hides nothing (it's not encryption), and it's the primitive behind JWT's `HS256`
and most webhook signatures.*

Part of the language-agnostic [`fundamentals/`](../) track. The primitive under `22-jwt`.

## The problem it solves

A plain hash — `sha256(message)` — proves **nothing about who sent it**, because anyone can compute
the same hash. To authenticate a message you need something only the sender and receiver share: a
**secret key**.

## What a MAC is

A **MAC** (Message Authentication Code) is a short **tag** that authenticates a message under a
**shared key**. **HMAC** is the most common way to build one — "**H**ash-based **MAC**."

- **MAC** = the *goal* (authenticate a message with a shared secret).
- **HMAC** = one *construction* of it, usable with any hash function.

## How it works

HMAC wraps the hash function **twice**, mixing the key in through two fixed padded copies:

```text
HMAC(K, m) = H( (K ⊕ opad) ‖ H( (K ⊕ ipad) ‖ m ) )

K    = key          m = message        H = a hash (e.g. SHA-256)
ipad = 0x36 repeated    opad = 0x5c repeated
‖    = concatenation    ⊕ = XOR
```

Why the double hash and the pads? It makes HMAC **safe even on weaker hashes** (MD5/SHA-1) and it
**defeats length-extension attacks** — you can't just append data and extend `H(K ‖ m)`. You never
implement this yourself; the point is that **HMAC ≠ `H(K ‖ m)`**, and now you know why.

## Properties

| Property | Meaning |
| --- | --- |
| **Integrity** | any change to the message changes the tag |
| **Authenticity** | only holders of the key can produce a valid tag |
| **Symmetric** | the *same* key signs and verifies |
| **Fixed size** | tag length = hash length (32 bytes for SHA-256) |
| **Not encryption** | the message stays readable — HMAC hides nothing |
| **Deterministic** | same key + message → same tag |

## Using it (Node)

```js
import { createHmac, timingSafeEqual } from "node:crypto";

// sign
const tag = createHmac("sha256", key).update(message).digest();

// verify — recompute and compare in CONSTANT TIME
const expected = createHmac("sha256", key).update(message).digest();
const ok = timingSafeEqual(tag, expected);
```

`timingSafeEqual` matters: a plain `tag === expected` leaks *how many bytes matched* through timing,
which can be used to forge a tag byte by byte.

## HMAC vs its neighbours

| | What it gives | Key | Hides data? |
| --- | --- | --- | --- |
| **Hash** — `sha256(m)` | fingerprint | none | no |
| **HMAC** — `HMAC(k, m)` | fingerprint + authenticity | shared secret | no |
| **Signature** — `RS256` | fingerprint + authenticity | private / public | no |
| **Encryption** — `AES` | confidentiality | key | yes |

- Prove *who* with a **shared** secret → **HMAC**.
- Prove *who* with a key anyone can verify → **signature** (`RS256`/`ES256`).
- *Hide* the data → **encryption**.

## Where it shows up

- **JWT `HS256`** — `HMAC-SHA256` over `header.payload` (`22-jwt`).
- **Webhook signatures** — Stripe, GitHub, Slack sign the request body with HMAC.
- **Cookie / session signing** — tamper-proof cookies.
- **TLS & key derivation** — HMAC inside the TLS PRF and HKDF.

## Pitfalls

- **Comparing with `==`** → timing attack. Use `timingSafeEqual`.
- **Weak or short keys** — brute-forced. Use a long random key (≥ the hash output size).
- **Reusing one key for everything** — derive per-purpose keys (e.g. HKDF).
- **`H(key ‖ message)` instead of HMAC** — vulnerable to length extension.
- **Not covering every field** — anything left out of the input isn't authenticated.
- **Mistaking it for encryption** — the payload is still plaintext.

## One-line summary

**An HMAC is a keyed hash built by wrapping a hash function twice with a shared secret, producing a
fixed-size tag that proves integrity and authenticity (but not secrecy) — the standard way to
authenticate a message with a symmetric key, and the primitive behind JWT's `HS256` and most webhook
signatures.**

## References

- RFC 2104 — *HMAC: Keyed-Hashing for Message Authentication* — <https://datatracker.ietf.org/doc/html/rfc2104>
- FIPS 198-1 — *The Keyed-Hash Message Authentication Code (HMAC)* — <https://csrc.nist.gov/pubs/fips/198-1/final>
- Node.js — *crypto.createHmac* — <https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options>
- Related: `30-timing-safe-compare`, `22-jwt`, `24-hashing-encryption-encoding`
