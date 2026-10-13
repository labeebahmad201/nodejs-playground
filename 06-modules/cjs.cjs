const { tag, greet } = require("./cjs-lib.cjs");

console.log("== CommonJS (.cjs) ==");
console.log("greet:", greet("world"));
console.log("tag:", tag);
console.log("__filename:", __filename);
console.log("__dirname:", __dirname);
