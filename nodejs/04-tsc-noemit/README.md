# 4. `--noEmit` is a TypeScript flag, not a Node.js flag

**`--noEmit` belongs to `tsc`, the TypeScript compiler — it has nothing to do with
Node.js.** If you thought it was a Node runtime option, that's the mix-up this
directory clears up. Node has no `--noEmit`.

## Why the confusion

Node can *run* TypeScript files (via type stripping), but Node does **not** type-check
them and has no compiler-emit step. Producing/checking types is the job of `tsc`, a
separate tool you invoke yourself (`npx tsc`).

So:

| Flag | Belongs to | Meaning |
|------|-----------|---------|
| `--noEmit` | `tsc` (TypeScript) | Type-check only; write no output files |
| `--no-strip-types` | `node` (Node.js) | Turn off Node's type stripping |

## What `--noEmit` does

- Runs the full type check and reports errors (exits non-zero on failure).
- Writes **nothing** — no `.js`, no `.d.ts`, no source maps.
- It does **not** skip type checking. (To skip checking, that's `--noCheck`, TS 5.6+.)

## See the difference

`tsc` without `--noEmit` compiles and writes JavaScript next to the source:

```sh
npx tsc index.ts             # creates index.js
npx tsc --noEmit index.ts    # checks only; creates nothing
```

Verify with `ls` after each.

## This is why we use `--noEmit`

Node runs our `.ts` files directly, so we never need emitted `.js`. We only want the
type check — hence `tsc --noEmit` (see the root `npm run typecheck`).
