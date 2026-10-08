# Roadmap

Living list of topics to document. Each **example** lives in its own numbered
directory (`{n}-{name}`) with a `README.md`; (where relevant) load tests too.
Example-dir numbering is independent of the topic numbers below — the *Example dirs*
column lists what has actually been built for each topic.

Status: `[ ]` not started · `[~]` in progress · `[x]` done

## Modules

| #  | Topic                        | Example dirs                 | Status | Notes |
|----|------------------------------|------------------------------|--------|-------|
| 1  | Node.js basics               | `1-hello-world`, `2-http-server` | [x] | hello world, minimal http server · book ch1 |
| 2  | Event loop & async model     | `5-event-loop`               | [x]    | phases, microtasks, blocking; CJS vs ESM nextTick order · book App. A (delay, utilization) |
| 3  | Modules (ESM / CJS)          | `6-modules`                  | [x]    | .mjs vs .cjs, package.json "type", interop, import.meta · book ch5 (module mgmt) |
| 4  | TypeScript setup             | `3-type-checking`, `4-tsc-noemit` | [x] | `tsc --noEmit`, type stripping limits · book ch2 |
| 5  | Async patterns               | `5-async-patterns`           | [ ]    | promises, AbortController, concurrency limits |
| 6  | Error handling               | `6-error-handling`           | [ ]    | placeholder · book ch2 (meaningful errors/logs) |
| 7  | Streams & backpressure       | `7-streams`                  | [ ]    | placeholder |
| 8  | Caching                      | `8-caching`                  | [ ]    | lru, stale-while-revalidate, HTTP caching · book ch3 |
| 9  | Graceful shutdown            | `9-graceful-shutdown`        | [ ]    | signals, drain, close connections · book ch2 (close-with-grace) |
| 10 | Environment & secrets        | `10-environment`             | [ ]    | 12-factor, config anti-patterns · book ch4 |
| 11 | Logging                      | `11-logging`                 | [ ]    | structured logs, Pino · book ch2 |
| 12 | Performance                  | `12-performance`             | [ ]    | event-loop lag/utilization, benchmarks · book App. A |
| 13 | Profiling                    | `13-profiling`               | [ ]    | --cpu-prof, flamegraphs |
| 14 | Node modules exploration     | `14-node-modules`            | [ ]    | placeholder |
| 15 | Load testing                 | `15-load-testing`            | [ ]    | artillery, autocannon |
| 16 | Testing                      | `16-testing`                 | [ ]    | node:test unit/integration · book ch2 |
| 17 | Flaky tests                  | `17-flaky-tests`             | [ ]    | placeholder |
| 18 | Stuck processes & handles    | `18-stuck-processes`         | [ ]    | placeholder |
| 19 | HTTP server                  | `19-http-server`             | [ ]    | Fastify, plugins, hooks · book ch2 |
| 20 | HTTP clients                 | `20-http-clients`            | [ ]    | undici, keep-alive, retries · book ch2 |
| 21 | App health & observability   | `21-app-health`              | [ ]    | metrics, health checks, OpenTelemetry · book ch7 |
| 22 | Fault tolerance              | `22-fault-tolerance`         | [ ]    | retries, timeouts, circuit breakers · book ch7 |
| 23 | Workers & scaling            | `23-workers`                 | [ ]    | worker_threads, cluster · book ch7 (scaling) |
| 24 | Capstone                     | `24-capstone`                | [ ]    | placeholder |
| 25 | SSR frontends                | `25-ssr`                     | [ ]    | server-side rendering, Next.js · book ch3 |
| 26 | App architecture & DI        | `26-architecture`            | [ ]    | modularity, dependency injection, monolith→microservices · book ch5 |
| 27 | Containerization             | `27-containers`              | [ ]    | Dockerfile, multi-stage build, non-root · book ch6 |
| 28 | Orchestration & cloud        | `28-cloud`                   | [ ]    | Kubernetes, serverless, Node-aware scaling signals · book ch6 |
| 29 | Runtime validation           | `29-validation`              | [ ]    | JSON Schema, Ajv, TypeBox · book ch2 |
| 30 | Database integration         | `30-database`                | [ ]    | connections, pooling, migrations · book ch2 |
| 31 | I/O fundamentals             | `7-io`                       | [x]    | input vs output, blocking vs non-blocking; cited refs |

## Sources / references

Material used to shape these topics. Reference only — no content is copied into the repo.

- **The Definitive Guide for Node.js in Enterprise** — Platformatic (292 pp).
  Chapters: 1 Intro / Node basics · 2 Creating APIs with Fastify · 3 Building SSR
  Frontends · 4 Managing Configurations · 5 Structuring Large Applications ·
  6 Running Node.js in the Cloud · 7 Ensuring Scalability & Resilience ·
  8 Using Platformatic (commercial product — optional) · A Appendix: The Node.js
  Event Loop. Rows above tagged `book chN` map to this.
  Local copy (not committed): `~/Downloads/The Definitive Guide for NodeJs in Enterprise.pdf`.
- **node skill** (`mcollina/skills`) — 15 Node.js rules; basis for the original topic list.
- **I/O definitions** (for `7-io`): Wikipedia *Input/output*; IBM z/OS Basic Skills
  *Input and output*; NIST CSRC glossary *Input/Output (I/O)*; Yale CS/Aspnes
  *InputOutput*. Full links in `7-io/README.md`.

## Deferred / later

- TypeScript before type stripping — how it was done pre-Node-native TS (`ts-node`,
  `tsx`, `tsc` build / transpile step). Document later, not immediate.

## Ideas / unassigned

- Platformatic / Watt hands-on (commercial — optional).
- Event-loop delay & utilization deep-dive using `perf_hooks` (`monitorEventLoopDelay`,
  `performance.eventLoopUtilization`) — book Appendix A.
- Monitoring: instrument the **event loop**, the **app** (latency, throughput, errors,
  ops/sec), and **garbage collection** (`PerformanceObserver` GC entries, `--trace-gc`,
  `v8.getHeapStatistics`).
- GC vs memory leak: learn to tell them apart. GC is healthy and bounded (sawtooth heap
  that recovers); a leak is unbounded (heap baseline rises and never returns). Cover the
  signals — heap-used trend, `--expose-gc` + `gc()`, heap snapshots / `--inspect`, and
  `process.memoryUsage()` — and how to distinguish a live-body signal from a transient spike.
- Streams vs `async` iteration for large payloads.

### I/O modules to cover (examples later)

One small example per `node:` module that performs I/O — tick off as built.

- [ ] `node:fs` — files (callback / sync / `fs.promises` / streams)
- [ ] `node:net` — TCP & Unix sockets
- [ ] `node:http`, `node:https`, `node:http2` — web
- [ ] `node:dgram` — UDP
- [ ] `node:dns` — name resolution
- [ ] `node:child_process` — `spawn` / `exec`
- [ ] `node:zlib` — compression (threadpool)
- [ ] `node:crypto` — async crypto ops (threadpool)
- [ ] `node:tls` — TLS sockets
- [ ] `node:stream`, `node:readline`, `readline/promises` — streaming I/O
- [ ] `node:worker_threads` — message passing
- [ ] `process` — stdin / stdout / stderr

(Which use the OS event queue vs libuv's threadpool: see `7-io/README.md`.)

## How to add a topic

1. Pick the next example number and name the directory `{n}-{name}`.
2. Add the code plus a `README.md` (one directory per example).
3. Update the table row (status + Example dirs).
