# Hashing vs encryption vs encoding (Base64)

*Three things that all "scramble" data and get confused constantly. **Encoding** (Base64) is
reversible by anyone — it's just a representation. **Encryption** is reversible *with a key* — it's
for confidentiality. **Hashing** is one-way — it's for integrity/verification, not secrecy. Picking
the wrong one is a security bug.*

Part of the language-agnostic [`fundamentals/`](../) track. The "which tool?" companion to `23-hmac`
and `22-jwt`.

## The one-line difference

| | Reversible? | Needs a key? | Purpose |
| --- | --- | --- | --- |
| **Encoding** (Base64) | yes — by anyone | no | move/format data |
| **Encryption** | yes — with the key | yes | confidentiality |
| **Hashing** | no (one-way) | no | integrity / fingerprint |
| **HMAC** | no (one-way) | yes (shared) | integrity + authenticity |

## Encoding — Base64

Reversible by **anyone**, no key. It is a **representation**, not protection. It exists to carry
binary bytes using only text-safe characters (`A–Z a–z 0–9 + / =`), so they survive email, URLs, JSON,
and HTTP headers. Base64 grows data by ~33%.

**Base64URL** is the URL-safe variant (`+`→`-`, `/`→`_`, drop `=` padding) — the form used in JWTs.

```js
Buffer.from("hi").toString("base64");      // "aGk="
Buffer.from("aGk=", "base64").toString();  // "hi"  — anyone can reverse this
```

## Encryption — reversible *with a key*

Protects **confidentiality**: with the key you get the plaintext back. The hard part isn't the cipher,
it's **key management**.

- **Symmetric** (`AES`): one key both encrypts and decrypts — fast, used for bulk data.
- **Asymmetric** (`RSA`): a public key encrypts, the private key decrypts (and vice versa for
  signatures) — used to exchange keys and sign.

```js
// AES-256-GCM (authenticated encryption) — illustrative
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
// ...decryptable later with the same key.
```

## Hashing — one-way

Produces a **fixed-size fingerprint** you cannot reverse. Deterministic: same input → same hash.

```js
crypto.createHash("sha256").update("hello").digest("hex");
// 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
```

Use it for integrity checks, dedup, hash tables, signatures, and password storage. It is **not
secrecy**: you can't recover the input, but you *can* brute-force a weak one.

### Passwords need more than a hash

Fast hashes (`SHA-256`, `MD5`) are too fast — attackers try billions per second. Password storage uses
a **slow, salted** hash:

- **Salt** — a random per-password value stored with the hash; defeats rainbow tables and identical-password detection.
- **Slow** — `bcrypt`, `scrypt`, `Argon2`; deliberately expensive to make guessing costly.

```js
// use Argon2 or bcrypt for passwords — never raw SHA-256
```

## Keyed hashing (HMAC)

Adding a **key** to a hash also gives **authenticity** — that's `23-hmac`, and it's what JWT `HS256`
uses. (Signatures — `RS256` — are the asymmetric equivalent.)

## Common mistakes

- **Base64 ≠ secure.** Config "encrypted" but really just base64-encoded — anyone can read it.
- **"Encrypting" passwords.** You should **hash + salt** (bcrypt/Argon2). Encryption implies you can
  get the passwords back.
- **Fast hash for passwords.** `MD5`/`SHA-256` are brute-forced trivially — use a slow KDF.
- **Hashing something you need back.** Hashes are one-way; if you must recover it, you wanted encryption.
- **Assuming a JWT payload is secret.** It's Base64URL — **signed, not encrypted** (`22-jwt`).
- **Rolling your own crypto.** Use vetted libraries.

## How to choose

1. Need to **get the data back** and it's sensitive? → **encrypt**.
2. Need to **verify** it wasn't changed (and maybe who sent it)? → **hash** (or **HMAC** if keyed).
3. Just need to **move/format** it? → **encode**.

## One-line summary

**Encoding (Base64) is a reversible, keyless representation; encryption is reversible *with a key* and
gives confidentiality; hashing is one-way and gives integrity — and confusing them (base64 as
"security", fast hashes for passwords, "encrypting" passwords) is a recurring class of security bug.**

## References

- OWASP — *Password Storage Cheat Sheet* — <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>
- RFC 4648 — *The Base16, Base32, and Base64 Data Encodings* — <https://datatracker.ietf.org/doc/html/rfc4648>
- NIST — *FIPS 180-4, Secure Hash Standard* — <https://csrc.nist.gov/pubs/fips/180-4/upd1/final>
- Related: `29-password-hashing`, `23-hmac`, `25-base64`, `26-buffer-from`, `22-jwt`
