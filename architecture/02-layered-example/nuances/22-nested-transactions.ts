// 22 — Nested transactions
// Scenario: a function that is already inside a transaction calls another
// function that also wants to be atomic. There is one connection and one open
// transaction. Something has to give.
//
// The database knows four statements. Everything else here is a decision about
// which of them to send:
//   BEGIN · COMMIT · ROLLBACK · SAVEPOINT / ROLLBACK TO SAVEPOINT
import { test } from "node:test";
import assert from "node:assert/strict";

type Savepoint = { name: string; mark: number };

// A tiny stand-in for one Postgres connection. Rows stay pending until COMMIT,
// so a test can prove exactly what survived a failure.
class Connection {
  readonly id: number;
  private readonly db: Db;
  private pending: string[] = [];
  private savepoints: Savepoint[] = [];
  private open = false;

  constructor(db: Db, id: number) {
    this.db = db;
    this.id = id;
  }

  query(sql: string): void {
    this.db.log.push(`conn${this.id}: ${sql}`);
    const statement = sql.trim().toUpperCase();

    if (statement === "BEGIN") {
      if (this.open) {
        // Postgres does not nest: the statement is a warning and a no-op.
        this.db.log.push("  WARNING: there is already a transaction in progress");
        return;
      }
      this.open = true;
      return;
    }

    if (statement === "COMMIT") {
      if (!this.open) {
        this.db.log.push("  WARNING: no transaction in progress");
        return;
      }
      this.db.committed.push(...this.pending);
      this.pending = [];
      this.savepoints = [];
      this.open = false;
      return;
    }

    if (statement === "ROLLBACK") {
      if (!this.open) {
        // The transaction was already ended by someone else's COMMIT.
        this.db.log.push("  WARNING: no transaction in progress");
        return;
      }
      this.pending = [];
      this.savepoints = [];
      this.open = false;
      return;
    }

    if (statement.startsWith("SAVEPOINT ")) {
      const name = statement.slice("SAVEPOINT ".length);
      this.savepoints.push({ name, mark: this.pending.length });
      return;
    }

    if (statement.startsWith("ROLLBACK TO SAVEPOINT ")) {
      const name = statement.slice("ROLLBACK TO SAVEPOINT ".length);
      const savepoint = this.savepoints.find((point) => point.name === name);
      if (!savepoint) throw new Error(`no savepoint ${name}`);
      this.pending = this.pending.slice(0, savepoint.mark);
      return;
    }

    if (statement.startsWith("RELEASE SAVEPOINT ")) {
      const name = statement.slice("RELEASE SAVEPOINT ".length);
      this.savepoints = this.savepoints.filter((point) => point.name !== name);
      return;
    }

    if (statement.startsWith("INSERT ")) {
      this.pending.push(sql.slice("INSERT ".length));
      return;
    }

    throw new Error(`unsupported statement: ${sql}`);
  }
}

class Db {
  readonly log: string[] = [];
  readonly committed: string[] = []; // what another connection can see
  private readonly size: number;
  private nextConnection = 1;
  private inUse = 0;

  constructor(size = 5) {
    this.size = size;
  }

  get borrowed(): number {
    return this.inUse;
  }

  connect(): Connection {
    if (this.inUse >= this.size) throw new Error("pool exhausted");
    this.inUse += 1;
    return new Connection(this, this.nextConnection++);
  }

  release(): void {
    this.inUse -= 1;
  }
}

// The only transaction API used here: check out a connection, and let the
// callback do its work inside BEGIN/COMMIT. This is the "join" answer.
async function withTransaction<T>(
  db: Db,
  work: (conn: Connection) => Promise<T> | T,
): Promise<T> {
  const conn = db.connect(); // one connection = one transaction
  try {
    conn.query("BEGIN");
    const result = await work(conn);
    conn.query("COMMIT");
    return result;
  } catch (error) {
    conn.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

test("22: a failing transaction rolls back every write on its connection", async () => {
  const db = new Db();

  await assert.rejects(async () => withTransaction(db, (conn) => {
    conn.query("INSERT o-1");
    conn.query("INSERT p-1");
    throw new Error("payment failed");
  }), /payment failed/);

  assert.deepEqual(db.committed, []);
  assert.equal(db.borrowed, 0); // the connection went back to the pool
});

test("22: a second BEGIN is not a nest — it makes the caller's rollback a no-op", async () => {
  const db = new Db();

  // Written to be "safe on its own", like most repository helpers are.
  function recordAudit(conn: Connection, id: string): void {
    conn.query("BEGIN"); // ignored: a transaction is already open
    conn.query(`INSERT audit-${id}`);
    conn.query("COMMIT"); // commits the caller's pending rows too
  }

  await assert.rejects(async () => withTransaction(db, (conn) => {
    conn.query("INSERT o-1");
    recordAudit(conn, "o-1");
    throw new Error("payment failed");
  }), /payment failed/);

  // The order survived the failure. Nothing threw; nobody was alerted.
  assert.deepEqual(db.committed, ["o-1", "audit-o-1"]);
});

test("22: a savepoint undoes only the optional step", async () => {
  const db = new Db();

  await withTransaction(db, (conn) => {
    conn.query("INSERT o-1");
    conn.query("SAVEPOINT bonus");
    conn.query("INSERT bonus-1");
    conn.query("ROLLBACK TO SAVEPOINT bonus"); // undo the bonus only
  });

  assert.deepEqual(db.committed, ["o-1"]);
});

test("22: a second connection survives the caller's rollback — and sees none of it", async () => {
  const db = new Db();

  await assert.rejects(async () => withTransaction(db, async (conn) => {
    conn.query("INSERT o-1"); // uncommitted: invisible to any other connection

    await withTransaction(db, (audit) => {
      assert.notEqual(audit.id, conn.id); // a different connection
      assert.deepEqual(db.committed, []); // it cannot see the order above
      audit.query("INSERT audit-1");
    });

    throw new Error("payment failed");
  }), /payment failed/);

  assert.deepEqual(db.committed, ["audit-1"]); // survival, not consistency
});

test("22: a second connection can fail without taking the caller down", async () => {
  const db = new Db();

  await withTransaction(db, async (conn) => {
    conn.query("INSERT o-1");

    await assert.rejects(async () => withTransaction(db, () => {
      throw new Error("audit failed");
    }), /audit failed/);

    // the inner transaction died; the caller carries on and commits.
  });

  assert.deepEqual(db.committed, ["o-1"]);
});

test("22: a one-connection pool cannot open a second transaction", async () => {
  const db = new Db(1); // the whole pool is one connection

  await assert.rejects(async () => withTransaction(db, async () => {
    await withTransaction(db, () => undefined); // waits forever for a connection
  }), /pool exhausted/);

  assert.deepEqual(db.committed, []);
  assert.equal(db.borrowed, 0);
});

test("22: two helpers that each own a transaction cannot fail together", async () => {
  const db = new Db();

  // The anti-pattern: each function owns its own boundary.
  const saveOrder = () => withTransaction(db, (conn) => conn.query("INSERT o-1"));
  const savePayment = () => withTransaction(db, (conn) => conn.query("INSERT p-1"));

  await assert.rejects(async () => {
    await saveOrder();
    await savePayment().then(() => { throw new Error("payment failed"); });
  }, /payment failed/);

  // The order is durable; the caller had nothing to roll it back with.
  assert.deepEqual(db.committed, ["o-1", "p-1"]);
});
