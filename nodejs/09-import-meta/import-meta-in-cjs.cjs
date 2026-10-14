// Intentional failure: `import.meta` does NOT exist in CommonJS.
// Run: `node import-meta-in-cjs.cjs`  ->  SyntaxError (fails to even parse).
//
// This file exists to prove the point: it's a syntax error, not a runtime undefined.

console.log(import.meta.url);
