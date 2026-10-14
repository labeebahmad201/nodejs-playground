// 18-x-forwarded-for/index.ts
//
// What is `X-Forwarded-For`, and why does a Node server behind a proxy need it?
//
// The core problem: `req.socket.remoteAddress` is the address of the **immediate
// TCP peer** — i.e. the proxy / load balancer — NOT the end user. Every request
// arriving through the same proxy looks like it came from the proxy's IP.
//
// `X-Forwarded-For` (XFF) is the de-facto standard header proxies use to carry
// the real client address forward, appending one entry per hop.
//
// This demo runs a real origin + proxy on loopback and shows:
//   1) direct (no proxy)          -> remoteAddress IS the client
//   2) behind one proxy           -> remoteAddress is the PROXY; XFF has the client
//   3) a spoofed XFF from a client-> never trust the left of the list
//   4) the sibling headers        -> X-Real-IP, Forwarded (RFC 7239)
//
// Run:  node index.ts

import http from "node:http";
import type { AddressInfo } from "node:net";

// Two different loopback families so the proxy and the client have DISTINCT
// addresses: origin (the app) on IPv6 ::1, proxy (the edge) on IPv4 127.0.0.1.
const ORIGIN_HOST = "::1";
const PROXY_HOST = "127.0.0.1";
const TRUSTED_HOPS = 1; // how many proxies WE control sit in front of the app

type View = {
  remoteAddress: string | undefined; // req.socket.remoteAddress — the last hop
  xff: string | undefined; // X-Forwarded-For, raw
  xRealIp: string | undefined; // X-Real-IP (single-IP alternative)
  forwarded: string | undefined; // Forwarded (RFC 7239, standardized)
  naive: string | undefined; // buggy app: uses remoteAddress blindly
  firstOfXff: string | undefined; // naive parse: trust the LEFTMOST XFF entry
  trusted: string | undefined; // correct parse: trust the RIGHTMOST N hops
};

// XFF is "client, proxy1, proxy2, ..." — each proxy APPENDS the peer it saw.
// The rightmost `trustedHops` entries were written by proxies we control, so the
// real client is the entry just left of them: index (length - trustedHops).
function clientIp(xff: string | undefined, trustedHops: number): string | undefined {
  if (!xff) return undefined;
  const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  const idx = parts.length - trustedHops;
  return parts[idx < 0 ? 0 : idx];
}

const origin = http.createServer((req, res) => {
  const xff = req.headers["x-forwarded-for"] as string | undefined;
  const view: View = {
    remoteAddress: req.socket.remoteAddress,
    xff,
    xRealIp: req.headers["x-real-ip"] as string | undefined,
    forwarded: req.headers["forwarded"] as string | undefined,
    naive: req.socket.remoteAddress,
    firstOfXff: xff?.split(",")[0]?.trim(),
    trusted: clientIp(xff, TRUSTED_HOPS),
  };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(view));
});

// A minimal reverse proxy: forwards to origin and adds the forwarded headers.
function makeProxy(originPort: number): http.Server {
  return http.createServer((req, res) => {
    const peer = req.socket.remoteAddress ?? "unknown";
    const existing = req.headers["x-forwarded-for"];
    const prior = Array.isArray(existing) ? existing.join(", ") : existing;
    const xff = prior ? `${prior}, ${peer}` : peer; // append, never overwrite
    const headers: http.OutgoingHttpHeaders = {
      ...req.headers,
      "x-forwarded-for": xff,
      "x-real-ip": peer, // single-IP alternative
      forwarded: `for=${peer};proto=http;by=${PROXY_HOST}`, // RFC 7239
    };
    delete headers.host;
    const upstream = http.request(
      { host: ORIGIN_HOST, port: originPort, method: req.method, path: req.url, headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      }
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end("bad gateway\n");
    });
    req.pipe(upstream);
  });
}

function listen(server: http.Server, host: string): Promise<number> {
  return new Promise((resolve) =>
    server.listen(0, host, () => resolve((server.address() as AddressInfo).port))
  );
}

function get(port: number, host: string, headers: http.OutgoingHttpHeaders = {}): Promise<View> {
  return new Promise((resolve, reject) => {
    const req = http.get({ host, port, path: "/", headers }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => (body += chunk));
      res.on("end", () => resolve(JSON.parse(body) as View));
    });
    req.on("error", reject);
  });
}

const show = (label: string, v: View) => {
  console.log(`  remoteAddress = ${v.remoteAddress}   <- what the app's TCP peer is`);
  console.log(`  xff           = ${v.xff ?? "(absent)"}`);
  console.log(`  naive app     = ${v.naive}   <- uses remoteAddress (wrong behind a proxy)`);
  console.log(`  first-of-xff  = ${v.firstOfXff ?? "(absent)"}   <- trusts the LEFTMOST (spoofable)`);
  console.log(`  trusted app   = ${v.trusted ?? "(absent)"}   <- trusts the RIGHTMOST ${TRUSTED_HOPS} hop(s)`);
  console.log(`  x-real-ip     = ${v.xRealIp ?? "(absent)"}`);
  console.log(`  forwarded     = ${v.forwarded ?? "(absent)"}`);
  console.log();
  void label;
};

async function main() {
  const originPort = await listen(origin, ORIGIN_HOST);
  const proxy = makeProxy(originPort);
  const proxyPort = await listen(proxy, PROXY_HOST);

  console.log(`origin (the app)  listening on [${ORIGIN_HOST}]:${originPort}`);
  console.log(`proxy  (the edge) listening on  ${PROXY_HOST}:${proxyPort}\n`);

  console.log("1) DIRECT — client connects straight to the app, no proxy:");
  const direct = await get(originPort, ORIGIN_HOST);
  console.log(`   remoteAddress=${direct.remoteAddress}  xff=${direct.xff ?? "(absent)"}`);
  console.log("   -> no proxy means remoteAddress really is the client, and XFF is absent.\n");

  console.log("2) BEHIND A PROXY — the app can no longer see the client directly:");
  const proxied = await get(proxyPort, PROXY_HOST);
  console.log(`   proxy saw the client as ${PROXY_HOST} and appended it to XFF`);
  show("proxied", proxied);
  console.log(`   -> remoteAddress is ${proxied.remoteAddress} (the PROXY), not ${PROXY_HOST} (the client).`);
  console.log(`   -> the real client ${PROXY_HOST} survives ONLY in X-Forwarded-For.\n`);

  console.log("3) SPOOFED XFF — a client lies about its own address:");
  const spoofed = await get(proxyPort, PROXY_HOST, { "x-forwarded-for": "9.9.9.9" });
  console.log(`   client sent  X-Forwarded-For: 9.9.9.9`);
  console.log(`   proxy appended the REAL peer  -> xff = "${spoofed.xff}"`);
  show("spoofed", spoofed);
  console.log(`   -> "first-of-xff" trusts 9.9.9.9 (the attacker's lie).`);
  console.log(`   -> "trusted app" (rightmost ${TRUSTED_HOPS}) correctly gets ${spoofed.trusted}.\n`);

  origin.close();
  proxy.close();
}

await main();
