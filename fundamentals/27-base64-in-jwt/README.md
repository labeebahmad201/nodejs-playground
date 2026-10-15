# Why JWT uses Base64 (Base64URL)

*A JWT is meant to travel as a **string** — in HTTP headers, URLs, and cookies. Its parts are JSON
(and raw signature bytes), which don't survive those channels as-is. Base64URL turns them into safe
text, and `.` joins them. It's about **transport**, not secrecy.*

Part of the language-agnostic [`fundamentals/`](../) track. Companion to `22-jwt`, `25-base64`, and
`26-buffer-from`.

## The short answer

A JWT is `header.payload.signature`. Each part is **Base64URL-encoded**, so the whole thing is one
clean, text-safe string you can drop into a header, URL, or cookie.

## Why not just send the JSON?

- The **signature is raw bytes** — not text at all, so it *has* to be encoded.
- JSON contains `{ } " , :`, spaces, and newlines — illegal or messy in headers, URLs, and cookies.
- Encoding everything into a safe alphabet and joining with dots gives one portable string.

## Why Base64URL and not normal Base64?

JWTs travel through places where `+`, `/`, and `=` are special:

- `+` and `/` have meaning in URLs and break query strings and paths.
- `=` shows up in query params and cookies.

**Base64URL** replaces `+`→`-`, `/`→`_`, and drops `=` padding — so it's safe in all of those places.

## Why dots between the parts?

`.` is **not** in the Base64URL alphabet, so it can never appear *inside* a part. That makes it a
reliable separator: split the token on `.` and you always get exactly three parts.

## It's about transport, not secrecy

Base64 is not encryption. Anyone can decode the header and payload and read them. The signature only
proves the token wasn't changed — it hides nothing.

## Example

```js
const part = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

const header = part({ alg: "HS256", typ: "JWT" });
// "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
// token = `${header}.${payload}.${signature}`   — all Base64URL
```

## One-line summary

**JWT uses Base64URL because a token has to survive as a string in headers, URLs, and cookies — its
JSON and raw signature bytes aren't text-safe, and `+ / =` are unsafe in URLs. Base64URL gives a safe
alphabet, and dots give an unambiguous separator. It's transport, not encryption.**

## References

- RFC 7519 — *JSON Web Token (JWT)* — <https://datatracker.ietf.org/doc/html/rfc7519>
- RFC 7515 — *JSON Web Signature (JWS)* — <https://datatracker.ietf.org/doc/html/rfc7515>
- RFC 4648 §5 — *Base64URL* — <https://datatracker.ietf.org/doc/html/rfc4648#section-5>
- Related: `28-why-jwt-isnt-json`, `22-jwt`, `25-base64`, `26-buffer-from`
