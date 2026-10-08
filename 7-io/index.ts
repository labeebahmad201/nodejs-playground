// I/O = input/output: transferring data INTO and OUT OF this process.
// Run: `node index.ts`
//
// What makes something "I/O" isn't the file or the socket — it's that the work is
// handed off to the OS (or libuv's threadpool), so the JS thread doesn't wait. The
// callback lands in the poll phase; see 5-event-loop.

import { readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// INPUT — bytes flow from the file system INTO this process.
const source = await readFile(import.meta.filename, "utf8");
console.log(`input:  read ${source.length} bytes from ${import.meta.filename}`);

// OUTPUT — bytes flow from this process OUT to the file system.
const out = join(tmpdir(), "nodejs-playground-io.txt");
const payload = `lines: ${source.split("\n").length}\n`;
await writeFile(out, payload, "utf8");
console.log(`output: wrote ${payload.length} bytes to ${out}`);

// stdout is also output: bytes leaving the process.
process.stdout.write("output: wrote this line to stdout\n");

// Clean up the artifact we just created.
await rm(out);

// Output (byte counts/paths vary):
//   input:  read ~1310 bytes from /.../7-io/index.ts
//   output: wrote ~10 bytes to /var/folders/.../nodejs-playground-io.txt
//   output: wrote this line to stdout
