console.log("== CommonJS loading ESM via dynamic import() ==");

import("./esm-lib.mjs").then((mod) => {
  console.log("greet via import():", mod.greet("cjs"));
  console.log("name via import():", mod.name);
});
