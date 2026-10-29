/** Wait one turn of the event loop. */
export function tick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
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

/** A clock the test controls. Adapters use the system clock; the core only sees this port. */
export class FixedClock {
  private current: Date;

  constructor(iso = "2026-01-01T00:00:00.000Z") {
    this.current = new Date(iso);
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

/** Deterministic ids for tests, so assertions can name the result. */
export function sequentialIds(prefix = "id"): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}
