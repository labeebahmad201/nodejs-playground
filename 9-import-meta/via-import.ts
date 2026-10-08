// Importing esm.ts shows `import.meta.main` is false there.
// Run: `node via-import.ts`
//
// The process entry point is THIS file, so in esm.ts (loaded as a dependency)
// import.meta.main reports false while every other property still describes esm.ts.

console.log("entry module: via-import.ts");
console.log("(esm.ts is imported below; its import.meta.main should be false)\n");

await import("./esm.ts");
