// console.log vs process.stdout.write — a logging helper vs a raw stream sink.
//
// `process.stdout` is a Writable stream bound to file descriptor 1 (the terminal, or
// wherever stdout is redirected). `console.log` is a *formatting logging helper* built
// on top of it, essentially:
//
//     process.stdout.write(util.format(...args) + "\n")
//
// Run: node index.ts

import { once } from "node:events";
import { Readable } from "node:stream";
import { Console } from "node:console";

console.log("=== 1. return value ===");
const r1 = console.log("hello from console.log");
console.log("console.log(...) returned:", r1); // undefined

const r2 = process.stdout.write("hello from process.stdout.write\n");
console.log("process.stdout.write(...) returned:", r2); // boolean = backpressure signal

console.log("\n=== 2. newline + formatting ===");
console.log("console.log inspects objects and appends a newline:");
console.log({ user: "ada", n: 1 }); // { user: 'ada', n: 1 }

process.stdout.write("process.stdout.write writes raw bytes, no newline, no formatting:\n");
process.stdout.write("  chunk 1 | ");
process.stdout.write("chunk 2\n");

console.log("\n=== 3. console.log is literally write + util.format + \\n ===");
console.log("%s scored %d", "ada", 10); // console.log does the formatting for you

console.log("\n=== 4. write() rejects non-string / non-buffer chunks ===");
try {
  process.stdout.write({ a: 1 } as unknown as string);
} catch (err) {
  console.log("write(object) threw:", (err as Error).message.split("\n")[0]);
}

console.log("\n=== 5. stdout is a pipeable Writable (console.log is not) ===");
const src = Readable.from(["piped ", "chunks ", "straight ", "to ", "stdout\n"]);
src.pipe(process.stdout, { end: false }); // end:false so we keep using stdout below
await once(src, "end");

console.log("\n=== 6. stdout vs stderr are different fds ===");
console.log("process.stdout.fd =", process.stdout.fd, "| process.stderr.fd =", process.stderr.fd);
console.error("this line goes to stderr (fd 2)");
console.warn("so does console.warn");

console.log("\n=== 7. console is just a Console instance you can construct ===");
const myConsole = new Console({ stdout: process.stdout, stderr: process.stderr });
myConsole.log("a custom Console writing to the same stdout");
