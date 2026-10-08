# 3. Type checking

Node does **not** type-check the code it runs — type stripping only erases types.
`index.ts` contains a deliberate type error so you can see the difference.

```sh
node 3-type-checking/index.ts   # prints 12, exit 0 — types ignored at runtime
npx tsc --noEmit                # error TS2345, exit 2 — the compiler catches it
```

Install the toolchain first (shared at the repo root: `typescript`, `@types/node`):

```sh
npm install
npm run typecheck               # same as: tsc --noEmit
```

## Type-check then run in one command

```sh
npx tsc --noEmit && node index.ts
```

Note: with the shared root `tsconfig.json`, `tsc --noEmit` checks *all* examples, so the
`&&` chain stops if any example has a type error. To scope the check to a single file,
pass it explicitly: `npx tsc --noEmit index.ts && node index.ts`.

## Notes

- Run type checking as a separate step in CI; it's not run by `node`.
- The root `tsconfig.json` uses `noEmit`, `erasableSyntaxOnly`, and
  `verbatimModuleSyntax` to match Node's type-stripping behavior.
