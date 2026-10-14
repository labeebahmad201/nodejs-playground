import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3005);

const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, method: req.method, path: req.url }));
});

server.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
