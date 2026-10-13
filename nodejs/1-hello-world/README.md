# 1. Hello world

Your first Node.js program: a function, output, and runtime info.

```sh
node 1-hello-world/index.ts
```

Expected:

```
Hello, world!
Node v24.x.x on darwin (arm64)
Running from: /path/to/nodejs-playground
```

## Notes

- Plain `node` runs this `.ts` file directly via native type stripping — no build step.
- `process` is the window into the runtime: version, platform, cwd, env, args.
- Type stripping can be disabled (the annotations then become syntax errors):

  ```sh
  node --no-strip-types 1-hello-world/index.ts
  node --no-experimental-strip-types 1-hello-world/index.ts
  ```
