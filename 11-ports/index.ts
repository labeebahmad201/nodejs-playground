// Ports — the 16-bit network endpoint number. What it is AND why the OS does it this way.
// Run: `node index.ts`
//
// Why ports exist at all: a host runs many services (web, db, ssh, your app) behind ONE
// IP address. The IP gets a packet to the machine; the PORT tells the kernel which socket
// (which process) on that machine should receive it. It's a demultiplexer.
//
// This example shows the three ways ports get chosen, and why:
//   - server binds a FIXED port  -> so clients can find it
//   - server binds port 0        -> "OS, pick any free one" (tests/demos, no collisions)
//   - client connects            -> kernel always assigns an EPHEMERAL source port
// plus: the 5-tuple, EADDRINUSE, and Unix sockets (which have no port).

import net from "node:net";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";

const range = (p: number) =>
  p <= 1023 ? "well-known/privileged" : p <= 49151 ? "registered" : "ephemeral";
const rule = (t: string) => console.log(`\n=== ${t} ===`);
const ignore = () => {}; // keep teardown (ECONNRESET/EPIPE) from crashing the demo

// ---------------------------------------------------------------------------
// 1. Bind to port 0 -> the OS picks a free ephemeral port.
//    WHY: avoids collisions. `listen(3000)` fails with EADDRINUSE if something is
//    already there; `listen(0)` always succeeds. You read back the real port below.
// ---------------------------------------------------------------------------
rule("1. server.listen(0) -> OS picks a free port");
const server = net.createServer();
server.on("error", ignore);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const addr = server.address() as net.AddressInfo;
console.log(`server.address() -> ${JSON.stringify(addr)}`);
console.log(`assigned port ${addr.port}  [${range(addr.port)}]`);
console.log("WHY: we asked for 'any', so the kernel handed us one from the ephemeral range.");

// ---------------------------------------------------------------------------
// 2. A client connecting gets its OWN ephemeral source port.
//    WHY: the server must be able to send the reply back, and distinguish this
//    connection from others. The client's source port is that return address.
// ---------------------------------------------------------------------------
rule("2. client gets its own ephemeral source port");
server.on("connection", (sock) => {
  sock.on("error", ignore);
  console.log(`[server] accepted  local=${sock.localAddress}:${sock.localPort}  remote=${sock.remoteAddress}:${sock.remotePort}`);
  sock.end();
});
const client = net.connect(addr.port, "127.0.0.1");
client.on("error", ignore);
await once(client, "connect");
console.log(`[client] local=${client.localAddress}:${client.localPort} [${range(client.localPort)}] -> remote=${client.remoteAddress}:${client.remotePort}`);
console.log("the connection is the 5-tuple: (TCP, clientIP, clientPort, serverIP, serverPort)");
console.log("WHY: the kernel demuxes by that tuple, so MANY connections share the server's one port.");
client.end();
await once(client, "close");

// ---------------------------------------------------------------------------
// 3. Binding a port that's already taken -> EADDRINUSE.
//    WHY fixed ports are risky: they can be occupied. Port 0 can never collide.
// ---------------------------------------------------------------------------
rule("3. bind to a FIXED port that is taken -> EADDRINUSE");
const conflict = net.createServer();
const err = await new Promise<NodeJS.ErrnoException | null>((resolve) => {
  conflict.once("error", resolve);
  conflict.listen(addr.port, "127.0.0.1", () => resolve(null));
});
console.log(err ? `second bind to ${addr.port} failed: ${err.code}` : "unexpectedly bound (?)");

// ---------------------------------------------------------------------------
// 4. Port 0 again -> a DIFFERENT free port.
//    WHY: this is why tests/CLIs use 0 — many instances, zero coordination.
// ---------------------------------------------------------------------------
rule("4. a second listen(0) -> a different free port");
const server2 = net.createServer();
server2.on("error", ignore);
await new Promise<void>((resolve) => server2.listen(0, "127.0.0.1", resolve));
const addr2 = server2.address() as net.AddressInfo;
console.log(`second server got port ${addr2.port}  [${range(addr2.port)}]`);

// ---------------------------------------------------------------------------
// 5. Unix-domain sockets have NO port.
//    WHY: same-host only, so there's no IP:port to demux on — the kernel uses a
//    filesystem path in place of the address. Faster (no TCP/IP stack).
// ---------------------------------------------------------------------------
rule("5. Unix-domain sockets have no port");
const sockPath = join(tmpdir(), `ports-demo-${process.pid}.sock`);
rmSync(sockPath, { force: true });
const unix = net.createServer();
unix.on("error", ignore);
await new Promise<void>((resolve) => unix.listen(sockPath, resolve));
console.log(`unix server.address() -> ${unix.address()}  (a path, not a port)`);

// Clean up so the process can exit.
server.close();
server2.close();
unix.close();
rmSync(sockPath, { force: true });

// Actual output (ports/addresses vary):
//
// === 1. server.listen(0) -> OS picks a free port ===
// server.address() -> {"address":"127.0.0.1","family":"IPv4","port":62640}
// assigned port 62640  [ephemeral]
//
// === 2. client gets its own ephemeral source port ===
// [client] local=127.0.0.1:62641 [ephemeral] -> remote=127.0.0.1:62640
// [server] accepted  local=127.0.0.1:62640  remote=127.0.0.1:62641
// ...
// === 3. bind to a FIXED port that is taken -> EADDRINUSE ===
// second bind to 62640 failed: EADDRINUSE
// === 4. a second listen(0) -> a different free port ===
// second server got port 62642  [ephemeral]
// === 5. Unix-domain sockets have no port ===
// unix server.address() -> /var/folders/.../ports-demo-12345.sock  (a path, not a port)
