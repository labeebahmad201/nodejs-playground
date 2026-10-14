import add, { greet, name } from "./esm-lib.mjs";

console.log("== ESM (.mjs) ==");
console.log("greet:", greet("world"));
console.log("name:", name);
console.log("default export add(2, 3):", add(2, 3));
console.log("import.meta.filename:", import.meta.filename);

const message = await Promise.resolve("top-level await works in ESM");
console.log(message);
