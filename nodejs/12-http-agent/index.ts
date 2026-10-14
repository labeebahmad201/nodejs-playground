// http.Agent — why it exists and how it decides which socket a request uses.
// Run: `node index.ts`
//
// WHY an Agent: without connection pooling, every request pays for a brand-new TCP
// (and TLS) connection, and burns an fd + an ephemeral port + TIME_WAIT on teardown.
// An Agent keeps a per-origin POOL of sockets and reuses them.
//
// HOW it picks the next socket, for a given origin key (host:port):
//   1. if a FREE (idle, kept-alive) socket exists -> reuse it (LIFO by default)
//   2. else if active sockets < maxSockets        -> open a NEW socket
//   3. else                                        -> QUEUE the request until one frees
//   (maxFreeSockets caps how many idle sockets are kept; extras get destroyed)

import http from "node:http";
import type { Agent } from "node:http";

const rule = (t: string) => console.log(`\n=== ${t} ===`);

let connections = 0;
let handlerDelay = 0;

const server = http.createServer((_req, res) => {
  setTimeout(() => res.end("ok\n"), handlerDelay);
});
server.on("connection", (sock) => {
  sock.on("error", () => {});
  connections++;
  console.log(`[server] accepted connection #${connections}`);
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address() as { port: number };
const host = "127.0.0.1";
const key = (agent: Agent) => agent.getName({ host, port });
const pool = (agent: Agent) => {
  const k = key(agent);
  return `active=${agent.sockets[k]?.length ?? 0} free=${agent.freeSockets[k]?.length ?? 0}`;
};

// Fire a request; log which socket it got (by the socket's local port).
// This time we READ the response body with a 'data' listener (instead of the
// res.resume() shortcut) so we can see the data arrive. Adding a 'data' listener puts the
// stream in flowing mode just like resume(), but we keep the chunks instead of discarding.
const call = (agent: Agent | false, label: string) =>
  new Promise<void>((resolve) => {
    const req = http.get({ host, port, agent }, (res) => {
      res.setEncoding("utf8");
      const chunks: string[] = [];
      res.on("data", (chunk: string) => chunks.push(chunk));
      res.on("end", () => {
        console.log(`[${label}] response body: ${JSON.stringify(chunks.join(""))}`);
        resolve();
      });
    });
    req.on("socket", (sock) => {
      const how = sock.connecting ? "NEW socket" : "REUSED socket";
      console.log(`[${label}] ${how} localPort=${sock.localPort}`);
    });
  });

// --- A. No agent: a new socket for every request ---------------------------
rule("A. agent:false -> a NEW socket per request (no pooling)");
handlerDelay = 0;
let before = connections;
await call(false, "A1");
await call(false, "A2");
await call(false, "A3");
console.log(`-> 3 requests, ${connections - before} connections`);

// --- B. keepAlive Agent: reuse the free socket -----------------------------
rule("B. keepAlive agent -> same socket reused (1 connection)");
const keepAlive = new http.Agent({ keepAlive: true, maxSockets: 5, maxFreeSockets: 5 });
before = connections;
await call(keepAlive, "B1");
await call(keepAlive, "B2");
await call(keepAlive, "B3");
console.log(`-> 3 requests, ${connections - before} connections   ${pool(keepAlive)}`);
keepAlive.destroy();

// --- C. maxSockets=1: extras queue -----------------------------------------
rule("C. maxSockets=1 -> concurrency capped, 2nd/3rd requests QUEUE");
handlerDelay = 150; // hold the socket so overlap/queueing is visible
const one = new http.Agent({ keepAlive: true, maxSockets: 1 });
before = connections;
await Promise.all([call(one, "C1"), call(one, "C2"), call(one, "C3")]);
console.log(`-> 3 requests, ${connections - before} connection(s)   ${pool(one)}`);
one.destroy();

// --- D. maxSockets=2 with 3 parallel: 2 sockets, 3rd waits -----------------
rule("D. maxSockets=2 -> 2 sockets, 3rd request waits for a free one");
const two = new http.Agent({ keepAlive: true, maxSockets: 2 });
before = connections;
await Promise.all([call(two, "D1"), call(two, "D2"), call(two, "D3")]);
console.log(`-> 3 requests, ${connections - before} connections   ${pool(two)}`);
two.destroy();

server.close();

// Actual output (ports vary):
//
// === A. agent:false -> a NEW socket per request (no pooling) ===
// [A1] NEW socket localPort=49557
// [server] accepted connection #1
// [A1] response body: "ok\n"
// [A2] NEW socket localPort=49558
// [server] accepted connection #2
// [A2] response body: "ok\n"
// [A3] NEW socket localPort=49559
// [server] accepted connection #3
// [A3] response body: "ok\n"
// -> 3 requests, 3 connections
//
// === B. keepAlive agent -> same socket reused (1 connection) ===
// [B1] NEW socket localPort=49560
// [server] accepted connection #4
// [B1] response body: "ok\n"
// [B2] REUSED socket localPort=49560
// [B2] response body: "ok\n"
// [B3] REUSED socket localPort=49560
// [B3] response body: "ok\n"
// -> 3 requests, 1 connections   active=0 free=1
//
// === C. maxSockets=1 -> concurrency capped, 2nd/3rd requests QUEUE ===
// [C1] NEW socket localPort=49561
// [server] accepted connection #5
// [C1] response body: "ok\n"
// [C2] REUSED socket localPort=49561
// [C2] response body: "ok\n"
// [C3] REUSED socket localPort=49561
// [C3] response body: "ok\n"
// -> 3 requests, 1 connection(s)   active=0 free=1
//
// === D. maxSockets=2 -> 2 sockets, 3rd request waits for a free one ===
// [D1] NEW socket localPort=49562
// [D2] NEW socket localPort=49563
// [server] accepted connection #6
// [server] accepted connection #7
// [D1] response body: "ok\n"
// [D3] REUSED socket localPort=49562   <- waited for a free socket
// [D2] response body: "ok\n"
// [D3] response body: "ok\n"
// -> 3 requests, 2 connections   active=0 free=2
