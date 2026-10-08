# 0. OS & runtime fundamentals

`worker_threads`, the event loop, I/O, performance and resource limits are thin JS layers
over OS primitives. This example makes those primitives **observable from Node**: process
vs thread, memory shape, file descriptors, the scheduler, OS limits, signals and IPC. Read
it before topics 2 (event loop), 23 (workers) and 31 (I/O) — the rest then reads as obvious.

Every claim here is sourced (links at the bottom).

## Run it

```sh
node index.ts
```

## What each section shows

### 1. Process vs thread

A **process** owns memory and at least one **thread**; threads inside a process **share**
its address space — which is exactly why shared-memory data races are even possible. A
`Worker` is a *thread*, not a process: same `pid`, different `threadId`.

- `index.ts` prints the main `pid`/`threadId`, spawns a worker that reports its own, and
  shows `pid` is identical while `threadId` differs — then does one `postMessage`
  round-trip (IPC). — OSTEP *Concurrency*; Wikipedia *Process*, *Thread*.

### 2. Memory: RSS vs heap vs virtual

Four different numbers, easy to confuse:

- **`rss`** — resident set size: physical RAM actually in use right now.
- **`heapTotal` / `heapUsed`** — V8's JavaScript heap (committed / live).
- **`external` / `arrayBuffers`** — memory held by C++ objects and `ArrayBuffer` stores.
- **`heap_size_limit`** — the V8 heap *reservation*; **virtual**, not resident until touched.

So a big `heap_size_limit` costs nothing until used. — V8 *Trash talk*; Node
`process.memoryUsage()`, `v8.getHeapStatistics()`.

### 3. File descriptors

The kernel represents every open I/O resource as a small integer **file descriptor**;
`stdin`/`stdout`/`stderr` are `0`/`1`/`2`. Sockets, pipes and worker message channels all
consume descriptors. The example counts open fds (`/dev/fd` on macOS, `/proc/self/fd` on
Linux), opens a file with `openSync` (see the fd go up by one), then closes it. — Linux
`open(2)`, `pipe(2)`; Wikipedia *File descriptor*.

### 4. Scheduler & cores

The kernel time-slices runnable threads across cores and preempts them. More runnable
threads than cores buys you **context-switch overhead**, not throughput. The example prints
core count (`os.cpus()`, `os.availableParallelism()`), load average, and the process's
voluntary/involuntary context switches (`process.resourceUsage()`). — OSTEP *Scheduling*.

### 5. Resource limits (the walls)

The OS caps a process's resources. `process.report.getReport().userLimits` surfaces the
`ulimit`/rlimit values:

- `open_files` — `RLIMIT_NOFILE`, the fd ceiling (worker channels hit this).
- `max_user_processes` — `RLIMIT_NPROC`, threads/processes per user.
- `stack_size_bytes` — per-thread stack, `RLIMIT_STACK`.

In containers, **cgroup v2** (`pids.max`, `memory.max`) usually binds first. — Linux
`getrlimit(2)`; kernel *cgroup-v2*.

### 6. Signals

Signals are asynchronous notifications the OS delivers to a process (e.g. `SIGINT` from
Ctrl-C, `SIGTERM` from an orchestrator). The example registers and removes a `SIGINT`
handler to show the API without changing behavior. — Linux `signal(7)`; Node `process`.

## Actual output

```
=== 1. Process vs thread ===
this process pid : 33951
this thread id   : 0   (0 = main thread)
worker thread id : 1
worker pid       : 33951
same process?    : true
IPC round-trip   : main -> worker -> main ("ping")

=== 2. Memory (RSS vs heap) ===
rss          : 91.2 MB   (resident set: physical RAM actually used)
heapTotal    : 10.4 MB   (V8 heap committed)
heapUsed     : 8.0 MB   (live objects)
external     : 10.1 MB   (C++ objects, e.g. Buffers)
arrayBuffers : 0.0 MB   (ArrayBuffer backing stores)
V8 heap_size_limit: 4288.0 MB   (reserved, not resident)

=== 3. File descriptors ===
open fds before : 15
openSync -> fd   : 14   (a raw descriptor; sockets/pipes take these too)
open fds while   : 16   (+1 for the file we opened)
open fds after   : 15   (closed again)

=== 4. Scheduler & cores ===
os.cpus()            : 10
os.availableParallelism(): 10   (usable cores)
load average (1m)    : 3.55
voluntary ctx switches  : 3
involuntary ctx switches: 336

=== 5. Resource limits (rlimits) ===
open_files             soft=1048575 hard=unlimited
stack_size_bytes       soft=8372224 hard=67092480
max_user_processes     soft=4000 hard=6000
max RSS so far       : 91.4 MB

=== 6. Signals ===
SIGINT handlers now  : 1   (OS delivers these to the process)
SIGINT handlers after: 0
```

Numbers vary by machine. Note the `pid` is identical across threads (same process) and the
fd count rises by exactly one for the opened file — the two most useful things to see.

## Concept → Node surface

| OS concept | Node surface |
|---|---|
| thread / process | `worker_threads`, `child_process`, `cluster` |
| file descriptor | sockets, `fs`, worker message channel / `MessagePort` |
| syscall | every `node:fs` / `node:net` call |
| scheduler / cores | `os.cpus()`, `os.availableParallelism()`, worker-pool sizing |
| heap / GC | `process.memoryUsage()`, `v8.getHeapStatistics()`, `--max-old-space-size` |
| rlimits / cgroups | `process.report.getReport().userLimits`, `resourceLimits`, container limits |
| signals / IPC | `process.on("SIGTERM")`, `worker.postMessage`, `MessagePort` |

## References

- OSTEP, *Concurrency: An Introduction* — <https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf>
- OSTEP, *Address Spaces* — <https://pages.cs.wisc.edu/~remzi/OSTEP/vm-intro.pdf>
- OSTEP, *Scheduling: Introduction* — <https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf>
- OSTEP (full book) — <https://pages.cs.wisc.edu/~remzi/OSTEP/>
- Linux `syscalls(2)` — <https://man7.org/linux/man-pages/man2/syscalls.2.html>
- Linux `open(2)` — <https://man7.org/linux/man-pages/man2/open.2.html>
- Linux `pipe(2)` — <https://man7.org/linux/man-pages/man2/pipe.2.html>
- Linux `getrlimit(2)` — <https://man7.org/linux/man-pages/man2/getrlimit.2.html>
- Linux `signal(7)` — <https://man7.org/linux/man-pages/man7/signal.7.html>
- Linux `unix(7)` — <https://man7.org/linux/man-pages/man7/unix.7.html>
- Linux kernel, *Control Group v2* — <https://docs.kernel.org/admin-guide/cgroup-v2.html>
- V8, *Trash talk: the Orinoco garbage collector* — <https://v8.dev/blog/trash-talk>
- Rob Pike, *Concurrency is not Parallelism* — <https://go.dev/blog/waza-talk>
- Node.js, *The event loop, timers, and `process.nextTick()`* —
  <https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick>
- Node.js, *Don't Block the Event Loop* —
  <https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop>
- Node.js, *Worker threads* — <https://nodejs.org/api/worker_threads.html>
- Node.js, `process.memoryUsage()` — <https://nodejs.org/api/process.html#processmemoryusage>
- Node.js, `--max-old-space-size` — <https://nodejs.org/api/cli.html#--max-old-space-sizesize-in-mib>
- Node.js, `os` — <https://nodejs.org/api/os.html>
- Wikipedia, *Process* — <https://en.wikipedia.org/wiki/Process_(computing)>
- Wikipedia, *Thread* — <https://en.wikipedia.org/wiki/Thread_(computing)>
- Wikipedia, *File descriptor* — <https://en.wikipedia.org/wiki/File_descriptor>
