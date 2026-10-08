# 6. Modules — ESM vs CJS

Node has **two module systems**:

- **CJS** — CommonJS, Node's original system: `require()` / `module.exports`.
- **ESM** — ECMAScript Modules, the JS standard: `import` / `export`.

Same goal (split code into files, share values); different syntax *and* different
loading behavior. This example runs both, side by side.

## How Node decides which system a file uses

1. **File extension (always wins):**
   - `.cjs` → CommonJS
   - `.mjs` → ESM
   - `.ts` / `.js` → depends on `package.json`'s `"type"` field:
     - `"type": "module"` → **ESM**
     - absent or `"type": "commonjs"` → **CJS**
2. Plain `.js`/`.ts` fall back to `package.json`.

**This repo has `"type": "module"`**, so its `.js`/`.ts` files are ESM (that's why
everything uses `import`). Here we use explicit `.mjs`/`.cjs` so the lesson doesn't
depend on `package.json`.

## Side by side

**ESM** — `esm-lib.mjs` exports, `esm.mjs` imports:

```js
// esm-lib.mjs
export const name = "esm-lib";
export function greet(who) { return `hello ${who} from ESM`; }
export default function add(a, b) { return a + b; }
```
```js
// esm.mjs
import add, { greet, name } from "./esm-lib.mjs";   // note the .mjs extension
console.log(greet("world"));
const msg = await Promise.resolve("top-level await works in ESM");
```

**CJS** — `cjs-lib.cjs` exports, `cjs.cjs` requires:

```js
// cjs-lib.cjs
const tag = "cjs-lib";
function greet(who) { return `hello ${who} from CJS`; }
module.exports = { tag, greet };
```
```js
// cjs.cjs
const { tag, greet } = require("./cjs-lib.cjs");   // extension optional in CJS
console.log(greet("world"), tag, __filename, __dirname);
```

## Run it

```sh
node esm.mjs
node cjs.cjs
node interop.cjs
```

## Actual output

```
########## node esm.mjs ##########
== ESM (.mjs) ==
greet: hello world from ESM
name: esm-lib
default export add(2, 3): 5
import.meta.filename: /Users/labeeb/Documents/projects/nodejs-playground/6-modules/esm.mjs
top-level await works in ESM

########## node cjs.cjs ##########
== CommonJS (.cjs) ==
greet: hello world from CJS
tag: cjs-lib
__filename: /Users/labeeb/Documents/projects/nodejs-playground/6-modules/cjs.cjs
__dirname: /Users/labeeb/Documents/projects/nodejs-playground/6-modules

########## node interop.cjs ##########
== CommonJS loading ESM via dynamic import() ==
greet via import(): hello cjs from ESM
name via import(): esm-lib
```

## The differences that matter

| | CommonJS (`.cjs`) | ESM (`.mjs`) |
|---|---|---|
| Import / export | `require()` / `module.exports` | `import` / `export` |
| When resolved | synchronously, at call time | whole graph resolved *before* running |
| Top-level `await` | not allowed | allowed |
| Own location | `__dirname`, `__filename` | `import.meta.dirname`, `import.meta.filename` |
| Import path extension | optional | **required** (`./lib.mjs`, not `./lib`) |
| Static analysis | no | yes (enables bundlers/tree-shaking) |
| `this` at top level | `module.exports` | `undefined` |

## Interop

- **ESM importing CJS:** `import pkg from "some-cjs-pkg"` — the CJS `module.exports`
  becomes the default export.
- **CJS importing ESM:** you *cannot* `require()` an ESM module from CJS; use dynamic
  `import()`, which returns a promise (see `interop.cjs`).
- **ESM needing `require`:** use `const require = createRequire(import.meta.url)`.

## When to use which

**Default to ESM** for anything new. Use CJS only when something forces you to.

Use **ESM** when you:

- Are starting a new project, package, or library.
- Need top-level `await`.
- Want static `import`/`export` so bundlers can tree-shake and tools can analyze it.
- Share code between Node and the browser (browsers are ESM-only).
- Want to stay on the path Node itself is standardizing toward.

Use **CJS** when you:

- Maintain an older codebase or a dependency that isn't ESM-ready (increasingly rare).
- Must call `require()` **synchronously and conditionally** at runtime — `import()` is
  async, so it can't drop into a sync code path.
- Have tooling/config files that only understand `require`.
- Rely on `__dirname`/`__filename` and don't want the `import.meta` equivalents.

Interop rule of thumb: **ESM can consume CJS**; **CJS can only consume ESM via dynamic
`import()`**. So if you must choose one direction to depend on, wrap the legacy bit.

Rule of thumb: *ESM by default, CJS for the legacy edges.* Pick one per package and
only cross the boundary deliberately.

## Gotchas

- In **ESM**, `__dirname`, `__filename`, and `require` do **not** exist — using them
  throws `ReferenceError`. Use `import.meta.*` and `createRequire`.
- In **ESM**, relative import specifiers need the extension: `./esm-lib.mjs`, not
  `./esm-lib`.
- In **CJS**, `require()` is synchronous and can be called anywhere; ESM `import` is
  static and hoisted to the top.

## Why this explains the event-loop gotcha

ESM modules are evaluated by a **promise-driven async machine**, so top-level ESM code
is already inside a V8 microtask drain. That's why, in `5-event-loop`, the promise
microtask ran before the `process.nextTick` callback. CJS is invoked synchronously at
startup, so `nextTick` drains first there.

## TypeScript

The same split exists in TS: `.mts` → ESM, `.cts` → CJS, and `.ts` follows
`package.json`'s `"type"` — exactly like `.mjs`/`.cjs`/`.js`.
