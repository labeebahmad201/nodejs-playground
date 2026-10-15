# Why JWT isn't a JSON object

*Why is a JWT a dot-separated string instead of `{ "header": …, "payload": …, "signature": … }`?
Three reasons — the decisive one is that the signature needs a **byte-exact** input, and JSON isn't
canonical.*

Part of the language-agnostic [`fundamentals/`](../) track. Companion to `27-base64-in-jwt` and
`22-jwt`.

## The three reasons

1. **The signature needs a byte-exact input.** It's computed over
   `base64url(header) + "." + base64url(payload)`. JSON has no canonical form — key order, whitespace,
   and escaping can differ between encoders — so signing one serialization and verifying another
   would break the signature. The fixed `.`-join is stable and reproducible.
2. **It must be one opaque string.** Headers, cookies, and URLs expect a single token with no spaces,
   commas, quotes, or braces. A JSON blob has all of those, so you'd have to escape it anyway.
3. **Compactness.** Tokens travel on *every* request; dots are far cheaper than repeated field names
   and quotes.

## Even the JSON serialization uses Base64

JWS does define a JSON serialization
(`{ "payload": "…", "protected": "…", "signature": "…" }`) for cases like **multiple signatures**. But
even there:

- `payload` and `signature` are still **Base64URL strings** — the signature is raw bytes.
- The signing input is still `BASE64URL(protected) + "." + BASE64URL(payload)`.

So a JSON envelope wraps the format but doesn't remove Base64 — it just adds overhead.

## One-line summary

**A JWT is a dot-separated Base64URL string, not JSON, because the signature needs a byte-exact
signing input (JSON isn't canonical), the token must be a single string that's safe in
headers/URLs/cookies, and it has to stay compact — and even JWS's JSON form still Base64-encodes the
payload and signature.**

## References

- RFC 7515 — *JSON Web Signature (JWS)* — compact and JSON serializations — <https://datatracker.ietf.org/doc/html/rfc7515>
- Related: `27-base64-in-jwt`, `22-jwt`, `25-base64`
