# 10. Request lifecycle — watch the OS allocations happen

The fd/socket/kernel model is easy to talk about and hard to *see*. This example runs an
HTTP server and a client **in one process**, walks through three requests, and prints at
each step exactly what the OS allocates: the process's fd-table size, RSS/heap, active
libuv handles, the server socket's raw fd number, and the kernel's own view via `lsof`.

It turns the abstract diagrams (`0-os-fundamentals/diagrams.md`) into observed numbers.

## Run it

```sh
node index.ts
```

## What it demonstrates

Three requests:

1. **req 1** — opens a *new* TCP connection → the server accepts a socket → **+1 fd**
   (in this in-process demo you also see the client's end, so the process gains **2**).
2. **req 2** — reuses the **same keep-alive connection** → **same socket, same fd**, no new
   allocation.
3. **req 3** — a brand-new agent opens a **new connection** → **new socket, new fd**.

Between 2 and 3 it queries the **kernel** with `lsof`, which shows the fd table from the
other side: the listening socket and both ends of the connection in `ESTABLISHED` state.

## Actual output

```
    4.5ms  [demo] server listening on 127.0.0.1:62614 (pid 42502)
    5.4ms  [demo] baseline  fds=14 rss=79.8 MB heapUsed=11.1 MB
    5.4ms  [demo] baseline resources: PipeWrap TCPServerWrap PipeWrap
    5.5ms  [client] req 1 (opens connection): connecting
    8.9ms  [server] TCP connection accepted  socket fd=14  fds=16 rss=80.1 MB heapUsed=11.2 MB
    9.9ms  [server] request GET /
   10.0ms  [server]   server socket fd=14 type=TCP peer=127.0.0.1:62615
   10.2ms  [server]   fds=16 rss=80.2 MB heapUsed=11.3 MB
   10.2ms  [server]   active resources: PipeWrap TCPServerWrap PipeWrap TCPSocketWrap TCPSocketWrap
   13.2ms  [client] req 1 (opens connection): response done  fds=16 rss=81.3 MB heapUsed=11.4 MB
   13.6ms  [client] req 2 (reuses same connection): connecting
   13.9ms  [server] request GET /
   13.9ms  [server]   server socket fd=14 type=TCP peer=127.0.0.1:62615
   13.9ms  [server]   fds=16 rss=81.3 MB heapUsed=12.0 MB
   13.9ms  [server]   active resources: PipeWrap TCPServerWrap PipeWrap TCPSocketWrap TCPSocketWrap
   14.3ms  [client] req 2 (reuses same connection): response done  fds=16 rss=81.4 MB heapUsed=11.5 MB
   14.5ms  [demo] connection still open (keep-alive); asking the kernel:
   59.5ms  [kernel] lsof: node 42502 labeeb 12u IPv4 0x... 0t0 TCP 127.0.0.1:62614 (LISTEN)
   59.5ms  [kernel] lsof: node 42502 labeeb 13u IPv4 0x... 0t0 TCP 127.0.0.1:62615->127.0.0.1:62614 (ESTABLISHED)
   59.5ms  [kernel] lsof: node 42502 labeeb 14u IPv4 0x... 0t0 TCP 127.0.0.1:62614->127.0.0.1:62615 (ESTABLISHED)
   60.8ms  [server] TCP connection accepted  socket fd=15  fds=17 rss=81.8 MB heapUsed=11.6 MB
   61.1ms  [server] request GET /
   61.1ms  [server]   server socket fd=15 type=TCP peer=127.0.0.1:62616
   61.8ms  [demo] after close  fds=14 rss=81.8 MB heapUsed=11.7 MB
```

## What each number is

| Observation | Meaning |
|---|---|
| `fds=14` → `fds=16` on connect | the process fd table grew by 2: the accepted **server** socket + the **client** socket (both ends are in this one process) |
| `socket fd=14 type=TCP` | Node exposes the socket's raw kernel fd on `socket._handle.fd` |
| req 2 → `socket fd=14` again | keep-alive **reused** the connection; no new fd |
| `fds=14` after close | descriptors are released back to the table |
| `13u` / `14u` in lsof | **the kernel's fd table** (`u` = the fd number); `12u` is the listening socket |
| `13u` client `ESTABLISHED`, `14u` server `ESTABLISHED` | the two ends are two kernel socket objects in a connected state |
| `active resources: ... TCPSocketWrap ×2` | the two libuv socket handles in the event loop |
| `rss` climbs ~1–2 MB, `heapUsed` wobbles | per-connection/server objects + transient request/response objects in the V8 heap |

The headline result: **`socket fd=14` (Node) equals `14u` (kernel `lsof`)** — the number
Node reports *is* the index into the kernel's per-process fd table. And a reused
connection allocates **nothing new**.

## What gets allocated, per step

| Step | Kernel | fd table | V8 heap |
|---|---|---|---|
| server starts | listening socket | +1 | server object |
| new connection | socket object + buffers | **+1 server** (+1 client here) | `net.Socket` |
| request on live conn | transient | **0** | req/res objects, headers, body |
| response | — | 0 | freed on next GC |
| connection close | socket object freed | **−1** | socket object GC'd |

## Caveats

- The client and server share a process, so you see **both** ends; a real client adds no fd
  to *your* server's table.
- `socket._handle.fd` is a V8/Node internal (not a stable public API); `process.memoryUsage()`
  and `process.getActiveResourcesInfo()` are public.
- `lsof` is Unix/macOS; on Linux you can use `ss -tanp` instead.

## References

- Node.js, `process.getActiveResourcesInfo()` —
  <https://nodejs.org/api/process.html#processgetactiveresourcesinfo>
- Node.js, `http` / `net` — <https://nodejs.org/api/http.html>, <https://nodejs.org/api/net.html>
- `lsof(8)` — <https://man7.org/linux/man-pages/man8/lsof.8.html>
- fd / socket model — `0-os-fundamentals/diagrams.md` (sections 1 and 4)
