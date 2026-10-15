# Interview Questions — built from this repository

A living index of interview questions derived from **every topic in this repo**. Each question links to the lesson where the nuance is explained. Drill it: pick a category, answer out loud, then follow the link to check yourself.

- Every question maps to real material in the repository (no invented topics).
- Categories mirror the tracks: `nodejs/`, `reactjs/`, `networking/`, `fundamentals/`, `cloud/`, `ai/`.
- Format: **question → source**. If you can answer the whole set, you can defend the whole repo.

---

## 1. Node.js Runtime & the Event Loop

- What's the difference between user space and kernel space, and why does it matter for Node? → `nodejs/00-user-kernel-space`
- What is a syscall, and which Node operations are actually syscalls? → `nodejs/00-user-kernel-space`
- What is a file descriptor, and why are `stdin`/`stdout`/`stderr` `0`/`1`/`2`? → `nodejs/00-user-kernel-space`
- Walk through the event loop phases and what runs in each. → `nodejs/05-event-loop`
- What's the difference between `process.nextTick`, microtasks (promises), and macrotasks (timers)? → `nodejs/05-event-loop`
- Is `process.nextTick` *always* before promise callbacks? (the gotcha) → `nodejs/05-event-loop`
- What does `--noEmit` do, and why do we use it? → `nodejs/04-tsc-noemit`
- How do you type-check and run in a single command? → `nodejs/03-type-checking`
- How does Node decide whether a file is CJS or ESM? → `nodejs/06-modules`
- What are the key differences between CommonJS and ES modules, and how does interop work? → `nodejs/06-modules`
- What is `import.meta`, and why is it ESM-only? → `nodejs/09-import-meta`
- What's the difference between `import.meta.url` and `__filename`? → `nodejs/09-import-meta`
- What is `import.meta.main`? → `nodejs/09-import-meta`
- What is a worker thread, and how does it differ from a process? → `nodejs/08-worker-threads`
- "Node is single-threaded" — is it true? Explain the myth. → `nodejs/08-worker-threads`
- When should you reach for `worker_threads`, and what do they cost? → `nodejs/08-worker-threads`
- What does `--max-old-space-size` do, and when would you tune it? → `nodejs/15-v8-memory`

## 2. Node.js I/O, Networking & Sockets

- What does "I/O" actually mean, and what makes something I/O? → `nodejs/07-io`
- Why don't input and output happen together? → `nodejs/07-io`
- What's the difference between blocking and non-blocking I/O? → `nodejs/07-io`
- What's the difference between a listening socket and a connection socket? → `nodejs/13-sockets`
- How does the kernel route traffic to the right connection? → `nodejs/13-sockets`
- Why can one thread service many sockets? → `nodejs/13-sockets`
- TCP vs UDP — how do you choose? → `nodejs/13-sockets`
- What is `http.Agent` for, and what does `maxSockets` control? → `nodejs/12-http-agent`
- How does the agent decide which socket to reuse? → `nodejs/12-http-agent`
- What happens to file descriptors during a request lifecycle? → `nodejs/10-request-lifecycle`
- What is `X-Forwarded-For`, who sets it, and why does the string grow? → `nodejs/18-x-forwarded-for`
- How do you parse `X-Forwarded-For` correctly and safely? → `nodejs/18-x-forwarded-for`
- What are the sibling proxy headers, and what does `Host` do? → `nodejs/18-x-forwarded-for`

## 3. Node.js Streams

- What are the four stream types? → `nodejs/19-streams`
- What is backpressure, and why is it the important part? → `nodejs/19-streams`
- `.pipe()` vs `pipeline()` — what's the difference? → `nodejs/19-streams`
- What is `objectMode`? → `nodejs/19-streams`
- How do Node streams differ from Web Streams? → `nodejs/19-streams`
- How do you write a transform with async generators? → `nodejs/19-streams`

## 4. Node.js Memory & Performance

- What is a memory leak, really? → `nodejs/15-v8-memory`
- Why doesn't RSS come back down after GC? → `nodejs/15-v8-memory`
- What should you monitor — RSS, `heapUsed`, or `heapTotal`? → `nodejs/15-v8-memory`
- Why is high RSS not necessarily a leak? → `nodejs/15-v8-memory`
- Why can a dead variable still be a live GC root? → `nodejs/15-v8-memory`
- What is the most common Node memory-leak pattern, and how do you fix it? → `nodejs/16-memory-leak-cache`
- Why does a rate-limiter cache leak, and why is **cardinality** (not traffic) the trigger? → `nodejs/17-ratelimiter-leak`
- What signals would you alert on for a leak? → `nodejs/17-ratelimiter-leak`
- What is an off-heap leak, and how does it differ from a JS-heap leak? → `nodejs/22-offheap-stream-leak`
- How would you detect an off-heap leak in production? → `nodejs/22-offheap-stream-leak`

## 5. Node.js Language & Tooling

- What are truly private class fields, and how do they differ from `_` and TypeScript `private`? → `nodejs/20-private-fields`
- How does the `#x in obj` brand check work? → `nodejs/20-private-fields`
- What's the difference between stdout, stderr, and `console.log`? → `nodejs/21-stdout-vs-console`
- When should you write to stderr vs stdout? → `nodejs/21-stdout-vs-console`
- `npm` vs `npx` — what's the difference, and how does `npx` resolve a command? → `nodejs/14-npx`
- What are the security footguns of running packages with `npx`? → `nodejs/14-npx`

## 6. React

- Why does React exist? What problem does it solve? → `reactjs/00-why-react`
- What's the difference between a library and a framework, and where does React fit? → `reactjs/00b-library-vs-framework`
- What is state, and why do function components "forget"? → `reactjs/03-useState`
- Why is state a snapshot, not a live variable? → `reactjs/03-useState`
- What are the rules of hooks, and why do they exist? → `reactjs/03-useState`
- When should you lift state up, and how do you choose initial state? → `reactjs/03-useState`
- What does `useMemo` do, and what are its two jobs? → `reactjs/08-memoization`
- When should you **not** use `useMemo`? → `reactjs/08-memoization`
- What is `Object.is`, and why does React use it instead of `===`? → `reactjs/08b-object-is`
- How do hook dependency arrays and `React.memo` rely on `Object.is`? → `reactjs/08b-object-is`
- Why does mutating state fail to trigger a re-render? → `reactjs/08b-object-is`

## 7. Networking

- Name the seven OSI layers and what each does. → `networking/01-osi-model`
- What's the difference between the media layers and the host layers? → `networking/01-osi-model`
- What does the "layer X device" rule mean? → `networking/01-osi-model`
- Why can't layer 1 stop collisions? → `networking/01-osi-model`
- What is a hub, and why is it a layer-1 device? → `networking/01-osi-model`

## 8. Design & Architecture Fundamentals

- What are the two rules of a pure function? → `fundamentals/01-pure-functions`
- What is the "functional core, imperative shell" pattern? → `fundamentals/01-pure-functions`
- Why must a render function be pure? → `fundamentals/01-pure-functions`
- What is inversion of control, and what exactly gets inverted? → `fundamentals/02-inversion-of-control`
- What's the difference between IoC, DI, DIP, and a DI container? → `fundamentals/02-inversion-of-control`
- What is the Hollywood Principle? → `fundamentals/02-inversion-of-control`
- When should you `new` a value object vs inject a collaborator? → `fundamentals/03-value-objects-vs-collaborators`
- Why is internally `new`-ing a collaborator brittle and untestable? → `fundamentals/03-value-objects-vs-collaborators`
- What is a value object, and how does it differ from an entity? → `fundamentals/04-value-objects`
- What is an entity, and where does identity come from? → `fundamentals/05-entities`
- What is a collaborator, and why does the word matter? → `fundamentals/06-collaborators`
- What is an aggregate, and what is it for (consistency boundary)? → `fundamentals/07-aggregates`
- What is a repository, and how does it differ from a DAO? → `fundamentals/08-repositories`
- What is a domain service, and how does it differ from an application service? → `fundamentals/09-domain-services`
- What is a domain event, and how does it differ from a command and an integration event? → `fundamentals/10-domain-events`
- What is a DTO, and why does it exist? → `fundamentals/11-data-transfer-objects`
- What is a factory for, and when is it overkill? → `fundamentals/12-factories`
- What does a framework own vs what do you own? → `fundamentals/13-frameworks-and-business-logic`
- How does DI let you keep business logic in its own place? → `fundamentals/13-frameworks-and-business-logic`
- What is state, and how does it differ from derived state and sources of truth? → `fundamentals/14-state`
- What is the anemic domain model, and why is it a problem? → `fundamentals/15-anemic-domain-model`
- How is the anemic model different when it arrives via DTOs? → `fundamentals/16-anemic-domain-via-dtos`
- Where should business rules come from — the type or the database? → `fundamentals/16-anemic-domain-via-dtos`
- What does "framework-free domain" mean, and what is the dependency rule? → `fundamentals/17-framework-free-domain`
- How do you spot a framework leaking into the domain? → `fundamentals/17-framework-free-domain`
- What are the two classic ways a framework leaks into the domain, and how do you fix them? → `fundamentals/18-framework-leaks-into-domain`
- What is a port and an adapter, and where does each live? → `fundamentals/18-framework-leaks-into-domain`
- Why do you need a mapper between the domain entity and the persistence record? → `fundamentals/18-framework-leaks-into-domain`
- Why use `reconstitute` instead of the constructor when loading from the database? → `fundamentals/18-framework-leaks-into-domain`
- How do you make the business case for structure to non-engineers? → `fundamentals/19-the-business-case`

## 9. Identity & Security Fundamentals

- What's the difference between a value, an entity, and identity? → `fundamentals/21-value-entity-identity`
- When do you reach for a value object vs an entity vs identity? → `fundamentals/21-value-entity-identity`
- What is a JWT, and what are its three parts? → `fundamentals/22-jwt`
- What is the JWT header, and which fields matter? → `fundamentals/22-jwt`
- Is a JWT encrypted? What does the signature actually guarantee? → `fundamentals/22-jwt`
- What are the registered claims, and which must you validate? → `fundamentals/22-jwt`
- `HS256` vs `RS256` vs `ES256` — how do they differ? → `fundamentals/22-jwt`
- How is a JWT prepared (signed), step by step? → `fundamentals/22-jwt`
- Why can't `createHmac` produce an `RS256` token? → `fundamentals/22-jwt`
- How do you verify a JWT, and what must you check? → `fundamentals/22-jwt`
- What are the common JWT attacks, and how do you prevent them? → `fundamentals/22-jwt`
- What is HMAC, and what does it guarantee? → `fundamentals/23-hmac`
- How does HMAC work, and why the double hash? → `fundamentals/23-hmac`
- HMAC vs a plain hash vs a signature vs encryption — which gives what? → `fundamentals/23-hmac`
- Why compare MACs with `timingSafeEqual` instead of `===`? → `fundamentals/23-hmac`
- What's the difference between hashing, encryption, and encoding? → `fundamentals/24-hashing-encryption-encoding`
- Why do passwords need a salt and a slow hash instead of SHA-256? → `fundamentals/24-hashing-encryption-encoding`
- What category does bcrypt fall into, and why? → `fundamentals/24-hashing-encryption-encoding`
- Why do we use Base64, and what is it for? → `fundamentals/25-base64`
- Is Base64 encryption? What is Base64URL and why does it exist? → `fundamentals/25-base64`
- What does `Buffer.from` do, and why does the encoding argument matter? → `fundamentals/26-buffer-from`
- `Buffer.from(buffer)` vs `Buffer.from(arrayBuffer)` — copy or view? → `fundamentals/26-buffer-from`
- Why is `new Buffer()` deprecated? → `fundamentals/26-buffer-from`
- Why do we use Base64 with JWT? → `fundamentals/27-base64-in-jwt`
- Why isn't a JWT a JSON object? → `fundamentals/28-why-jwt-isnt-json`
- Why do passwords need a salted, slow hash (bcrypt/Argon2)? → `fundamentals/29-password-hashing`
- Why is `timingSafeEqual` used instead of `===`? → `fundamentals/30-timing-safe-compare`
- Why is JWT verification fast while password hashing is slow? → `fundamentals/31-why-jwt-is-fast`

## 10. Cloud

- Why are AWS accounts the first cloud topic? → `cloud/01-aws-accounts`
- What are the sub-topics around accounts and IAM users? → `cloud/01-aws-accounts`

## 11. AI & Engineering Practice

- Every prompt forks into one of two outcomes — what are they? → `ai/output-vs-understanding`
- Why does "slop" compound, and how do you avoid it? → `ai/output-vs-understanding`
- How did AI move the engineering bottleneck? → `articles/ai-bottleneck-shift.md`
- Why is understanding still the bottleneck in the AI age? → `ai/output-vs-understanding`
- Why is high RSS not a leak, and how do you reproduce a production leak locally? → `articles/nodejs-memory-leak.md`

---

## Notes

- **Keep it growing.** When a new dir lands, add its questions here under the right category.
- **Question form only.** The nuance is the *answer*; the link is where to verify it.
- Some topics (e.g. `reactjs/README.md`, `nodejs/ROADMAP.md`, `CLOUD.md`) are roadmaps/indexes rather than lessons — their questions live here once the lesson dirs exist.