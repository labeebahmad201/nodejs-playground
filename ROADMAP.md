# Roadmap

Living list of topics to document. Each **example** lives in its own numbered
directory (`{n}-{name}`) with a `README.md`; (where relevant) load tests too.
Example-dir numbering is independent of the topic numbers below — the *Example dirs*
column lists what has actually been built for each topic.

Status: `[ ]` not started · `[~]` in progress · `[x]` done

## Modules

| #  | Topic                        | Example dirs                 | Status | Notes |
|----|------------------------------|------------------------------|--------|-------|
| 1  | Node.js basics               | `1-hello-world`, `2-http-server` | [x] | hello world, minimal http server |
| 2  | Event loop & async model     | `2-event-loop`               | [ ]    | placeholder |
| 3  | Modules (ESM / CJS)          | `3-modules`                  | [ ]    | placeholder |
| 4  | TypeScript setup             | `3-type-checking`, `4-tsc-noemit` | [x] | `tsc --noEmit`, type stripping limits |
| 5  | Async patterns               | `5-async-patterns`           | [ ]    | promises, AbortController, concurrency limits |
| 6  | Error handling               | `6-error-handling`           | [ ]    | placeholder |
| 7  | Streams & backpressure       | `7-streams`                  | [ ]    | placeholder |
| 8  | Caching                      | `8-caching`                  | [ ]    | lru, stale-while-revalidate |
| 9  | Graceful shutdown            | `9-graceful-shutdown`        | [ ]    | signals, drain, close connections |
| 10 | Environment & secrets        | `10-environment`             | [ ]    | placeholder |
| 11 | Logging                      | `11-logging`                 | [ ]    | structured logs, Pino |
| 12 | Performance                  | `12-performance`             | [ ]    | placeholder |
| 13 | Profiling                    | `13-profiling`               | [ ]    | --cpu-prof, flamegraphs |
| 14 | Node modules exploration     | `14-node-modules`            | [ ]    | placeholder |
| 15 | Load testing                 | `15-load-testing`            | [ ]    | artillery, autocannon |
| 16 | Testing                      | `16-testing`                 | [ ]    | node:test |
| 17 | Flaky tests                  | `17-flaky-tests`             | [ ]    | placeholder |
| 18 | Stuck processes & handles    | `18-stuck-processes`         | [ ]    | placeholder |
| 19 | HTTP server                  | `19-http-server`             | [ ]    | Fastify, plugins, hooks |
| 20 | HTTP clients                 | `20-http-clients`            | [ ]    | undici, keep-alive, retries |
| 21 | App health & observability   | `21-app-health`              | [ ]    | metrics, health checks |
| 22 | Fault tolerance              | `22-fault-tolerance`         | [ ]    | retries, timeouts, circuit breakers |
| 23 | Workers & scaling            | `23-workers`                 | [ ]    | worker_threads, cluster |
| 24 | Capstone                     | `24-capstone`                | [ ]    | placeholder |

## Deferred / later

- TypeScript before type stripping — how it was done pre-Node-native TS (`ts-node`,
  `tsx`, `tsc` build / transpile step). Document later, not immediate.

## Ideas / unassigned

- placeholder

## How to add a topic

1. Pick the next example number and name the directory `{n}-{name}`.
2. Add the code plus a `README.md` (one directory per example).
3. Update the table row (status + Example dirs).
