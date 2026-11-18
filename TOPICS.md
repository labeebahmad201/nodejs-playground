# Topics to look into

*A running queue of things to investigate. The first item is the current focus; add new ones at the bottom.*

## 1. Deadlocks

Two transactions each hold what the other needs, so neither can finish.

- **Reproduce one.** Two sessions, two rows, opposite order: `A → B` in one, `B → A` in the other.
- **Detection.** PostgreSQL waits `deadlock_timeout` (1s by default), walks the wait graph, and aborts one transaction with `40P01`. InnoDB does the same and reports `1213`. The victim is chosen by cost, not by fairness.
- **Prevention.** A consistent lock order, the smallest locked set, and the shortest transaction. All three reduce the chance that two wait graphs intersect.
- **Recovery.** Retry at the transaction boundary, with backoff, and only when the work is idempotent. A retry inside the same aborted transaction is not a retry.
- **Diagnosis.** `pg_locks`, `pg_blocking_pids()`, `log_lock_waits = on`, and the `deadlock detected` line in the server log.
- **Adjacent failures worth separating.** Deadlock (`40P01`), lock timeout (`55P03`), and serialization failure (`40001`) are three different events with three different fixes.
- **Open question.** How do you enforce a lock order when a repository or ORM loads rows in arbitrary order?

Related: [SELECT ... FOR UPDATE](design/concurrency-control/04-select-for-update.md) and [what a transaction guarantees](design/concurrency-control/02-what-a-transaction-guarantees.md).

## 2. mTLS

Transport-layer client identity: the server proves itself to the client, and the client proves itself to the server.

- **Already written up** in [TLS vs mutual TLS](security/01-tls-vs-mtls/README.md) — review whether the explanation still holds.
- **What is missing there:** a runnable demo. A tiny CA, an HTTPS server with `requestCert`/`rejectUnauthorized`, and a client that presents its certificate; one success and one rejection.
- **Certificate lifecycle:** issuing, rotation, expiry, revocation (CRL/OCSP), and the trust-store strategy that makes it operable.
- **Where TLS terminates:** the application, a gateway, or a service mesh — and the identity-header trap when a proxy terminates it.
- **The comparison:** mTLS versus OAuth2 client credentials versus HMAC-signed requests. Each answers "who is calling?" at a different layer.
- **The boundary:** mTLS identifies the workload, not the human user behind it.

## 3. Encryption vs hashing vs encoding (Base64)

Three operations that get conflated because they all "scramble" data, and each answers a different question.

- **Already covered** in [Hashing vs encryption vs encoding](fundamentals/24-hashing-encryption-encoding/README.md), with [Base64](fundamentals/25-base64/README.md), [HMAC](fundamentals/23-hmac/README.md), and [password hashing](fundamentals/29-password-hashing/README.md) alongside it.
- **The three questions:** encoding is for transport (reversible, no key), encryption is for confidentiality (reversible, with a key), hashing is for integrity and comparison (one-way, no key).
- **Where the confusion shows up:** Base64 presented as security, a hash used where encryption is needed, a password hashed with SHA-256, JWT signing mistaken for encryption.
- **What to add:** one decision table that starts from the goal ("Do I need to get it back? Does someone need a key?") rather than from the algorithm.

## 4. Cookies and sessions

A cookie carries a small piece of state; a session is what that state points at. The security lives in the attributes and in where the session record lives.

- **Cookie mechanics:** `Set-Cookie` attributes (`HttpOnly`, `Secure`, `SameSite`, `Path`, `Domain`, `Max-Age`/`Expires`), and the `__Host-` / `__Secure-` prefixes that stop a subdomain from overwriting them.
- **The session shape:** an opaque session ID in the cookie, with the record in Redis or the database. That gives revocation, logout everywhere, and idle versus absolute timeouts.
- **Stateless alternative:** a signed JWT in a cookie or header — no lookup, but revocation becomes a denylist or a short expiry. Compare it against server sessions rather than treating it as a replacement.
- **The attacks to design against:** session fixation (rotate the ID at login), CSRF (`SameSite` plus a token where it matters), XSS (`HttpOnly`), and theft over plain HTTP (`Secure`).
- **Node specifics:** `cookie`/`cookie-parser` for parsing, `express-session` for the store wiring, `req.session.regenerate()` on privilege change.
- **Related notes already in the repo:** [JWT](fundamentals/22-jwt/README.md), [why JWT isn't JSON](fundamentals/28-why-jwt-isnt-json/README.md), and [why JWT is fast](fundamentals/31-why-jwt-is-fast/README.md).
- **The boundary:** a cookie is a transport for a token. Authentication is the decision made after reading it.

## 5. Serialization vs deserialization

Serialization turns an object graph into bytes; deserialization turns bytes back into an object graph. The round trip is where types, trust, and compatibility get lost.

- **The lossy round trip:** `Date`, `Map`/`Set`, `BigInt`, `Buffer`, `undefined`, `NaN`, class identity, and cyclic references all behave differently once they cross a format boundary.
- **JSON specifics:** `undefined` disappears from objects and becomes `null` in arrays, `NaN` becomes `null`, `BigInt` throws, `Date` goes through `toJSON`, and the prototype is gone on the way back.
- **Deserialization is a trust boundary.** `JSON.parse` is data; `eval` and object-graph deserializers are code execution. Validate the parsed shape (zod, JSON Schema) instead of casting it, and watch for `__proto__` and YAML/XML payload tricks.
- **Compatibility:** unknown fields, renamed fields, defaults, and required-versus-optional. Protobuf field numbers and Avro schema registries exist because this is the hard part, not the encoding.
- **Canonical form:** anything signed must be signed over bytes, not objects — key order and number formatting differ between serializers. This is why [JWT isn't JSON](fundamentals/28-why-jwt-isnt-json/README.md).
- **Where it happens:** HTTP bodies ([DTOs](fundamentals/11-data-transfer-objects/README.md)), database rows to objects, cache values, queue messages, and logs. Each boundary has its own compatibility rule.
- **Node specifics:** `JSON.stringify`/`parse` with replacer and reviver, `toJSON`, `v8.serialize` for binary, and `structuredClone` for in-process copies.

## Also queued

- **Lock timeouts vs. deadlocks vs. serialization failures** — when to retry, when to fail, and which error reaches the user.
- **Phantom inserts** — PostgreSQL has no gap locks; InnoDB does. What each engine actually protects.
- **Retry budgets** — backoff, jitter, caps, and how a hot row turns optimistic control into a retry storm.
- **Fencing tokens** — why a lease is not a lock, and how a monotonic token makes an expired lease safe.
- **Isolation levels** — `READ COMMITTED`, `REPEATABLE READ`, `SERIALIZABLE`, and the anomalies each one still permits.
- **Connection pools under lock waits** — how a blocked transaction consumes a connection, and what saturation looks like before it becomes an outage.
