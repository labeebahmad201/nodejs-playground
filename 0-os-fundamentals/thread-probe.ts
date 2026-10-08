// Worker used by index.ts to show the process/thread split and IPC.
// Its threadId is non-zero and its pid is the SAME as the main thread's.

import { parentPort, threadId } from "node:worker_threads";

parentPort?.postMessage({ kind: "hello", threadId, pid: process.pid });

parentPort?.on("message", (msg) => {
  parentPort?.postMessage({ kind: "echo", from: threadId, echoed: msg });
});
