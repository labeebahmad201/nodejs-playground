# 14. npx — run a package's binary without installing it

**One line:** `npm` *installs* packages; `npx` *runs* a binary that a package ships — from the
project's local `node_modules`, or fetched temporarily if it isn't there.

```sh
npx tsc --noEmit        # run the "tsc" command from the locally-installed typescript
npx cowsay hello        # not installed anywhere → npx fetches it, runs it, keeps it in cache
```

## The confusion: npm vs npx

They sound like the same thing but do different jobs:

| | `npm` | `npx` |
|---|---|---|
| Job | install / manage packages | **run a command** from a package |
| Writes to `node_modules`? | yes | **no** (only if the package is missing, into a cache) |
| Typical use | `npm install`, `npm run build` | `npx <tool> [args]` |

`npx` is the **runner** half. Since **npm 7** (2020) it ships *with* npm and is implemented as
`npm exec` — `npx` is now just an alias. (It began as a separate package in npm 5.2, 2017.)
Confirmed locally: `npx --help` prints the `npm exec` usage, and `npx -v` reports the npm
version.

## What "a binary from a package" is

A package can declare executables in its `package.json`:

```json
{ "name": "typescript", "bin": { "tsc": "./bin/tsc", "tsserver": "./bin/tsserver" } }
```

When npm installs a package, it creates a **shim/symlink for each `bin` entry** in
`node_modules/.bin/`. That directory is the "toolbox" of the project — `tsc`, `eslint`,
`prettier`, etc. live there as commands.

`npx tsc` = "find the `tsc` command in the project's toolbox and run it."

## Why we need it

You *could* live without it — but it removes three real pains:

1. **No global installs.** Installing tools globally (`npm i -g typescript`) causes **version
   drift**: one machine has `tsc` 4, another has 5, and "works on my machine" follows. With
   `npx`, each project pins its own tool version in `devDependencies`, and `npx tsc` runs
   *exactly that version*. The version travels with the repo.

2. **One-off tools, zero install.** Generators and utilities you run once
   (`npx create-next-app`, `npx serve`, `npx cowsay`) don't belong in your dependencies. `npx`
   fetches, runs, and leaves only a cache entry — your `node_modules` and `package.json` stay
   clean.

3. **No PATH gymnastics.** Without npx you'd type `./node_modules/.bin/tsc`, or add it to
   `PATH` yourself. `npx` finds the local binary for you.

So: **need** is strong for ad-hoc/one-off runs and for "use the project's pinned version";
it's a convenience over `npm run` for the rest.

## How `npx` resolves a command

```
npx tsc
  │
  ├─ 1. Is "tsc" in ./node_modules/.bin (or a parent)?   ── yes ──▶ run that (local version)
  │
  ├─ 2. Is it in the npm cache from a previous npx run?  ── yes ──▶ run it
  │
  └─ 3. Not found anywhere
        └─▶ npm prompts to install it, fetches it into the npx cache
            (~/.npm/_npx), runs it, and leaves it cached for next time
```

Key consequence: **if the tool is already a local dependency, `npx` downloads nothing** — it
just runs the local binary. That's the case in this repo (see below).

## The alternatives (and when to use which)

| Approach | Runs | Best for |
|---|---|---|
| `npx tsc` | local `node_modules/.bin/tsc` | ad-hoc, or "use the pinned version" |
| `./node_modules/.bin/tsc` | same file, explicit path | scripts/tools that can't rely on npx |
| `npm run typecheck` | whatever the script says | **repeated, project-defined commands** |
| `npm i -g typescript` | a global copy | avoid (version drift) |
| `npm exec -- tsc` | identical to `npx tsc` | when you prefer the canonical name |

Note: inside an `npm run` script, `node_modules/.bin` is **already on `PATH`**, so the script
can just say `tsc --noEmit` with no npx and no path. That's why a committed script beats a
remembered `npx` invocation for anything you run often.

## Common patterns

```sh
npx tsc --noEmit                 # run a local dev tool
npx -p typescript tsc --version  # ensure a package is present, then run a command from it
npx -c 'echo "$npm_package_name"'  # run a shell command with npm's env set up
npx typescript@5.4 tsc --version # pin a version (reproducible)
npx --yes cowsay hi              # auto-confirm the fetch of a missing package
```

## In this repo

`npx tsc --noEmit` works because `typescript` is a **local devDependency**, so npx runs
`node_modules/.bin/tsc` — no download, no global install, reproducible across machines.
The same command is wrapped as `npm run typecheck` (see `3-type-checking`, `4-tsc-noemit`).

## Footguns / security

- **`npx <unknown-package>` executes arbitrary code** — a package can run install scripts.
  Supply-chain risk is real. Prefer packages that are already local devDependencies, and pin
  versions (`pkg@1.2.3`) when you must fetch.
- **The name can shadow**: `npx foo` prefers a *local* `foo` over a remote one. Usually what
  you want, but be aware of typosquats on the registry for one-off runs.
- **Don't use `npx` in a hot path or CI for something that should be pinned** — commit it as a
  dependency and call it from an `npm run` script instead.

## One-line summary

`npx` = "run this package's command, using the **project-local** copy if there is one,
otherwise fetch it just-in-time" — it kills global installs and version drift for CLI tools.

## References

- npm docs, `npx` — <https://docs.npmjs.com/cli/v11/commands/npx>
- npm docs, `npm exec` — <https://docs.npmjs.com/cli/v11/commands/npm-exec>
- npm docs, `package.json` `bin` — <https://docs.npmjs.com/cli/v11/configuring-npm/package-json#bin>
- npm docs, *scripts* (why `node_modules/.bin` is on `PATH` in a script) —
  <https://docs.npmjs.com/cli/v11/using-npm/scripts>
- npm/npx (the original standalone package) — <https://github.com/npm/npx>
