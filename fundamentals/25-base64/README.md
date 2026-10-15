# Base64 — turning bytes into text

*Base64 turns binary data (bytes) into plain text characters, so it can travel through places that
only handle text. It is **not** encryption — anyone can decode it.*

Part of the language-agnostic [`fundamentals/`](../) track. See also
`24-hashing-encryption-encoding` and `26-buffer-from`.

## Why it exists

Some channels can only carry **text** — email, URLs, JSON, config files. Raw bytes go from `0` to
`255` and include control characters and symbols that break those formats. Base64 converts any bytes
into a safe, fixed set of characters: `A–Z`, `a–z`, `0–9`, `+`, `/` (plus `=` for padding).

## How it works (simply)

- Each Base64 character carries **6 bits**, so **3 bytes (24 bits) become 4 characters**.
- That makes the data about **33% bigger**.
- `=` is padding that fills out the last group.

```js
Buffer.from("hi").toString("base64");      // "aGk="
Buffer.from("aGk=", "base64").toString();  // "hi"
```

## What it is NOT

- **Not encryption** — no key; anyone can decode it.
- **Not compression** — it makes data *bigger*.
- **Not security** — never use it to protect anything.

## Where you see it

- Email attachments
- Images inline in HTML — `<img src="data:image/png;base64,...">`
- JSON / APIs carrying binary (images, certificates, keys)
- JWT tokens (`22-jwt`)
- HTTP Basic auth — `Authorization: Basic base64(user:pass)`
- PEM files — `-----BEGIN CERTIFICATE-----`

## Base64URL

The URL-safe version: `+`→`-`, `/`→`_`, and usually no `=` padding — because `+`, `/`, and `=` are
special in URLs. This is the form JWT uses.

## Watch out

- **Thinking it's encryption** — "encrypted" config that's really just Base64.
- **Normal Base64 in a URL** — breaks on `+` and `/`; use Base64URL.

## One-line summary

**Base64 turns bytes into safe text characters so binary data can travel through text-only channels —
it's just a representation, not encryption and not compression.**

## References

- RFC 4648 — *The Base16, Base32, and Base64 Data Encodings* — <https://datatracker.ietf.org/doc/html/rfc4648>
- Related: `27-base64-in-jwt`, `26-buffer-from`, `24-hashing-encryption-encoding`, `22-jwt`
