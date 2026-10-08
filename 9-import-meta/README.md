# 9. `import.meta` — module metadata (ESM only)

Where does the current file live? What's its URL? `import.meta` answers that — and it
**only exists in ES modules**. This example prints every `import.meta` property Node
provides, then shows the CommonJS equivalents and proves that `import.meta` in CJS is a
**syntax error**.

## What `import.meta` is

`import.meta` is a special object that the **host** (Node, the browser, Deno…) attaches
to every ES module. The object itself is part of the ECMAScript language, but its
**contents are host-defined** — so what you see in Node is Node's set, not the browser's.
It's computed per module, so two modules each see their *own* values.

## Answer: is it ESM-only?

**Yes.** `import.meta` is ESM-only. In CommonJS it isn't `undefined` at runtime — it
doesn't parse at all:

```
SyntaxError: Cannot use 'import.meta' outside a module
```

CJS was designed before ESM and exposes the module's location through **globals**
instead (`__filename`, `__dirname`, `require.resolve`). See `cjs.cjs` and
`import-meta-in-cjs.cjs`.

## Node's `import.meta` properties

Printed by `esm.ts` via `Object.getOwnPropertyNames(import.meta)`:

| Property | Type | Meaning |
|---|---|---|
| `import.meta.url` | `string` | This module's absolute URL, e.g. `file:///.../esm.ts` (a **URL**, not a path) |
| `import.meta.filename` | `string` | Same location as an OS path (`/.../esm.ts`) |
| `import.meta.dirname` | `string` | The containing directory as an OS path |
| `import.meta.main` | `boolean` | `true` only if this file is the process **entry point** |
| `import.meta.resolve(spec)` | `string` | Resolve a specifier to an absolute URL string |

Notes:

- `url` is standard across hosts; `filename`, `dirname` and `main` are **Node extensions**.
- `filename`/`dirname` were added in Node 20.11/21.2; `main` in Node 24.2. All present here.
- `resolve` does **not** check that the target exists — it only resolves.

### `url` vs `filename` — same place, two shapes

`import.meta.url` is a WHATWG `URL` (with the `file:` scheme), not a filesystem path.
To convert it, use `fileURLToPath`:

```ts
import { fileURLToPath } from "node:url";
fileURLToPath(import.meta.url) === import.meta.filename; // true
```

This is why `new URL("./worker.ts", import.meta.url)` (see `8-worker-threads`) is the
robust way to point at a sibling file: a URL resolved against `import.meta.url` is
anchored to the module, independent of the current working directory.

### `import.meta.main`

`esm.ts` run directly reports `main: true`. Run `via-import.ts`, which `await import`s
`esm.ts`, and the same line reports `main: false` — because the entry point is now
`via-import.ts`, not `esm.ts`. (Its CJS counterpart is `require.main === module`.)

## CJS equivalents

| ESM (`import.meta.*`) | CommonJS |
|---|---|
| `import.meta.url` | `require("node:url").pathToFileURL(__filename).href` |
| `import.meta.filename` | `__filename` |
| `import.meta.dirname` | `__dirname` |
| `import.meta.main` | `require.main === module` |
| `import.meta.resolve(s)` | `require.resolve(s)` |

## Run it

```sh
node esm.ts              # all import.meta properties (main: true)
node via-import.ts       # imports esm.ts -> import.meta.main is false
node cjs.cjs             # CJS globals that replace import.meta
node import-meta-in-cjs.cjs   # intentional SyntaxError
```

## Output

`node esm.ts`:

```
import.meta properties (Node): dirname, filename, main, resolve, url

url      : file:///.../9-import-meta/esm.ts
filename : /.../9-import-meta/esm.ts
dirname  : /.../9-import-meta
main     : true
resolve  : file:///.../9-import-meta/sibling.ts

url is a URL, not a path:
  fileURLToPath(url) === filename ? true
  new URL('./x.ts', import.meta.url).href = file:///.../9-import-meta/x.ts
```

`node via-import.ts` (note `main: false`):

```
entry module: via-import.ts
(esm.ts is imported below; its import.meta.main should be false)

import.meta properties (Node): dirname, filename, main, resolve, url
...
main     : false
...
```

`node cjs.cjs`:

```
CJS globals (the CJS counterparts to import.meta):
  __filename          : /.../9-import-meta/cjs.cjs
  __dirname           : /.../9-import-meta
  require.resolve     : /.../9-import-meta/cjs.cjs
  require.main === module (is entry): true
```

`node import-meta-in-cjs.cjs` (intentional failure):

```
SyntaxError: Cannot use 'import.meta' outside a module
    at wrapSafe (node:internal/modules/cjs/loader:1763:18)
```

## TypeScript note

The same rules apply per module system: `.mts` → ESM (has `import.meta`), `.cts` → CJS
(does not), and `.ts` follows `package.json`'s `"type"`. This repo is `"type": "module"`,
so the `.ts` files here are ESM.

## References

- ECMAScript, *import.meta* — <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import.meta>
- Node.js docs, *import.meta* — <https://nodejs.org/api/esm.html#importmeta>
- Node.js docs, *import.meta.resolve* — <https://nodejs.org/api/esm.html#importmetaresolvespecifier>
- Node.js docs, *fileURLToPath* — <https://nodejs.org/api/url.html#urlfileurltopathurl>
