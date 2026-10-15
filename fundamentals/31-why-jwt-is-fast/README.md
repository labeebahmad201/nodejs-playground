# Why JWT is fast and passwords are slow

*JWT verification uses SHA-256 (inside HMAC) because it's **fast** and built for **data integrity**.
Password checks use bcrypt because it's **intentionally slow** and built to **resist brute-force
attacks**.*

Part of the language-agnostic [`fundamentals/`](../) track. See also `22-jwt`, `29-password-hashing`,
and `23-hmac`.

## The one contrast

| | JWT verification | Password check |
| --- | --- | --- |
| **Purpose** | data integrity — prove it wasn't tampered with | resist brute-force guessing |
| **Speed** | **fast** (`HMAC-SHA256`) | **intentionally slow** (bcrypt / Argon2) |
| **Why** | runs on *every* request, so cheap is good | a leaked hash is an offline target, so each guess must be expensive |

## Notes

- JWT uses **HMAC-SHA256** (`HS256`) — SHA-256 is the hash, HMAC adds the key. A bare SHA-256 isn't a
  keyed signature, so it can't authenticate a token on its own.
- A plain SHA-256 password hash is **too fast** → trivially brute-forced. bcrypt is slow **and salted**
  on purpose.

## One-line summary

**JWT verification uses HMAC-SHA256 because it's fast and provides data integrity, while password
checks use bcrypt because it's deliberately slow to resist brute-force attacks.**

## References

- OWASP — *Password Storage Cheat Sheet* — <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>
- RFC 7519 — *JSON Web Token (JWT)* — <https://datatracker.ietf.org/doc/html/rfc7519>
- Related: `22-jwt`, `29-password-hashing`, `23-hmac`
