// Node strips the TypeScript types at runtime — no build step needed.
// Type stripping can be disabled, which turns the type annotations into syntax errors:
//   node --no-strip-types index.ts
//   node --no-experimental-strip-types index.ts
const greet = (name: string): string => `Hello, ${name}!`;

console.log(greet("world"));
console.log(`Node ${process.version} on ${process.platform} (${process.arch})`);
console.log(`Running from: ${process.cwd()}`);
