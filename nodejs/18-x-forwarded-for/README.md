# 18. X-Forwarded-For — finding the real client behind a proxy

Why does a Node server behind a load balancer see **every** request coming from the same IP?
Because `req.socket.remoteAddress` is the address of the **immediate TCP peer** — the proxy — not
the user. `X-Forwarded-For` is the de-facto standard header proxies use to pass the real client
address forward. This dir explains what it is, why you need it, and the trap that makes it
dangerous if you trust it naively.

```
18-x-forwarded-for/
├── index.ts    # a real origin + proxy on loopback; prints what each one sees
└── README.md
```

Run it:

```sh
node index.ts
```

## The problem, in one picture

```
        without a proxy                     behind a proxy
  ┌────────┐        ┌────────┐        ┌────────┐   ┌────────┐   ┌────────┐
  │ client │──TCP──▶│  app   │        │ client │──▶│ proxy  │──▶│  app   │
  └────────┘        └────────┘        └────────┘   └────────┘   └────────┘
   app sees:          client IP          app sees:   the PROXY's IP
```

TCP only knows the last hop. The proxy terminates the client's connection and opens a **new**
connection to your app, so your app's peer is the proxy. Every user collapses into one address:
you can't rate-limit per user, your logs say "127.0.0.1", and geo/abuse detection break.

`X-Forwarded-For` fixes this by carrying the client address **in a header**, across the hop.

## What it is

`X-Forwarded-For` (XFF) is a **de-facto standard** request header: a comma-separated list of IP
addresses. Each proxy **appends** the address of the peer it received the request from.

```
X-Forwarded-For: <client>, <proxy1>, <proxy2>, ...
                  ▲                          ▲
   the original client            the most recent proxy
   (claimed — see "the catch")
```

The model, stated cleanly:

```
remoteAddress  = the LAST hop's IP        (your TCP peer — the proxy)
X-Forwarded-For= the chain of hops,        appended one entry per proxy
                 leftmost = original client (claimed), rightmost = most recent hop
```

It is **not** part of any official HTTP spec — it grew out of the Squid proxy and stuck. The
standardized equivalent is `Forwarded` (RFC 7239), below.

## Who sets it, and how the string grows

The **intermediary** sets it — the proxy / load balancer. Not the client, and not your app. Each
proxy **appends** the IP of the peer it received the request from, so the header is built up one
entry per hop:

```
client ──▶ proxy1 ──▶ proxy2 ──▶ your app
             │           │
             │           └─ appends proxy1's IP   → "client, proxy1"
             └─ appends the client's IP            → "client"
app receives:  X-Forwarded-For: client, proxy1
```

Because each hop **appends** (it doesn't overwrite), the list grows left-to-right in
chronological order:

```
"client"            → after proxy1 appends the client
"client, proxy1"    → after proxy2 appends proxy1
```

Two consequences fall straight out of that:

- **Left = oldest / nearest the client; right = newest / nearest you.** Appending means the
  list is chronological — which is exactly why the trusted parse counts from the **right**.
- **A client-forged value lands on the left** and survives (append, not overwrite), so the
  leftmost entry is the untrustworthy one.

How each hop is configured:

| Where | What sets it |
|---|---|
| **nginx** | `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` → appends `$remote_addr` |
| **AWS ALB / ELB** | set automatically (client IP + any upstream proxies) |
| **Cloudflare** | sets `X-Forwarded-For` and `CF-Connecting-IP` (single, CF-overwritten) |
| **HAProxy** | `option forwardfor` → appends |
| **your own Node proxy** | you write it yourself: `xff = prior ? \`${prior}, ${peer}\` : peer` (see `index.ts`) |

Some proxies **overwrite** instead of appending (e.g. Cloudflare's `CF-Connecting-IP` is a single
value it controls). That's why a single-value header is safer to trust than an appended list.

## Why we need it

Anything that must identify the *client* — not the proxy — depends on it:

| Use case | Why the proxy IP is useless |
|---|---|
| **Rate limiting / throttling** | Otherwise all users share one bucket and throttle each other. |
| **Logging / analytics** | You log the LB instead of the visitor. |
| **Geo / regional routing** | The LB's region isn't the user's. |
| **Access control / IP allowlists** | You can only allow/deny the proxy. |
| **Abuse & bot detection** | You can't see who is actually hammering you. |
| **Session affinity** | Sticky routing needs the real source. |

This is exactly the trap in [`../17-ratelimiter-leak`](../17-ratelimiter-leak): a rate limiter
keyed by client IP. Read the *proxy's* IP and you have **one** global bucket; read the *client's*
IP and — if the key space is unbounded — you get the cardinality that leaked memory.

## What the demo shows

`index.ts` starts a real origin (the app) on IPv6 `::1` and a proxy on IPv4 `127.0.0.1`, so the
client and the proxy have **distinct** loopback addresses. Real output (Node v24):

```
origin (the app)  listening on [::1]:62063
proxy  (the edge) listening on  127.0.0.1:62064

1) DIRECT — client connects straight to the app, no proxy:
   remoteAddress=::1  xff=(absent)
   -> no proxy means remoteAddress really is the client, and XFF is absent.

2) BEHIND A PROXY — the app can no longer see the client directly:
   proxy saw the client as 127.0.0.1 and appended it to XFF
  remoteAddress = ::1   <- what the app's TCP peer is
  xff           = 127.0.0.1
  naive app     = ::1   <- uses remoteAddress (wrong behind a proxy)
  first-of-xff  = 127.0.0.1   <- trusts the LEFTMOST (spoofable)
  trusted app   = 127.0.0.1   <- trusts the RIGHTMOST 1 hop(s)
  x-real-ip     = 127.0.0.1
  forwarded     = for=127.0.0.1;proto=http;by=127.0.0.1
   -> remoteAddress is ::1 (the PROXY), not 127.0.0.1 (the client).
   -> the real client 127.0.0.1 survives ONLY in X-Forwarded-For.

3) SPOOFED XFF — a client lies about its own address:
   client sent  X-Forwarded-For: 9.9.9.9
   proxy appended the REAL peer  -> xff = "9.9.9.9, 127.0.0.1"
  remoteAddress = ::1   <- what the app's TCP peer is
  xff           = 9.9.9.9, 127.0.0.1
  naive app     = ::1   <- uses remoteAddress (wrong behind a proxy)
  first-of-xff  = 9.9.9.9   <- trusts the LEFTMOST (spoofable)
  trusted app   = 127.0.0.1   <- trusts the RIGHTMOST 1 hop(s)
   -> "first-of-xff" trusts 9.9.9.9 (the attacker's lie).
   -> "trusted app" (rightmost 1) correctly gets 127.0.0.1.
```

Read the three cases:

- **Direct:** `remoteAddress` is the client; XFF is absent (nobody added it).
- **Proxy:** `remoteAddress` is the **proxy** (`::1`); the client (`127.0.0.1`) is only in XFF.
- **Spoof:** the client sent its own XFF. Because the proxy *appends*, the fake value sits
  **leftmost** — so "take the first entry" gets the attacker's lie.

## Parsing it correctly

Never take the leftmost entry. XFF is client-controllable; only the entries written by proxies
**you control** are trustworthy. If you know there are `N` trusted proxies in front of your app,
the real client is the entry just left of those `N` trusted ones:

```ts
function clientIp(xff: string | undefined, trustedHops: number): string | undefined {
  if (!xff) return undefined;
  const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  const idx = parts.length - trustedHops;     // rightmost N are trusted
  return parts[idx < 0 ? 0 : idx];
}
```

```
X-Forwarded-For: 9.9.9.9, 127.0.0.1     trustedHops = 1
                 └ fake ┘  └─ real ─┘
take parts[2-1] = parts[1] = 127.0.0.1   ✅   (parts[0] would be the spoof)
```

Two rules:

1. **Trust by hop count, not by position.** Configure how many proxies are in front, then count
   from the **right**. Extra entries on the left are untrusted noise (or an attack).
2. **Only when the header is set/overwritten by a trusted proxy.** If the header can reach your
   app without passing a trusted proxy, it means nothing.

## The catch: it's a header, and headers are just strings

`X-Forwarded-For` is trivially forged. If your app trusts it without a trusted proxy in front,
an attacker sets `X-Forwarded-For: 10.0.0.1` and **bypasses your IP allowlist / rate limit**, or
poisons your logs and analytics. This is why:

- **Configure the proxy to overwrite or append correctly**, and make sure your app is *only*
  reachable through it (bind to the private interface, security group, etc.).
- **Never trust XFF on a directly-exposed server.**
- **Pick the right hop count.** Too low and you trust attacker input; too high and you fall back
  to a proxy's address (or `undefined`).

Frameworks encode this as a **"trust proxy"** setting:

| Runtime | Setting | Result |
|---|---|---|
| **Express** | `app.set("trust proxy", 1)` (or `true`, a subnet, a function) | `req.ip` and `req.ips` respect it |
| **Fastify** | `fastify({ trustProxy: true })` or a number | `request.ip` / `request.ips` |
| **nginx** | `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` | appends the peer |
| **AWS ALB** | automatic | appends client IP + any upstream proxies; also `X-Forwarded-Proto` / `-Port` |
| **Cloudflare** | automatic | sets `CF-Connecting-IP` (single, CF-controlled) and XFF |

> Express's `trust proxy` is the canonical mental model: you tell it **how many** (or **which**)
> proxies to trust, and `req.ip` returns the address *before* that trusted chain.

## Sibling headers

- **`X-Real-IP`** — a **single** IP, not a list. Often set by nginx to `$remote_addr`. Simple, but
  it loses the chain (and is just as spoofable if not set by a trusted proxy).
- **`Forwarded`** (RFC 7239) — the **standardized** replacement:
  ```
  Forwarded: for=192.0.2.60;proto=http;by=203.0.113.43
  Forwarded: for=192.0.2.43, for="[2001:db8:cafe::17]"
  ```
  It can carry `for=`, `by=`, `proto=`, `host=`, and IPv6 is quoted. Less universally deployed than
  XFF, but unambiguous and extensible.
- **`X-Forwarded-Proto` / `X-Forwarded-Host` / `X-Forwarded-Port`** — the same idea for scheme,
  host, and port, so the app can reconstruct the original request (needed for correct redirects,
  secure cookies, HSTS, and absolute URLs).

## The `host` header, briefly

A related trap: the proxy should also forward the **original** `Host` (via `X-Forwarded-Host`),
because the app's `Host` becomes the proxy's. This matters for virtual hosts, cookie domains, and
redirect URLs — the same "the last hop replaced the truth" problem.

## One-line summary

**`remoteAddress` is your TCP peer (the proxy). `X-Forwarded-For` carries the real client, one
entry appended per hop. Trust only the rightmost entries written by proxies you control — never
the leftmost, which any client can forge.**

## References

- MDN — `X-Forwarded-For`: <https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For>
- MDN — `Forwarded`: <https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Forwarded>
- RFC 7239 — *Forwarded HTTP Extension*: <https://www.rfc-editor.org/rfc/rfc7239>
- Express — *Behind proxies* (`trust proxy`, `req.ip`, `req.ips`):
  <https://expressjs.com/en/guide/behind-proxies.html>
- Fastify — `trustProxy`: <https://fastify.dev/docs/latest/Reference/Server/>
- nginx — `ngx_http_proxy_module` (`$proxy_add_x_forwarded_for`):
  <https://nginx.org/en/docs/http/ngx_http_proxy_module.html>
- AWS — Application Load Balancer X-Forwarded headers:
  <https://docs.aws.amazon.com/elasticloadbalancing/latest/application/x-forwarded-headers.html>
- Cloudflare — HTTP request headers (`CF-Connecting-IP`):
  <https://developers.cloudflare.com/fundamentals/reference/http-request-headers/>
- Node.js — `http` (`req.socket.remoteAddress`): <https://nodejs.org/api/http.html>
- Production "war stories" (Netflix / RisingStack / nearForm), incl. a real *handler
  accumulation* leak: <https://blog.risingstack.com/node-js-war-stories-solving-issues-in-production-2/>
- Related dirs: [`../17-ratelimiter-leak`](../17-ratelimiter-leak) (client-IP keyed cache),
  [`../13-sockets`](../13-sockets) (the TCP peer), [`../12-http-agent`](../12-http-agent)
