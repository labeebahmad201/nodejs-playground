import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A fresh in-memory SQLite database with foreign keys enabled. */
export function memoryDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

/** A temporary directory for file-backed SQLite databases. */
export function tempDir(): { path: string; cleanup: () => void } {
  const path = mkdtempSync(join(tmpdir(), "layered-example-"));
  return { path, cleanup: () => rmSync(path, { recursive: true, force: true }) };
}

/** Wait one turn of the event loop. */
export function tick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** Wait for a fixed number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A promise with externally callable resolve/reject. */
export function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Run a function and return the error it throws, or fail if it does not throw. */
export async function captureError(
  fn: () => Promise<unknown> | unknown,
): Promise<Error> {
  try {
    await fn();
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
  throw new Error("expected the operation to fail");
}
