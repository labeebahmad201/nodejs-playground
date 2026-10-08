# 2. HTTP server

A minimal HTTP server using the standard library — no framework.

```sh
node 2-http-server/index.ts
```

In another terminal:

```sh
curl http://localhost:3000/anything
# {"ok":true,"method":"GET","path":"/anything"}
```

Override the port with `PORT=4000 node 2-http-server/index.ts`.

## Notes

- Node ships an HTTP server in its standard library (`node:http`).
- This is the seed for later load-testing lessons — a running target to hit.
