// See a request's OS-level allocations happen, live.
// Run: `node index.ts`
//
// This starts an HTTP server AND acts as the client in the same process, then walks
// through three requests while printing, at each step:
//   - the process's open file-descriptor count (the kernel fd table size)
//   - RSS / heapUsed
//   - the active libuv resources (handles)
//   - the server-side socket's raw fd number and type (TCP)
//   - the kernel's own view via `lsof` (best effort)
//
// Because the client and server share one process here, you see BOTH ends (a client
// socket fd + a server socket fd per connection). A real client is a separate process.

import http from "node:http";
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function fdCount(): number {
  for (const dir of ["/dev/fd", "/proc/self/fd"]) {
    try {
      return readdirSync(dir).length;
    } catch {
      // next location
    }
  }
  return -1;
}

const snapshot = () => {
  const m = process.memoryUsage();
  return `fds=${fdCount()} rss=${mb(m.rss)} heapUsed=${mb(m.heapUsed)}`;
};

const resources = () => process.getActiveResourcesInfo().join(" ");

// `_handle` is a Node internal (untyped); read the raw fd/handle type defensively.
type RawHandle = { fd?: number; constructor?: { name?: string } };
const handle = (sock: unknown): RawHandle => (sock as { _handle?: RawHandle })._handle ?? {};

const start = process.hrtime.bigint();
const log = (who: string, msg: string) => {
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  console.log(`${ms.toFixed(1).padStart(7)}ms  [${who}] ${msg}`);
};

function kernelView(): void {
  try {
    const out = execFileSync("lsof", ["-nP", "-a", "-p", String(process.pid), "-iTCP"], {
      encoding: "utf8",
    });
    const lines = out.split("\n").filter((l) => /TCP/.test(l));
    for (const line of lines) log("kernel", `lsof: ${line.replace(/\s+/g, " ").trim()}`);
  } catch {
    log("kernel", "lsof unavailable (skip)");
  }
}

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

const server = http.createServer(((req, res) => {
  const sock = req.socket;
  log("server", `request ${req.method} ${req.url}`);
  log("server", `  server socket fd=${handle(sock).fd} type=${handle(sock).constructor?.name} peer=${sock.remoteAddress}:${sock.remotePort}`);
  log("server", `  ${snapshot()}`);
  log("server", `  active resources: ${resources()}`);
  res.end("ok\n");
}) as Handler);

server.on("connection", (sock) => {
  log("server", `TCP connection accepted  socket fd=${handle(sock).fd}  ${snapshot()}`);
});

const get = (port: number, agent: http.Agent, label: string) =>
  new Promise<void>((resolve) => {
    log("client", `${label}: connecting`);
    http.get({ port, host: "127.0.0.1", agent }, (res) => {
      res.resume();
      res.on("end", () => {
        log("client", `${label}: response done  ${snapshot()}`);
        resolve();
      });
    });
  });

server.listen(0, "127.0.0.1", async () => {
  const { port } = server.address() as { port: number };
  log("demo", `server listening on 127.0.0.1:${port} (pid ${process.pid})`);
  log("demo", `baseline  ${snapshot()}`);
  log("demo", `baseline resources: ${resources()}`);

  // 1 + 2: keep-alive agent reuses ONE connection for two requests.
  const keepAlive = new http.Agent({ keepAlive: true, maxSockets: 1 });
  await get(port, keepAlive, "req 1 (opens connection)");
  await get(port, keepAlive, "req 2 (reuses same connection)");
  log("demo", "connection still open (keep-alive); asking the kernel:");
  kernelView();
  keepAlive.destroy();

  // 3: a brand-new agent opens a NEW connection -> a new socket fd.
  await get(port, new http.Agent(), "req 3 (new connection)");

  server.close(() => {
    log("demo", `after close  ${snapshot()}`);
    log("demo", `final resources: ${resources()}`);
  });
});

// Actual output (fds/ports/addresses vary by machine):
//
//    4.5ms  [demo] server listening on 127.0.0.1:62614 (pid 42502)
//    5.4ms  [demo] baseline  fds=14 rss=79.8 MB heapUsed=11.1 MB
//    5.4ms  [demo] baseline resources: PipeWrap TCPServerWrap PipeWrap
//    5.5ms  [client] req 1 (opens connection): connecting
//    8.9ms  [server] TCP connection accepted  socket fd=14  fds=16 ...
//    9.9ms  [server] request GET /
//   10.0ms  [server]   server socket fd=14 type=TCP peer=127.0.0.1:62615
//   10.2ms  [server]   fds=16 rss=80.2 MB heapUsed=11.3 MB
//   10.2ms  [server]   active resources: PipeWrap TCPServerWrap PipeWrap TCPSocketWrap TCPSocketWrap
//   13.2ms  [client] req 1 (opens connection): response done  fds=16 ...
//   13.6ms  [client] req 2 (reuses same connection): connecting
//   13.9ms  [server] request GET /
//   13.9ms  [server]   server socket fd=14 type=TCP peer=127.0.0.1:62615   <- same fd
//   14.5ms  [demo] connection still open (keep-alive); asking the kernel:
//   59.4ms  [kernel] lsof: node 42502 ... 12u IPv4 ... TCP 127.0.0.1:62614 (LISTEN)
//   59.5ms  [kernel] lsof: node 42502 ... 13u IPv4 ... TCP 127.0.0.1:62615->127.0.0.1:62614 (ESTABLISHED)
//   59.5ms  [kernel] lsof: node 42502 ... 14u IPv4 ... TCP 127.0.0.1:62614->127.0.0.1:62615 (ESTABLISHED)
//   60.8ms  [server] TCP connection accepted  socket fd=15  fds=17 ...   <- new connection, new fd
//   61.8ms  [demo] after close  fds=14 ...
//
// Note `socket fd=14` above equals the kernel's `14u` lsof row: the number Node reports
// is the actual kernel file-descriptor-table index. `12u` is the listening socket.
