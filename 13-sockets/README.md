# 13. Sockets — the endpoint, not the number

This documents the model we worked out for "what is a socket?" It's the topic that confuses
almost everyone, because **the word "socket" means two different things at two layers**, and
most explanations blend them. Once you separate those, everything clicks.

## The confusion, stated plainly

"Socket" is used for **two different things**:

1. **IETF / RFC sense** — a *socket* is an **address** (`IP + port`). RFC 9293 (TCP):
   > **socket** (or socket number, or socket address, or socket identifier): "An address
   > that specifically includes a port identifier, that is, the concatenation of an Internet
   > Address with a TCP port."

   and a **connection** is a *pair of sockets*:
   > **connection**: "A logical communication path identified by a pair of sockets."

2. **OS / API sense** — a *socket* is the **endpoint object** you create with `socket()` and
   hold via a file descriptor. Linux `socket(2)`:
   > "socket() creates an endpoint for communication and returns a file descriptor that
   > refers to that endpoint."

Both are correct — they name different layers. **For writing code, use meaning #2:**

- **Port** = a **number** (an address component).
- **Socket** = the **object** (kernel object + fd) that carries bytes.
- **Connection** = a **pair of sockets** (one at each end), named by the **5-tuple**.

## The clean model

```
port      = a number          (address component)
socket    = the endpoint object (kernel object + fd; buffers + state)
connection= a pair of sockets  (one at each host)  — named by the 5-tuple
listener  = a socket that only accepts; each accept -> a NEW connection socket
```

`IP + port` = a **socket address** (where the socket lives). The socket is the thing; the
address is just its location. Proof they're different: a **Unix-domain socket has no port at
all** — it uses a filesystem path — and is still a socket.

## Listening socket vs connection socket

| | Listening socket | Connection socket |
|---|---|---|
| Carries data? | No | Yes |
| Job | wait for & spawn connections | the actual endpoint you read/write |
| Count | **1** per `(proto, IP, port)` | **1 per connection** |
| State | `LISTEN` | `ESTABLISHED`, … |

`server.listen(3000)` creates **one** listening socket that owns port 3000. Every client that
connects → `accept()` returns a **new connection socket**. So a server on `:3000` with 10k
clients holds **1 listener + 10,000 connection sockets** (10,001 fds), all sharing port 3000.

## How the kernel routes traffic (the part people miss)

The listening socket **never sends data and never routes**. The **kernel** demultiplexes
incoming packets to the right socket using the **5-tuple**:

```
(protocol, clientIP, clientPort, serverIP, serverPort)
```

- A packet whose destination is `server:3000` **and that is a new SYN** matches the
  **listening socket** → the kernel creates a connection socket.
- A packet on an established connection matches that connection's **full 5-tuple** → the
  kernel delivers the bytes to **that** connection socket.

Your app never guesses where to reply — it writes to the socket the data arrived on, and the
kernel sends it back out that same socket to the right client:

```js
server.on("request", (req, res) => {
  // req.socket is THIS client's connection socket
  res.end("hi"); // -> back to the correct client
});
```

That's why "multiple sources" is never ambiguous: **each source = its own connection socket.**

## The lifecycle story: one listener → many sockets → serviced by the event loop

The whole thing as one narrative:

1. **`server.listen(3000)`** → the OS creates **one listening socket**, bound to port 3000,
   in `LISTEN` state. Node wraps it in the `server` object.
2. **Client A connects.** The SYN arrives at `server:3000`; the kernel matches it to the
   **listening socket**, completes the handshake, and creates a **new connection socket**
   (full 4-tuple), placing it in the accept queue. *The listener itself is untouched and
   keeps listening.*
3. **Node accepts.** The listening socket becomes "readable" (connections pending); libuv
   (Node's event loop) calls `accept()` and gets **connection socket #1**. Node wraps it as a
   `net.Socket` and registers it with the event loop (`epoll`/`kqueue`). The server emits
   `'connection'` (and, for HTTP, `'request'`).
4. **Client B connects** → the same sequence creates **connection socket #2**. Now there are
   **1 listener + 2 connection sockets**, all on port 3000.
5. **Data flows.** A packet from Client A → the kernel demuxes by 4-tuple → connection
   socket #1 becomes readable → `epoll` reports it → **libuv runs the callback for socket #1
   on the main thread**. Then socket #2's turn, and so on. This is "serviced by Node": the
   event loop runs whichever connection socket is ready, **one at a time**, on the single
   thread.
6. **Close.** When a connection ends, its connection socket is destroyed (fd freed). The
   **listening socket remains**, ready for the next client.

The mental picture:

```
                     accept()                epoll says "socket 1 ready"
[listener @ :3000] ──────────► [conn socket #1] ──────► Node runs its callback
        │        \                                   (single main thread)
        │         \ accept()                epoll says "socket 2 ready"
        │          ─────────► [conn socket #2] ──────► Node runs its callback
        │  (keeps listening; never carries data)
```

Key point: **Node doesn't poll or route.** It registers each connection socket with the OS
(`epoll`/`kqueue`/`IOCP`) and gets told *which ones are ready*; the kernel does the waiting
and demuxing, the event loop does the work.

## TCP vs UDP

- **TCP** is connection-oriented: **one socket per connection**. The kernel demuxes by
  5-tuple.
- **UDP** is connectionless: **one socket serves all peers**. It has no per-peer socket; you
  read the **sender address** (`rinfo`) on each datagram and reply with it:

  ```js
  sock.on("message", (msg, rinfo) => sock.send(reply, rinfo.port, rinfo.address));
  ```

## Thread-per-connection vs the event loop (why "one thread, many sockets")

Older servers used **one thread (or process) per connection**: each thread **blocked** in
`read()` waiting for its socket. That doesn't scale — the **C10K problem** (Dan Kegel, 1999):
10k connections = 10k blocked threads = 10k stacks + context switches.

The fix is **I/O multiplexing** (`select`/`poll`, then **`epoll`** on Linux, **`kqueue`** on
BSD/macOS, **IOCP** on Windows): one thread registers interest in many sockets and blocks in a
single wait; the kernel returns the list of **ready** sockets; the thread runs their callbacks
and loops. **One thread, thousands of sockets.**

Important corrections to the common story:

- **Sockets live in the kernel, not on a thread.** The thread is *multiplexed* across their
  readiness events — the kernel does the waiting, the thread does the work.
- **Node did not invent this.** Event-driven servers (nginx, 2004) predate Node (2009), and
  Node is **V8 + libuv**, where libuv just wraps `epoll`/`kqueue`/IOCP.

## What you'd see (illustrative)

```
=== 1. TCP — listener vs connection sockets ===
listening socket: 127.0.0.1:65384   (the ONE socket that owns the port)
[server] connection socket fd=15  local=127.0.0.1:65384  <-  remote=127.0.0.1:65385
[client A] socket fd=13  local=127.0.0.1:65385  ->  remote=127.0.0.1:65384
[server] connection socket fd=16  local=127.0.0.1:65384  <-  remote=127.0.0.1:65386
[client B] socket fd=14  local=127.0.0.1:65386  ->  remote=127.0.0.1:65384
=> two DISTINCT connection sockets at once, same server port, different client ports (5-tuple)

=== 2. UDP — one socket, many peers (connectionless) ===
UDP socket bound 127.0.0.1:53830   (ONE socket for every peer)
[udp A] sent from 0.0.0.0:60909
[udp] the same socket got "ping-a" from 127.0.0.1:60909  (use rinfo to reply)
[udp A] got reply "ack:ping-a"
[udp B] sent from 0.0.0.0:51501
[udp] the same socket got "ping-b" from 127.0.0.1:51501  (use rinfo to reply)
[udp B] got reply "ack:ping-b"
```

Read the TCP part: **two distinct connection sockets (fd 15 and fd 16)** exist at the same
time, both with `local=…:65384` (the **same server port**), told apart only by the **client
port** — that's the 5-tuple in action. The UDP part shows the opposite: **one** socket
handling two different peers. (Illustrative output; this dir is explanation-only.)

## One-line summary

**Port = a number. Socket = the endpoint object. Connection = a pair of sockets. One listener
per port, one connection socket per client; the kernel routes by the 5-tuple; the event loop
multiplexes one thread across many sockets.**

## References

- RFC 9293, *Transmission Control Protocol (TCP)* — glossary & §3.4.1 —
  <https://www.rfc-editor.org/rfc/rfc9293>
- RFC 768, *User Datagram Protocol* — <https://www.rfc-editor.org/rfc/rfc768>
- Linux `socket(2)` — <https://man7.org/linux/man-pages/man2/socket.2.html>
- Linux `socket(7)` — <https://man7.org/linux/man-pages/man7/socket.7.html>
- Linux `tcp(7)` — <https://man7.org/linux/man-pages/man7/tcp.7.html>
- Dan Kegel, *The C10K problem* — <http://www.kegel.com/c10k.html>
- libuv, *Design overview* — <https://docs.libuv.org/en/latest/design.html>
- Beej's Guide to Network Programming — <https://beej.us/guide/bgnet/>
- Related dirs: `10-request-lifecycle` (fds per connection),
  `12-http-agent` (socket reuse)
