# Roadmap

Living list of topics to document. Each **example** lives in its own numbered
directory (`{n}-{name}`) with a `README.md`; (where relevant) load tests too.
Example-dir numbering is independent of the topic numbers below — the *Example dirs*
column lists what has actually been built for each topic.

Status: `[ ]` not started · `[~]` in progress · `[x]` done

## 0. OS & runtime fundamentals (primer)

`worker_threads`, the event loop, I/O, performance and limits are thin JS layers over OS
primitives. Learn these first and the rest reads as obvious. Read before (or alongside)
topics 2 (event loop), 23 (workers) and 31 (I/O). Every claim below is sourced.
Example dir: `0-user-kernel-space` (user vs kernel space, syscalls) and
`10-request-lifecycle` (watch a request allocate fds/sockets live).

- **Process vs thread** — a process owns memory and at least one thread; threads in one
  process share the address space (so they share memory, which is why data races are even
  possible). A worker is a *thread*, not a process.
  — OSTEP, *Concurrency: An Introduction* <https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf>;
  Wikipedia, *Process* <https://en.wikipedia.org/wiki/Process_(computing)> and *Thread*
  <https://en.wikipedia.org/wiki/Thread_(computing)>.
- **Address space & virtual memory** — each process gets its own virtual address space;
  memory is mapped to physical RAM via paging. This is why a worker's "own heap" is a
  region inside one process's address space, not a separate process.
  — OSTEP, *Address Spaces* <https://pages.cs.wisc.edu/~remzi/OSTEP/vm-intro.pdf>.
- **Kernel vs user mode & syscalls** — user code traps into the kernel for privileged work
  (I/O, allocation, thread creation); each trap is a mode switch with real cost.
  — Linux `syscalls(2)` <https://man7.org/linux/man-pages/man2/syscalls.2.html>.
- **File descriptors** — the kernel exposes I/O as small integer handles; `stdin`/`stdout`/
  `stderr` are `0`/`1`/`2`. Sockets, pipes and worker message channels all consume fds.
  — Linux `open(2)` <https://man7.org/linux/man-pages/man2/open.2.html>, `pipe(2)`
  <https://man7.org/linux/man-pages/man2/pipe.2.html>; Wikipedia, *File descriptor*
  <https://en.wikipedia.org/wiki/File_descriptor>.
- **OS scheduler & preemption** — the kernel time-slices runnable threads across cores and
  preempts them; more runnable threads than cores means context-switch overhead, not more
  throughput.
  — OSTEP, *Scheduling: Introduction* <https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf>.
- **Concurrency vs parallelism** — concurrency is interleaving work on one core (the event
  loop); parallelism is simultaneous execution on many cores (worker threads). The event
  loop gives concurrency, not parallelism.
  — Rob Pike, *Concurrency is not Parallelism* <https://go.dev/blog/waza-talk>;
  Node.js, *The event loop, timers, and `process.nextTick()`*
  <https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick>;
  Node.js, *Don't Block the Event Loop* <https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop>.
- **Memory: stack vs heap, GC, RSS vs virtual** — each thread has its own stack while the
  heap/objects are managed by V8's garbage collector; virtual reservations (e.g. a worker's
  code range) are not resident memory until touched.
  — V8, *Trash talk: the Orinoco garbage collector* <https://v8.dev/blog/trash-talk>;
  Node.js, `process.memoryUsage()` <https://nodejs.org/api/process.html#processmemoryusage>;
  Node.js, `--max-old-space-size` <https://nodejs.org/api/cli.html#--max-old-space-sizesize-in-mib>.
- **Resource limits** — the OS caps a process's resources via `ulimit`/rlimits
  (`RLIMIT_NOFILE` = fds, `RLIMIT_NPROC` = threads/processes, `RLIMIT_AS` = address space)
  and via cgroup v2 (`pids.max`, `memory.max`). These are the walls we actually hit.
  — Linux `getrlimit(2)` <https://man7.org/linux/man-pages/man2/getrlimit.2.html>;
  Linux kernel, *Control Group v2* <https://docs.kernel.org/admin-guide/cgroup-v2.html>.
- **Signals & IPC** — processes receive signals; threads/processes communicate over pipes
  and sockets. `worker.postMessage` is IPC carrying a structured clone.
  — Linux `signal(7)` <https://man7.org/linux/man-pages/man7/signal.7.html>, `unix(7)`
  <https://man7.org/linux/man-pages/man7/unix.7.html>; Node.js, *Worker threads*
  <https://nodejs.org/api/worker_threads.html>.

### Mapping to Node (concept → where you meet it)

| OS concept | Node surface |
|---|---|
| thread / process | `worker_threads`, `child_process`, `cluster` |
| file descriptor | sockets, `fs`, worker message channel / `MessagePort` |
| syscall | every `node:fs` / `node:net` call |
| scheduler / cores | `os.cpus()` <https://nodejs.org/api/os.html#oscpus>, worker-pool sizing |
| heap / GC | `process.memoryUsage()`, `worker.getHeapStatistics()`, `--max-old-space-size` |
| rlimits / cgroups | `ulimit`, `resourceLimits`, container limits |

## Scaling checklist (what to worry about)

The practical "so what" of topic 0 + topics 20/23/31. To write scalable Node, manage these,
in priority order. (Demos: `10-request-lifecycle`, `12-http-agent`, `13-sockets`.)

1. **The event loop is one thread — biggest lever.** Never block it (sync `fs`/`crypto`,
   big `JSON.parse`, catastrophic regex, tight loops). Offload CPU work to `worker_threads`.
   **Measure** it: `monitorEventLoopDelay` + `eventLoopUtilization` (`perf_hooks`).
2. **Concurrency ≠ parallelism.** Async I/O = concurrency on one core; only workers/cluster
   give parallelism. Know which your workload is.
3. **Connections = sockets = fds, both directions.**
   - Inbound: each connection = a socket + fd. Raise `ulimit -n`, cap with
     `server.maxConnections`, use keep-alive, **watch for fd leaks**.
   - Outbound: pool with a keep-alive `http.Agent`/undici; set **`maxSockets` deliberately**
     (it's your outbound concurrency + fd + ephemeral-port cap). When all sockets to an origin
     are busy, **excess requests queue and serialize** (growing latency, not errors) — bound it.
     See `12-http-agent`.
4. **Memory is more than `heapUsed`.** Respect **backpressure** (streams/`pipeline`,
   `write()`→`false`); never accumulate unbounded arrays/queues. Unbounded caches,
   unremoved listeners and timers leak. Distinguish GC sawtooth vs a rising floor. Set
   `--max-old-space-size`; **watch RSS** (socket buffers/native memory OOM-kill containers).
5. **libuv threadpool is only 4 threads.** `fs`/`dns`/`zlib`/`crypto` share it; heavy use
   starves everything (symptom: latency spikes, not CPU). Tune `UV_THREADPOOL_SIZE` or use
   workers.
6. **Resilience defaults you must add.** Timeouts on everything (outbound, server, sockets);
   handle unhandled rejections/exceptions; implement **graceful shutdown** (stop accepting,
   drain, close on `SIGTERM`); return errors, don't swallow.
7. **Use all cores.** One process = one core by default → `cluster`, `worker_threads`, or
   multiple containers/replicas. Size pools to **cores**, not concurrency. Know your splitter
   (cluster round-robin vs `reusePort` kernel vs LB).
8. **Observability — you can't scale what you can't see.** Track event-loop lag, **p50/p99
   latency**, throughput, GC pauses, RSS, open fds, active handles, connection counts.
9. **The real bottleneck is often elsewhere.** CPU-bound Node tops out ~tens of thousands of
   trivial req/s per core; the DB/upstream usually breaks first. Pool DB connections, cache,
   avoid N+1.

**Minimum-viable checklist:** event-loop lag metric · worker/worker-pool for CPU · keep-alive
+ bounded `maxSockets` out · connection cap + raised `ulimit -n` in · backpressure on all
streams · timeouts everywhere · graceful shutdown · cluster/replicas · RSS + fd dashboards.

If you do only three: **don't block the loop, bound every queue/socket, and measure p99 +
event-loop lag.**

## Modules

| #  | Topic                        | Example dirs                 | Status | Notes |
|----|------------------------------|------------------------------|--------|-------|
| 1  | Node.js basics               | `1-hello-world`, `2-http-server` | [x] | hello world, minimal http server · book ch1 |
| 2  | Event loop & async model     | `5-event-loop`               | [x]    | phases, microtasks, blocking; CJS vs ESM nextTick order · book App. A (delay, utilization) |
| 3  | Modules (ESM / CJS)          | `6-modules`, `9-import-meta` | [x]    | .mjs vs .cjs, package.json "type", interop; import.meta (url/filename/dirname/main/resolve) & CJS equivalents · book ch5 (module mgmt) |
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
| 20 | HTTP clients                 | `12-http-agent`              | [~]    | http.Agent keep-alive pool, maxSockets & next-socket selection; undici/retries next · book ch2 |
| 21 | App health & observability   | `21-app-health`              | [ ]    | metrics, health checks, OpenTelemetry; per-process metrics (fds, sockets, memory breakdown, CPU) · book ch7 |
| 22 | Fault tolerance              | `22-fault-tolerance`         | [ ]    | retries, timeouts, circuit breakers · book ch7 |
| 23 | Workers & scaling            | `8-worker-threads`           | [~]    | worker_threads: main vs worker, CPU-bound off the loop; cluster next · book ch7 (scaling) |
| 24 | Capstone                     | `24-capstone`                | [ ]    | placeholder |
| 25 | SSR frontends                | `25-ssr`                     | [ ]    | server-side rendering, Next.js · book ch3 |
| 26 | App architecture & DI        | `26-architecture`            | [ ]    | modularity, dependency injection, monolith→microservices · book ch5 |
| 27 | Containerization             | `27-containers`              | [ ]    | Dockerfile, multi-stage build, non-root · book ch6 |
| 28 | Orchestration & cloud        | `28-cloud`                   | [ ]    | Kubernetes, serverless, Node-aware scaling signals · book ch6 |
| 29 | Runtime validation           | `29-validation`              | [ ]    | JSON Schema, Ajv, TypeBox · book ch2 |
| 30 | Database integration         | `30-database`                | [ ]    | connections, pooling, migrations · book ch2 |
| 31 | I/O fundamentals             | `7-io`, `10-request-lifecycle`, `13-sockets` | [x] | input/output, blocking vs non-blocking; live fd/socket trace; sockets (listener vs connection, 5-tuple, UDP) · cited refs |
| 32 | Package tooling (npm / npx)  | `14-npx`                     | [x]    | npx = the runner half of npm (`npm exec`); local `node_modules/.bin` vs just-in-time fetch; why not global installs |
| 33 | V8 memory & GC tuning        | `15-v8-memory`               | [x]    | generational GC (scavenger, promotion, mark-sweep); RSS vs `heapUsed`; don't kill at 80%; `--max-semi-space-size` · Collina dotJS 2025 |

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
- **OS & runtime fundamentals** (for topic 0): OSTEP (Operating Systems: Three Easy Pieces)
  — <https://pages.cs.wisc.edu/~remzi/OSTEP/>; Linux man-pages (`syscalls(2)`, `open(2)`,
  `pipe(2)`, `getrlimit(2)`, `signal(7)`, `unix(7)`) — <https://man7.org/linux/man-pages/>;
  Linux kernel *cgroup-v2* — <https://docs.kernel.org/admin-guide/cgroup-v2.html>; V8 blog
  *Trash talk* — <https://v8.dev/blog/trash-talk>; Rob Pike *Concurrency is not Parallelism*
  — <https://go.dev/blog/waza-talk>; Node.js docs *event loop*, *Don't Block the Event Loop*,
  *worker_threads*, *os*, *process*, *cli*. (Full inline links in topic 0 above.)
- **I/O definitions** (for `7-io`): Wikipedia *Input/output*; IBM z/OS Basic Skills
  *Input and output*; NIST CSRC glossary *Input/Output (I/O)*; Yale CS/Aspnes
  *InputOutput*. Full links in `7-io/README.md`.
- **Production failure modes** (for the incidents section): Node.js official *Diagnostics*
  guides (`memory`, `poor-performance`, `live-debugging`, `flame-graphs`, `user-journey`);
  Node.js *Diagnostic report* API; Node.js core `memory` issues; danluu/post-mortems;
  hjacobs/kubernetes-failure-stories. Full inline links in that section.

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
- [ ] **Set up GC for apps** — for each application, tune the heap flags
  (`--max-semi-space-size`, `--max-old-space-size`) against real load, bake the chosen values
  into the production start command, and monitor GC pause time + event-loop lag. Mechanics and
  sizing in `15-v8-memory`.
- Streams vs `async` iteration for large payloads.

### Per-process metrics to track (observability)

The numbers that actually tell you if a Node service is healthy. Track them **per process/PID**
(cluster/workers), not just host-wide. See topic 21 and the scaling checklist.

- [ ] **Open fds** — count, trend, and **% of limit** (`process.report.getReport().userLimits.open_files`;
  count via `/proc/<pid>/fd`, `lsof`, or `process_open_fds` in node_exporter). Watch for a
  monotonic rise (leak).
- [ ] **Sockets / connections** — inbound active (`server.getConnections()`), outbound pool
  (`agent.sockets`/`freeSockets`, undici pool), **accept-queue length** (`ss -lnt` `Recv-Q`)
  and listen-overflow counters, and socket states (`TIME_WAIT`, `CLOSE_WAIT`).
- [ ] **Memory (process)** — `rss` + `heapTotal`/`heapUsed`/`external`/`arrayBuffers`
  (`process.memoryUsage()`, `v8.getHeapStatistics()`).
- [ ] **Memory (breakdown)** — process **RSS** vs **kernel socket buffers**
  (`/proc/net/sockstat`, `ss -tmn`) vs **cgroup total** (`memory.current`); socket buffers
  are kernel memory and OOM-kill containers without showing in `rss`.
- [ ] **CPU per process** — `process.cpuUsage()` (user/system), % of cores, per worker thread.
- [ ] **Event loop** — lag (`monitorEventLoopDelay`) + utilization (`eventLoopUtilization`).
- [ ] **GC** — pause/activity (`PerformanceObserver` GC entries, `--trace-gc`).
- [ ] **App** — latency p50/p99, throughput, error rate, in-flight requests.

### Common memory leak patterns to cover (examples later)

One minimal repro + fix per pattern. Detection in `15-v8-memory`: a rising **post-GC
`heapUsed`** floor = JS-heap leak; a rising **`rss` / `external` / `arrayBuffers`** floor with
flat `heapUsed` = off-heap leak.

- [ ] **Unbounded caches / collections** — module-level `Map`/array/object growing per request;
  memoization keyed by user input; nothing ever evicted.
- [ ] **Listener / subscription leaks** — `.on()` added per request on a long-lived emitter;
  RxJS/observable subscriptions never unsubscribed; `process.on` inside handlers.
- [ ] **Closures & timers retaining scope** — `setInterval` never cleared; recursive timers; a
  closure capturing a large object and held by a long-lived callback.
- [ ] **Request-scoped state on module/global objects** — per-request data stored on globals,
  leaking across requests.
- [ ] **Streams not consumed/destroyed & ignored backpressure** — readable never read → buffers
  retained; response/socket not destroyed; write buffer grows unbounded.
- [ ] **Off-heap leaks** — `Buffer`/`ArrayBuffer` caches, native addons, unresolved async
  holding native handles (show in `rss`/`external`, not `heapUsed`).
- [ ] **Promise / async retention** — unsettled promises holding scope; `.then` chains
  capturing large objects; `AbortSignal`/listeners never removed.

### Binary data to cover (examples later)

How Node represents bytes — and where each type's memory lives.

- [ ] `Buffer` — Node's binary type; backed by an `ArrayBuffer` (pooled for small
  allocations); `Buffer.from` / `alloc` / `allocUnsafe`; slice vs copy.
- [ ] `ArrayBuffer` / `TypedArray` — the underlying JS binary types; `Buffer` is a
  `Uint8Array` subclass.
- [ ] `Blob` / `File` — web-standard immutable binary objects (`node:buffer`); `arrayBuffer()`,
  `stream()`, `text()`.
- [ ] `SharedArrayBuffer` + `Atomics` — memory **shared** across worker threads (the only
  truly shared memory); synchronization and data races.
- [ ] Where the bytes live — `external` / `arrayBuffers` vs the V8 heap; why they show in
  **RSS** but not `heapUsed` (ties to observability).

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
- [x] `node:worker_threads` — message passing (`8-worker-threads`)
- [ ] `process` — stdin / stdout / stderr

(Which use the OS event queue vs libuv's threadpool: see `7-io/README.md`.)

### Production incidents to reproduce (examples later)

Find **real** Node.js production incidents and post-mortems from the internet, rebuild a
minimal reproduction locally, make the failure happen, then apply the documented fix and
watch the difference. One example dir per incident, each with a README.

For every incident, reference it properly: source link, author/company, date, and a note
on what was reproduced verbatim vs. adapted/simplified.

Sources to draw incidents and failure modes from (authoritative first — every incident
must cite its source, author/company and date):

- **Node.js official diagnostics guides** — canonical failure modes with *symptoms* and
  *side effects*: memory (OOM vs inefficient use) <https://nodejs.org/learn/diagnostics/memory>;
  poor performance <https://nodejs.org/learn/diagnostics/poor-performance>;
  live debugging <https://nodejs.org/learn/diagnostics/live-debugging>;
  flame graphs <https://nodejs.org/learn/diagnostics/flame-graphs>;
  user journey <https://nodejs.org/learn/diagnostics/user-journey>.
- **Node.js diagnostic report** (`--report-on-fatalerror`, `process.report`) — captures
  event-loop state, heap stats, resource usage and system limits at crash time.
  <https://nodejs.org/api/report.html>.
- **Node.js core issues** — real, reproducible bugs with repro scripts (`memory` label):
  <https://github.com/nodejs/node/labels/memory>, e.g.
  <https://github.com/nodejs/node/issues/58380> (`fetch` response `.text()` leak) and
  <https://github.com/nodejs/node/issues/54614> (`AbortSignal.any()` leak).
- **Curated post-mortem collections** — danluu/post-mortems
  <https://github.com/danluu/post-mortems>; kubernetes-failure-stories
  <https://github.com/hjacobs/kubernetes-failure-stories> (K8s/Node deployment failures).
- **Talks / book** — Matteo Collina, *Do not thrash the Node.js Event Loop*
  <https://www.youtube.com/watch?v=81AqwvXqgG0>; *The Definitive Guide for Node.js in
  Enterprise* ch. 7 (resilience).

Candidate failure modes to hunt for:

- [ ] Event loop blocked by sync work (`JSON.parse`, sync `fs`/crypto) → latency spike
- [ ] libuv threadpool starvation (`fs`/`dns`/`zlib`/`crypto`, `UV_THREADPOOL_SIZE`)
- [ ] Unbounded in-memory cache / listener leak → OOM or growing RSS
- [ ] Unhandled promise rejection / uncaught exception crashing the process
- [ ] File-descriptor / socket leak (missing `close`/destroy)
- [ ] DB / connection-pool exhaustion under load
- [ ] ReDoS via catastrophic regex backtracking
- [ ] Backpressure ignored on a `stream`/socket → memory growth

## How to add a topic

1. Pick the next example number and name the directory `{n}-{name}`.
2. Add the code plus a `README.md` (one directory per example).
3. Update the table row (status + Example dirs).
