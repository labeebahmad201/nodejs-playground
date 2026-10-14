# RSS — the clean model

A precise model of what **Resident Set Size** is, and the misconception to avoid: RSS is
about **resident** pages, *not* "active" memory, and its complement is *not* only swap.

## Definition

**RSS = the pages of a process's memory that are currently backed by physical RAM.**

Nothing more. It is a *snapshot of occupancy*, not a measure of how recently or how often the
memory was used.

## Every page is in one of three states

Consider the process's **virtual address space** (reported as `VSZ` / `VIRT`):

```
virtual page
├── never touched yet        → no physical page at all      (demand paging)
├── resident                 → a physical RAM frame backs it ← RSS counts these
└── not resident
    ├── anonymous memory      → moved to SWAP (disk)
    └── file-backed memory    → simply DROPPED, re-read from the file later
```

- **Resident** = in RAM now → counted in RSS.
- **Not resident** = not in RAM → *either* swapped (anonymous) *or* dropped (file-backed).

## Where the "active vs swapped" framing breaks

1. **The complement is not only swap.** A page that was never accessed has no disk copy
   either — it doesn't exist physically until the first touch (demand paging).
2. **File-backed pages don't go to swap.** The binary, shared libraries, and `mmap`ed files
   are backed by the *file*. Under pressure the kernel can **drop** those clean pages and
   re-read them from disk. No swap involved.
3. **Resident ≠ recently used.** A page touched once and never again stays resident until the
   kernel reclaims it.
4. **RSS is shared.** Shared libraries are counted in *every* process that maps them, so
   summing RSS across processes overcounts.

## What the kernel reclaims under pressure

In rough preference order:

1. **Drop clean file-backed pages** — free; just re-read from the file later.
2. **Write dirty anonymous pages to swap**, then evict them (they leave RSS).
3. If it still can't reclaim enough → **OOM killer**.

So "the rest lives on disk" is only true for **anonymous** memory that got swapped. Code and
libraries just vanish from RAM and come back from the file.

## Tie-in to Node / the talk

Node's RSS ≈ V8 heap + **external** (Buffers / ArrayBuffers) + native `malloc` memory + code &
shared libraries + thread stacks.

- `process.memoryUsage().rss` is exactly this number — physical RAM currently backing the
  process, independent of how much V8 thinks is "used."
- That is why, in `15-v8-memory/index.ts`, RSS stays at ~228 MB while `heapUsed` falls from
  119 MB to 7 MB: the pages are **resident and reusable**, not swapped and not freed.
- **Kernel socket buffers are NOT in RSS** (they are kernel memory), so a process can OOM a
  container without RSS ever showing it. (See `ROADMAP.md` → "Per-process metrics".)

## How to measure it

```sh
# Linux
ps -o rss= -p <pid>                          # RSS in KB
grep VmRSS /proc/<pid>/status
grep -E 'VmRSS|VmSwap' /proc/<pid>/status   # resident vs swapped, side by side

# macOS
vmmap <pid>        # regions and resident sizes
ps -o rss= -p <pid>

# Node, from inside the process
node -e 'console.log(process.memoryUsage())'
```

## One-line summary

**RSS = pages in physical RAM right now.** Not "active," and not the opposite of "swapped" —
non-resident memory can be swapped (anonymous) *or* simply dropped and re-read (file-backed).

## References

- Linux man-pages — `proc_pid_status(5)` (`VmRSS`, `VmSwap`): <https://man7.org/linux/man-pages/man5/proc_pid_status.5.html>
- Linux kernel docs — memory management / page reclaim: <https://docs.kernel.org/admin-guide/mm/index.html>
- Node.js docs — `process.memoryUsage()`: <https://nodejs.org/api/process.html#processmemoryusage>
