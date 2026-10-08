// CommonJS equivalents. There is NO `import.meta` in CJS — it's ESM-only.
// Run: `node cjs.cjs`
//
// CJS exposes the module's own location through free globals instead of import.meta.

console.log("CJS globals (the CJS counterparts to import.meta):");
console.log("  __filename          :", __filename);
console.log("  __dirname           :", __dirname);
console.log("  require.resolve     :", require.resolve("./cjs.cjs"));
console.log("  require.main === module (is entry):", require.main === module);
