import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const publicRoot = resolve(fileURLToPath(new URL("./public/", import.meta.url)));
const port = Number(process.env.PORT ?? 4310);
const host = process.env.HOST ?? "127.0.0.1";

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".ico", "image/x-icon"],
]);

function fileFor(url: string | undefined): string | null {
  let pathname: string;

  try {
    pathname = decodeURIComponent(new URL(url ?? "/", "http://localhost").pathname);
  } catch {
    return null;
  }

  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(publicRoot, `.${requested}`);

  if (filePath !== publicRoot && !filePath.startsWith(publicRoot + sep)) {
    return null;
  }

  return filePath;
}

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD" });
    res.end("Method not allowed");
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/api/health") {
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const filePath = fileFor(req.url);

  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const info = await stat(filePath);

    if (!info.isFile()) {
      throw new Error("not a file");
    }

    const body = await readFile(filePath);

    res.writeHead(200, {
      "content-type": contentTypes.get(extname(filePath)) ?? "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Event Storming Canvas: http://${host}:${port}`);
  console.log("Press Ctrl+C to stop.");
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
