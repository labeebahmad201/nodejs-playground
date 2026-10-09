// Sockets — the endpoint object (vs the port, which is just a number).
// Run: `node index.ts`
//
// The model we settled on:
//   - port      = a number (an address component)
//   - socket    = the endpoint OBJECT (kernel object + fd) that carries bytes
//   - connection= a pair of sockets (one at each end), named by the 5-tuple
//   - listener  = a socket that only accepts; each accept -> a NEW connection socket
//   - the KERNEL demuxes incoming packets to the right connection socket by 5-tuple
//
// This shows: one listener + one socket per connection (same server port, different
// client ports), and the UDP contrast (one socket serves ALL peers).

import net from "node:net";
import dgram from "node:dgram";

const rule = (t: string) => console.log(`\n=== ${t} ===`);
const ignore = () => {};
type RawHandle = { fd?: number };
const fd = (s: unknown) => (s as { _handle?: RawHandle })._handle?.fd ?? "?";

// ---------------------------------------------------------------------------
// 1. TCP: one LISTENING socket per port, one CONNECTION socket per client
// ---------------------------------------------------------------------------
rule("1. TCP — listener vs connection sockets");
const server = net.createServer();
server.on("error", ignore);
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const addr = server.address() as net.AddressInfo;
console.log(`listening socket: ${addr.address}:${addr.port}   (the ONE socket that owns the port)`);

server.on("connection", (sock) => {
  sock.on("error", ignore);
  console.log(
    `[server] connection socket fd=${fd(sock)}  local=${sock.localAddress}:${sock.localPort}` +
      `  <-  remote=${sock.remoteAddress}:${sock.remotePort}`,
  );
  sock.once("data", () => sock.write("ok"));
});

const tcpClient = (label: string) =>
  new Promise<void>((resolve) => {
    const c = net.connect(addr.port, "127.0.0.1");
    c.on("error", ignore);
    c.on("connect", () => {
      console.log(
        `[${label}] socket fd=${fd(c)}  local=${c.localAddress}:${c.localPort}` +
          `  ->  remote=${c.remoteAddress}:${c.remotePort}`,
      );
      c.write("hi");
    });
    c.on("data", () => c.end());
    c.on("close", resolve);
  });

await Promise.all([tcpClient("client A"), tcpClient("client B")]);
console.log("=> two DISTINCT connection sockets at once, same server port, different client ports (5-tuple)");

// ---------------------------------------------------------------------------
// 2. UDP: ONE socket serves ALL peers (no per-connection socket)
// ---------------------------------------------------------------------------
rule("2. UDP — one socket, many peers (connectionless)");
const udp = dgram.createSocket("udp4");
udp.on("error", ignore);
await new Promise<void>((r) => udp.bind(0, "127.0.0.1", r));
const uaddr = udp.address();
console.log(`UDP socket bound ${uaddr.address}:${uaddr.port}   (ONE socket for every peer)`);

udp.on("message", (msg, rinfo) => {
  console.log(`[udp] the same socket got "${msg}" from ${rinfo.address}:${rinfo.port}  (use rinfo to reply)`);
  udp.send(`ack:${msg}`, rinfo.port, rinfo.address);
});

const udpSender = (label: string, msg: string) =>
  new Promise<void>((resolve) => {
    const s = dgram.createSocket("udp4");
    s.on("error", ignore);
    s.on("message", (reply) => {
      console.log(`[${label}] got reply "${reply}"`);
      s.close(resolve);
    });
    s.send(msg, uaddr.port, uaddr.address, () => {
      console.log(`[${label}] sent from ${s.address().address}:${s.address().port}`);
    });
  });

await udpSender("udp A", "ping-a");
await udpSender("udp B", "ping-b");

server.close();
udp.close();

// Actual output (ports/fds vary):
//
// === 1. TCP — listener vs connection sockets ===
// listening socket: 127.0.0.1:65384   (the ONE socket that owns the port)
// [server] connection socket fd=15  local=127.0.0.1:65384  <-  remote=127.0.0.1:65385
// [client A] socket fd=13  local=127.0.0.1:65385  ->  remote=127.0.0.1:65384
// [server] connection socket fd=16  local=127.0.0.1:65384  <-  remote=127.0.0.1:65386
// [client B] socket fd=14  local=127.0.0.1:65386  ->  remote=127.0.0.1:65384
// => two DISTINCT connection sockets at once, same server port, different client ports (5-tuple)
//
// === 2. UDP — one socket, many peers (connectionless) ===
// UDP socket bound 127.0.0.1:53830   (ONE socket for every peer)
// [udp A] sent from 0.0.0.0:60909
// [udp] the same socket got "ping-a" from 127.0.0.1:60909  (use rinfo to reply)
// [udp A] got reply "ack:ping-a"
// [udp B] sent from 0.0.0.0:51501
// [udp] the same socket got "ping-b" from 127.0.0.1:51501  (use rinfo to reply)
// [udp B] got reply "ack:ping-b"
