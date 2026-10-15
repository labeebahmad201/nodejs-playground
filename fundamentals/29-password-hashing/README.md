# Password hashing — why a plain hash isn't enough

*Storing passwords is not "hash it with SHA-256." A fast hash is the wrong tool: it lets attackers try
billions of guesses a second, and without a **salt** it leaks which users share a password. Passwords
need a **salted, slow (adaptive)** hash — bcrypt, scrypt, or Argon2.*

Part of the language-agnostic [`fundamentals/`](../) track. Deep dive behind
`24-hashing-encryption-encoding`.

## The problem: fast hashes are the wrong tool

`SHA-256` and `MD5` are designed to be **fast**. That's great for integrity, terrible for passwords —
a GPU tries **billions of guesses per second**, so a weak or reused password falls quickly. And even
before speed, a bare hash leaks two things:

- **No salt → rainbow tables.** A precomputed table maps common hashes back to their passwords.
- **Identical passwords → identical hashes.** One cracked password reveals every user who shares it.

## The two requirements

1. **Salt** — a random value per password, stored **with** the hash. It makes every hash unique, which
   defeats rainbow tables and hides identical passwords. (A salt is **not secret** — its job is
   uniqueness, not secrecy.)
2. **Slow / adaptive** — a tunable **work factor** so each guess costs real time. "Adaptive" means you
   can raise it as hardware gets faster.

## What a password hash actually does

It takes `(password, salt, cost)` and produces one string that **embeds the algorithm, cost, and
salt**, so you don't store them separately:

```text
$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj...
 │   │  └── salt + hash
 │   └── cost factor (2^12 rounds)
 └── algorithm/version (bcrypt v2b)
```

**Verification** re-hashes the *attempt* with the stored salt and cost, then compares (constant-time):

```js
// illustrative — use the library's verify, never compare by hand
await bcrypt.compare(attempt, storedHash); // bcrypt → boolean
await argon2.verify(storedHash, attempt);  // Argon2 → boolean
```

## The algorithms

| Algorithm | Built on | Cost knob | Memory-hard? | Notes |
| --- | --- | --- | --- | --- |
| **bcrypt** | Blowfish | cost (`2^cost` rounds) | no | battle-tested; **72-byte input limit** |
| **scrypt** | PBKDF2 + memory | `N`, `r`, `p` | yes | good, older |
| **Argon2id** | custom | memory, iterations, parallelism | yes | modern winner (PHC 2015) — preferred |
| **PBKDF2** | iterated HMAC | iteration count | no | FIPS-approved fallback; not memory-hard |

**Why "memory-hard" matters:** GPUs and ASICs are excellent at *parallel* hashing. Memory-hard
functions force each guess to use lots of RAM, wiping out that hardware advantage.

## How to choose

- **Prefer Argon2id**; **bcrypt** is a solid, widely available choice; scrypt is fine; PBKDF2 is the
  fallback.
- **Tune the cost** so a single hash takes a noticeable slice of time (OWASP: bcrypt cost ≥ 10;
  Argon2id ≈ 19 MiB memory, t=2, p=1, or higher).
- **Salt** ≥ 16 random bytes (libraries do this for you).

## What NOT to do

- **Plain `MD5` / `SHA-1` / `SHA-256`** — fast and (usually) unsalted.
- **"Encrypting" passwords** — reversible; a leaked key exposes everyone.
- **Home-grown schemes** — concatenating, rolling your own salt/pepper, or inventing a KDF.
- **Reusing one salt** for all users — re-enables rainbow tables.
- **A too-low cost** — defeats the point.
- **Comparing with `==`** — use the library's constant-time compare.

## Upgrading over time

Because the algorithm and cost are stored *in* the hash, you can raise the cost later and **rehash on
the next successful login** — no forced password reset needed.

## One-line summary

**Passwords need a salted, slow, adaptive hash (bcrypt/scrypt/Argon2), not a fast general hash like
SHA-256 — the salt makes each hash unique and kills rainbow tables, and the tunable work factor makes
each guess expensive, while a plain fast hash lets attackers try billions of guesses a second.**

## References

- OWASP — *Password Storage Cheat Sheet* — <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>
- RFC 9106 — *Argon2* — <https://datatracker.ietf.org/doc/html/rfc9106>
- NIST — *SP 800-63B, Digital Identity Guidelines* — <https://pages.nist.gov/800-63-3/sp800-63b.html>
- Related: `24-hashing-encryption-encoding`, `23-hmac`, `22-jwt`
