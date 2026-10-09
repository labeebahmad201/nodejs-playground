# 11. Ports — what they are and why

## What a port is

A **port** is a **16-bit number (0–65535)** that identifies *which service/endpoint on a
host* a piece of network traffic belongs to.

- An **IP address** gets a packet to the right **machine**.
- A **port** tells the kernel which **socket / process** on that machine should receive it.

So `IP:port` together is a **socket address**, e.g. `127.0.0.1:63106`. The port is the
**demultiplexer**: one host runs many services (web, db, ssh, your app) behind a single IP,
and the port is how the kernel sorts their traffic apart.

## Why it exists (the reason it's a port, not just an IP)

IP alone can route to a machine but not to a program. A server can't listen on "the IP" —
many programs share one IP. The port adds the missing dimension so the transport layer can
deliver each packet to the correct **socket**. That's the whole design: **IP = host,
port = service.**

## Ranges (IANA)

| Range | Name | Notes | Examples |
|---|---|---|---|
| 0–1023 | **well-known / privileged** | binding needs root | 22 SSH, 80 HTTP, 443 HTTPS |
| 1024–49151 | **registered** | assigned by IANA on request | 3000, 5432 Postgres, 6379 Redis |
| 49152–65535 | **dynamic / ephemeral** | auto-assigned to clients & `listen(0)` | the port in the output below |

(Registry: <https://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.xhtml>)

## Why we use it the three ways we do

**1. Server binds a *fixed* known port — so clients can find it.**
Clients, load balancers and DNS records need a stable address. That's why production binds
`3000`/`8080`/`443`. Downside: if it's taken, `listen()` fails with **`EADDRINUSE`**.

**2. Server binds port `0` — "OS, pick any free one."**
`listen(0)` doesn't use port 0; it asks the kernel to **auto-assign** a free **ephemeral**
port. Why: it can *never* collide, so tests/demos/CLIs can run many instances with zero
coordination. You read the real port back with **`server.address().port`**.

**3. Client connects — the kernel always assigns an ephemeral *source* port.**
The client needs a return address so the server can send the reply back and distinguish
this connection from others. You don't pick it; the kernel does (ephemeral range). Its
counterpart is why **ephemeral port exhaustion / TIME_WAIT** matters at scale (see
`10-request-lifecycle` and the roadmap's production incidents).

## One server port, many connections (the 5-tuple)

A connection is identified by the **5-tuple**:

```
(protocol, clientIP, clientPort, serverIP, serverPort)
```

The kernel demultiplexes on all five. That's why thousands of clients can share the
server's single port (`:443`) — each has a **different client port**. A *listening* socket
is matched by just `(TCP, serverIP, serverPort)` until a connection is accepted.

## Port ≠ file descriptor

Easy to conflate them:

- A **port** is a **network identity** (where on the network).
- A **file descriptor** is the **process's handle** to the socket object in the kernel.

A listening socket has **both**: one port and one fd. Every accepted connection is a **new
socket (new fd)** that still belongs to the **same server port**.

## Unix-domain sockets have no port

A Unix-domain socket talks only to processes on the **same host**, so there's no IP:port to
demultiplex. Instead the kernel uses a **filesystem path** in place of the address — and
`server.address()` returns that path string, not a port. (Bonus: it skips the TCP/IP
stack, so it's faster for local IPC.)

## Run it

```sh
node index.ts
```

## Actual output

```
=== 1. server.listen(0) -> OS picks a free port ===
server.address() -> {"address":"127.0.0.1","family":"IPv4","port":63106}
assigned port 63106  [ephemeral]
WHY: we asked for 'any', so the kernel handed us one from the ephemeral range.

=== 2. client gets its own ephemeral source port ===
[client] local=127.0.0.1:63107 [ephemeral] -> remote=127.0.0.1:63106
the connection is the 5-tuple: (TCP, clientIP, clientPort, serverIP, serverPort)
WHY: the kernel demuxes by that tuple, so MANY connections share the server's one port.
[server] accepted  local=127.0.0.1:63106  remote=127.0.0.1:63107

=== 3. bind to a FIXED port that is taken -> EADDRINUSE ===
second bind to 63106 failed: EADDRINUSE

=== 4. a second listen(0) -> a different free port ===
second server got port 63108  [ephemeral]

=== 5. Unix-domain sockets have no port ===
unix server.address() -> /var/folders/.../ports-demo-45169.sock  (a path, not a port)
```

Note `[client] local=...:63107` (its ephemeral **source** port) and
`[server] local=...:63106` (the **fixed/assigned** service port) — the same connection,
described from each end.

## Host binding side-note

The second argument to `listen` is the **host/interface**:

- `"127.0.0.1"` — **loopback only** (same machine; used here).
- `"0.0.0.0"` — **all interfaces** (reachable from the network). Named after "any address,"
  and yes, it's confusingly "the zero of hosts."

## References

- IANA, Service Name and Transport Protocol Port Number Registry —
  <https://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.xhtml>
- RFC 6335 (IANA procedures for the port registry) — <https://www.rfc-editor.org/rfc/rfc6335>
- RFC 793 / RFC 9293 (TCP) — <https://www.rfc-editor.org/rfc/rfc9293>
- Node.js, `net` — <https://nodejs.org/api/net.html>
- Node.js, `server.listen()` — <https://nodejs.org/api/net.html#serverlisten>
- fd / socket model — `0-os-fundamentals/diagrams.md`
