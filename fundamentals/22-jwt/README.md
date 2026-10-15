# JWT — JSON Web Tokens

*JWT (JSON Web Token, RFC 7519) is a compact, URL-safe, **signed** string carrying a set of **claims**
— statements about a subject. It's the token format behind most stateless auth. The thing teams get
wrong: it's **signed, not encrypted** — anyone can read it.*

Part of the language-agnostic [`fundamentals/`](../) track. A concrete security standard, included for
the identity/claims angle — see `21-value-entity-identity`.

## What it is

A token with three Base64URL parts joined by dots: `header.payload.signature`. The issuer signs it;
anyone with the key can verify it. The payload is just claims — data about a subject (who they are,
when it's valid, what they may do).

## Structure

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 . eyJzdWIiOiIxMjMiLCJuYW1lIjoiSmFuZSIsImV4cCI6MTUxNjI0MjYyMn0 . dBjftJeZ4CVP...
        header                                     payload                                        signature
```

Decoded, those first two parts are plain JSON:

```json
// header — metadata about the token
{ "alg": "HS256", "typ": "JWT" }

// payload — the claims
{ "sub": "123", "name": "Jane", "iat": 1516239022, "exp": 1516242622 }

// signature = sign( base64url(header) + "." + base64url(payload), key )
```

## The header

The header is the **first** part — small JSON metadata describing *how the token is signed*. It isn't
secret (it's just encoded), and it's **security-critical** because it tells the verifier which
algorithm to use.

| Field | Required? | Meaning |
| --- | --- | --- |
| `alg` | yes | signing algorithm — `HS256`, `RS256`, `ES256`, `none` |
| `typ` | no | token type — conventionally `"JWT"` |
| `kid` | no | key id — which key signed it (for key rotation) |
| `cty` | no | content type — used for nested JWTs |

Two example headers:

```json
{ "alg": "HS256", "typ": "JWT" }
```

```json
{ "alg": "RS256", "typ": "JWT", "kid": "2026-10-key-1" }
```

**The trap:** the header is attacker-controlled input. Never let it decide how you verify — read `alg`
only to confirm it's in your allowlist, and use `kid` to *look up* a key you already trust, never to
*fetch* one (`jku` / `jwk` / `x5c` can be abused for SSRF and key injection).

## A decoded token (full example)

The canonical example (this exact token is the default on jwt.io):

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

Split on the dots and decode the first two parts:

```json
// 1. header  (base64url-decoded)
{ "alg": "HS256", "typ": "JWT" }

// 2. payload / claims  (base64url-decoded — readable by anyone)
{ "sub": "1234567890", "name": "John Doe", "iat": 1516239022 }

// 3. signature — NOT JSON; raw bytes, base64url-encoded:
//    HMACSHA256( base64url(header) + "." + base64url(payload), secret )
```

A verifier recomputes the signature from the first two parts with the key and compares. Change a
single character of the header or payload and the signature no longer matches — that's the integrity
guarantee, and it's why the payload needs no encryption to be tamper-proof.

## Signed ≠ encrypted

- Base64URL is an **encoding, not encryption** — paste any JWT into a decoder and read it.
- The signature guarantees **integrity + authenticity**: nobody can alter the claims without the key.
  It guarantees **nothing about confidentiality**.
- Consequence: **never put secrets or PII in the payload.**

## Claims

| Registered | Meaning |
| --- | --- |
| `iss` | issuer |
| `sub` | subject (who the token is about) |
| `aud` | audience (who it's for) |
| `exp` / `nbf` | expiry / not-before |
| `iat` | issued-at |
| `jti` | unique token id (for replay/denylist) |

Plus **custom** claims (`roles`, `scopes`, `tenant`, …). Keep them small — the token is sent on every
request.

## Algorithms

| `alg` | Type | Key | Typical use |
| --- | --- | --- | --- |
| `HS256` | HMAC (symmetric) | one shared secret | a single service that both signs and verifies |
| `RS256` / `ES256` | RSA / ECDSA (asymmetric) | private key signs, public key verifies | many verifiers (e.g. OIDC) |

## How a JWT is prepared (signing)

Preparing a token is: **encode two JSON blobs → sign them → glue three parts together.** No
encryption, no storage — just hashing and encoding.

1. Build the **header** JSON (`{ alg, typ, ... }`).
2. Build the **payload** JSON (the claims: `sub`, `exp`, …).
3. **Base64URL-encode** each part (URL-safe: `+`→`-`, `/`→`_`, drop trailing `=`).
4. Concatenate them with a dot: `encodedHeader + "." + encodedPayload` — this is the **signing input**.
5. **Sign** that input with the algorithm's key.
6. Base64URL-encode the **signature** bytes.
7. Join with dots: `header.payload.signature`.

```js
import crypto from "node:crypto";

const b64url = (buf) =>
  Buffer.from(buf).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const now     = Math.floor(Date.now() / 1000);        // seconds, not ms
const header  = { alg: "HS256", typ: "JWT" };
const payload = { sub: "123", name: "Jane", iat: now, exp: now + 3600 };

const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
const sig   = crypto.createHmac("sha256", SECRET).update(input).digest();

const jwt = `${input}.${b64url(sig)}`;                 // header.payload.signature
```

What the signature actually is, per algorithm:

| `alg` | Signing operation |
| --- | --- |
| `HS256` | HMAC-SHA256 with a **shared secret** |
| `RS256` | RSASSA-PKCS1-v1_5 + SHA-256, **private key** signs |
| `ES256` | ECDSA P-256 + SHA-256, **private key** signs |

**Verification is the reverse:** split the token, recompute the signature over `header.payload` with
the key, compare it **constant-time**, then validate the claims (`exp`, `iss`, `aud`). The signing key
must match the verification key — the *same secret* for `HS*`, the *matching public key* for `RS*`/`ES*`.

Notes:
- `iat` / `exp` / `nbf` are **Unix seconds**, not milliseconds.
- Encoding ≠ encryption — both encoded parts stay readable.
- If you need confidentiality you want **JWE** (encrypted, five parts), which is a different thing.
- In real code, use a vetted library — the above only shows the mechanics.

### That example is HS256 only — `createHmac` can't do RS256/ES256

`crypto.createHmac("sha256", SECRET)` computes **HMAC-SHA256** — a *keyed hash*. That is exactly
`HS256`, and only the `HS*` family. HMAC is **symmetric**: the *same* secret signs and verifies.

`RS256` / `ES256` aren't HMAC at all — they're **public-key signatures** (RSA / ECDSA), where a
**private** key signs and the matching **public** key verifies. Different primitive, different Node
API. The `alg` in the header picks which one:

| JWT `alg` | Node call |
| --- | --- |
| `HS256` | `crypto.createHmac("sha256", secret)` |
| `RS256` | `crypto.sign("sha256", data, privateKey)` — RSA, PKCS#1 v1.5 padding |
| `ES256` | `crypto.sign("sha256", data, { key: ecPrivateKey, dsaEncoding: "ieee-p1363" })` |

```js
// RS256 — sign the signing input with the PRIVATE key (PKCS#1 v1.5 + SHA-256)...
const header = { alg: "RS256", typ: "JWT", kid: "2026-10-key-1" };
const input  = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;

const sig = crypto.sign("sha256", Buffer.from(input), privateKeyPem);
const jwt = `${input}.${b64url(sig)}`;                 // header.payload.signature

// ...and anyone verifies with the matching PUBLIC key.
const ok = crypto.verify("sha256", Buffer.from(input), publicKeyPem, sig);
```

```js
// ES256 — ECDSA P-256. JWT wants raw r‖s, so use ieee-p1363 (not the default DER).
const sig = crypto.sign("sha256", Buffer.from(input), {
  key: ecPrivateKeyPem,
  dsaEncoding: "ieee-p1363",
});
```

Note the first argument is the **hash** (`"sha256"`), not the JWT `alg` — and there is no single call
that handles every JWT algorithm; the `alg` selects the primitive.

## How it's used

- **Stateless auth:** the server issues a token at login; the client sends it back; the server
  verifies the signature and claims — **no session lookup**.

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

- **OAuth2 / OIDC:** access tokens and ID tokens are JWTs.

## Verify flow — what you must check

1. **Signature** is valid, using the **expected** algorithm.
2. **`exp` / `nbf`** — not expired / not premature.
3. **`iss` / `aud`** — from the issuer you expect, for *you*.
4. Only then trust the claims.

Skipping any of these is a real vulnerability, not a shortcut.

`HS256` — the receiver recomputes the MAC and compares (the reverse of the signing example):

```js
import { createHmac, timingSafeEqual } from "node:crypto";

function verifyHs256(token, secret) {
  const [headerB64, payloadB64, sigB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !sigB64) return null;          // malformed

  // 1. Recompute the MAC over the EXACT signing input, compare in constant time.
  const expected = createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const actual = Buffer.from(sigB64, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  const header  = JSON.parse(Buffer.from(headerB64,  "base64url").toString());
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());

  // 2. Pin the algorithm — never trust header.alg blindly.
  if (header.alg !== "HS256") return null;

  // 3. Validate the claims you rely on.
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now >= payload.exp) return null;             // expired
  if (payload.nbf && now <  payload.nbf) return null;             // not yet valid
  // if (payload.iss !== EXPECTED_ISSUER) return null;
  // if (payload.aud !== EXPECTED_AUDIENCE) return null;

  return payload;                                                 // trusted
}
```

`RS256` — the receiver verifies with the issuer's **public** key (anyone can):

```js
const ok = crypto.verify(
  "sha256",
  Buffer.from(`${headerB64}.${payloadB64}`),
  publicKeyPem,
  Buffer.from(sigB64, "base64url"),
);
```

(`Buffer`'s `"base64url"` encoding needs Node 15.7+.) As with signing, real code should use a vetted
library — this is just the mechanics.

## The tradeoff

- **Pros:** stateless, self-contained, scales without a shared session store.
- **Cons:** hard to **revoke** (valid until `exp`), grows with the claim set, replay risk.
  Mitigate with **short expiry + refresh tokens** (and a denylist only if you truly need it).

## Pitfalls / attacks

- **`alg: none`** — accepting unsigned tokens. Never trust the header's `alg`; use an allowlist.
- **Algorithm confusion** — verifying an `HS256` token using an `RS256` *public* key as the HMAC
  secret. Pin the algorithm.
- **Decode ≠ verify** — reading the payload and treating it as trusted.
- **Trusting claims blindly** — not checking `exp`, `aud`, `iss`.
- **Long-lived tokens** — no room to revoke; a stolen token is valid for a long time.
- **Storage** — `localStorage` is readable by any XSS; prefer `httpOnly` + `Secure` + `SameSite`
  cookies (or in-memory).
- **Secrets in the payload** — it's readable by anyone holding the token.
- **JWT everywhere** — a server-side session is simpler and more revocable when you don't need
  stateless.

## Best practices

- Verify with a **well-tested library** and an **allowlisted algorithm**.
- **Short `exp`** + refresh tokens.
- Prefer **`httpOnly` cookies** over `localStorage`.
- **Validate every claim** you rely on.
- Use **asymmetric keys** when many services must verify.
- Reach for a **session** by default; choose JWT deliberately.

## One-line summary

**A JWT is a signed, URL-safe string of claims (`header.payload.signature`) that lets a server verify
who the bearer is without storing a session — it's signed, not encrypted, so it proves integrity and
authenticity but hides nothing, and almost every failure comes from trusting the header's `alg` or
skipping claim checks.**

## References

- RFC 7519 — *JSON Web Token (JWT)* — <https://datatracker.ietf.org/doc/html/rfc7519>
- *jwt.io* (decoder + libraries) — <https://jwt.io>
- OWASP — *JSON Web Token Cheat Sheet* — <https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html>
- Related: `31-why-jwt-is-fast`, `23-hmac`, `27-base64-in-jwt`, `21-value-entity-identity`
