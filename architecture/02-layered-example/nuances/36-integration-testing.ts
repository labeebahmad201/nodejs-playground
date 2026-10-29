// 36 — Integration testing at boundaries
// Scenario: test the repository against a real database; a mock cannot prove SQL constraints.
// In CI, the same test runs against the production engine and version (e.g. postgres:16
// in a container), with the schema built by the real migrations. SQLite in memory keeps
// this example runnable without Docker; it proves the constraint, not the Postgres dialect.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

type Order = { id: string; total: number };

// (a) correct: exercise the real adapter against a real database.
class SqlOrderRepository {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  save(order: Order): void {
    this.db
      .prepare("INSERT INTO orders (id, total) VALUES (?, ?)")
      .run(order.id, order.total);
  }

  count(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM orders").get() as
      | { count: number }
      | undefined;
    return row?.count ?? 0;
  }
}

// (b) anti-pattern: a mock accepts anything, so it cannot catch the constraint.
class MockOrderRepository {
  readonly rows: Order[] = [];

  save(order: Order): void {
    this.rows.push(order);
  }
}

function createDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE orders (id TEXT PRIMARY KEY, total INTEGER NOT NULL)");
  return db;
}

test("36: the real repository enforces the primary key", () => {
  const db = createDb();
  const repository = new SqlOrderRepository(db);

  repository.save({ id: "o-1", total: 10 });
  assert.equal(repository.count(), 1);
  assert.throws(() => repository.save({ id: "o-1", total: 20 }), /UNIQUE|constraint/i);
});

test("36: the mock cannot reproduce the database constraint", () => {
  const repository = new MockOrderRepository();

  repository.save({ id: "o-1", total: 10 });
  repository.save({ id: "o-1", total: 20 });

  assert.equal(repository.rows.length, 2); // the duplicate passes
});
