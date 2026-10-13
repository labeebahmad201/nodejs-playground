// import.meta — module metadata available ONLY in ES modules.
// Run: `node esm.ts`
//
// `import.meta` is a special object the host (Node) fills in per module. Its own
// properties are host-defined, so what you get here is Node's set — not the browser's.

import { fileURLToPath } from "node:url";

const names = Object.getOwnPropertyNames(import.meta);
console.log("import.meta properties (Node):", names.join(", "));
console.log();

// `url` — this module's absolute location as a WHATWG URL with the `file:` scheme.
console.log("url      :", import.meta.url);

// `filename` / `dirname` — the same location as plain OS paths (Node's convenience).
console.log("filename :", import.meta.filename);
console.log("dirname  :", import.meta.dirname);

// `main` — true when this file is the process's entry point, false when it's imported.
console.log("main     :", import.meta.main);

// `resolve(specifier)` — turn a specifier into an absolute URL string (no existence check).
console.log("resolve  :", import.meta.resolve("./sibling.ts"));
console.log();

// The URL and the path are the SAME location, two representations. To go URL -> path,
// use fileURLToPath. (This is why `new URL("./worker.ts", import.meta.url)` works in
// 8-worker-threads: a URL is the reliable, cwd-independent way to point at a sibling.)
console.log("url is a URL, not a path:");
console.log("  fileURLToPath(url) === filename ?", fileURLToPath(import.meta.url) === import.meta.filename);
console.log("  new URL('./x.ts', import.meta.url).href =", new URL("./x.ts", import.meta.url).href);
