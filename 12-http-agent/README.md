# 12. `http.Agent` — connection pooling, `maxSockets`, and picking the next socket

## Why an `http.Agent`

Every HTTP client request needs a TCP connection (and, for HTTPS, a TLS handshake). If
nothing pools them, **each request**:

- pays the TCP/TLS setup cost (latency + CPU),
- consumes a **file descriptor** for the life of the request,
- consumes an **ephemeral port**, and leaves a **TIME_WAIT** socket on close.

`http.Agent` fixes that by keeping a **per-origin pool of connections** and reusing them.
It's the thing that made `req 2` reuse the same `fd` back in `10-request-lifecycle`, and it
is the knob that bounds your **outbound fds / concurrency** (`maxSockets`).

`http.request()`/`http.get()` use `http.globalAgent` unless you pass `agent`. Pass
`agent: false` to opt out (new connection per request, no pooling).

## How the agent determines the *next* socket

For a given request, Node computes an **origin key** — `agent.getName({ host, port })` →
`host:port:localAddress` — and looks at that origin's pool:

```
1. is there a FREE (idle, keep-alive) socket for this origin?
      yes -> REUSE it          (which one = the `scheduling` policy)
2. else, are active sockets < maxSockets?
      yes -> open a NEW socket
3. else
      -> QUEUE the request until a socket frees (or a timeout)
```

Related knobs:

| Option | Effect |
|---|---|
| `keepAlive` | if false, sockets are destroyed after the response (no reuse) |
| `maxSockets` | cap on **concurrent** sockets **per origin** (excess requests queue) |
| `maxFreeSockets` | cap on **idle** kept-alive sockets (extras destroyed) |
| `maxTotalSockets` | cap across all origins |
| `scheduling` | which free socket to reuse: `'lifo'` (default) or `'fifo'` |
| `keepAliveMsecs` | TCP keep-alive probe delay for idle sockets |
| `timeout` | socket inactivity timeout |

**LIFO (default) vs FIFO:** on reuse the agent picks the **most recently freed** socket
(`lifo`) by default. The rationale is TCP's congestion window: a socket that just served a
request has a warm window, so reusing it starts faster than the oldest, coldest socket.
`fifo` picks the oldest instead.

## What the example proves

`12-http-agent/index.ts` runs four scenarios against a local server and logs, per request,
which socket it got (identified by the client's **local port**):

- **A. `agent:false`** → 3 requests ⇒ **3 connections** (a new socket each time).
- **B. keep-alive agent** → 3 requests ⇒ **1 connection** (same socket reused).
- **C. `maxSockets:1`** → 3 requests ⇒ **1 connection**, requests 2 and 3 **queue** and run
  one after another.
- **D. `maxSockets:2`** → 3 requests ⇒ **2 connections**, the 3rd **waits** for a free
  socket, then reuses it.

## Actual output

```
=== A. agent:false -> a NEW socket per request (no pooling) ===
[A1] NEW socket localPort=63135
[server] accepted connection #1
[A2] NEW socket localPort=63136
[server] accepted connection #2
[A3] NEW socket localPort=63137
[server] accepted connection #3
-> 3 requests, 3 connections

=== B. keepAlive agent -> same socket reused (1 connection) ===
[B1] NEW socket localPort=63138
[server] accepted connection #4
[B2] REUSED socket localPort=63138
[B3] REUSED socket localPort=63138
-> 3 requests, 1 connections   active=0 free=1

=== C. maxSockets=1 -> concurrency capped, 2nd/3rd requests QUEUE ===
[C1] NEW socket localPort=63139
[server] accepted connection #5
[C2] REUSED socket localPort=63139
[C3] REUSED socket localPort=63139
-> 3 requests, 1 connection(s)   active=0 free=1

=== D. maxSockets=2 -> 2 sockets, 3rd request waits for a free one ===
[D1] NEW socket localPort=63140
[D2] NEW socket localPort=63141
[server] accepted connection #6
[server] accepted connection #7
[D3] REUSED socket localPort=63140
-> 3 requests, 2 connections   active=0 free=2
```

Read it as: **same `localPort` = same socket = reused connection**; a new `localPort` = a
new connection (new fd). `active`/`free` are the agent's live pool counts for that origin.

## Why `maxSockets` is the one to care about

- It is your outbound **concurrency limit** — and therefore the cap on **fds / sockets**
  and ephemeral-port use (see `11-ports` and `10-request-lifecycle`).
- Too high → you exhaust ports/fds and hammer the upstream; too low → requests queue and
  latency balloons. Size it deliberately (usually to the upstream's capacity), not by
  leaving it unbounded.
- The trade-off is explicit: `maxSockets` bounds resources at the cost of **queueing
  latency** when saturated.

## Caveats

- `http.globalAgent` keeps sockets alive by default since Node 19 (5 s). Older Node didn't,
  so "pooling" behavior depends on your version.
- **`fetch` / undici is different:** it has its own pool (`undici.Agent` / `Pool` /
  `connections` option); `http.Agent` does not apply.
- HTTPS uses `https.Agent` (same pooling, plus TLS options).

## References

- Node.js, `http.Agent` — <https://nodejs.org/api/http.html#class-httpagent>
- Node.js, `new Agent([options])` — <https://nodejs.org/api/http.html#new-agentoptions>
- Node.js, `http.globalAgent` — <https://nodejs.org/api/http.html#httpglobalagent>
- Related: `10-request-lifecycle` (fds per connection), `11-ports`
