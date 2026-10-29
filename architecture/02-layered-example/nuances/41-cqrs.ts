// 41 — When to add CQRS
// Scenario: the write model protects the aggregate; the read side uses a projection.
import { test } from "node:test";
import assert from "node:assert/strict";

type Order = { id: string; total: number; items: string[] };
type OrderSummary = { id: string; total: number; itemCount: number };

class WriteRepository {
  private readonly rows = new Map<string, Order>();
  loads = 0;

  save(order: Order): void {
    this.rows.set(order.id, order);
  }

  load(id: string): Order | undefined {
    this.loads += 1;
    return this.rows.get(id);
  }

  all(): Order[] {
    this.loads += 1;
    return [...this.rows.values()];
  }

  loadItems(id: string): string[] {
    this.loads += 1;
    return this.rows.get(id)?.items ?? [];
  }
}

class WriteService {
  private readonly repository: WriteRepository;

  constructor(repository: WriteRepository) {
    this.repository = repository;
  }

  place(order: Order): void {
    this.repository.save(order);
  }
}

// (a) correct: the read model is a projection, not the write aggregate.
class OrderProjection {
  readonly rows: OrderSummary[] = [
    { id: "o-1", total: 10, itemCount: 2 },
    { id: "o-2", total: 20, itemCount: 1 },
  ];

  list(): OrderSummary[] {
    return this.rows;
  }
}

class OrderSummaryQuery {
  private readonly projection: OrderProjection;

  constructor(projection: OrderProjection) {
    this.projection = projection;
  }

  execute(): OrderSummary[] {
    return this.projection.list();
  }
}

// (b) anti-pattern: a report loads every aggregate and reaches into its items.
class BadOrderReport {
  private readonly repository: WriteRepository;

  constructor(repository: WriteRepository) {
    this.repository = repository;
  }

  execute(): Array<{ id: string; itemCount: number }> {
    return this.repository.all().map((order) => ({
      id: order.id,
      itemCount: this.repository.loadItems(order.id).length,
    }));
  }
}

test("41: the read query does not load the write aggregate", () => {
  const repository = new WriteRepository();
  const read = new OrderSummaryQuery(new OrderProjection());

  repository.save({ id: "o-1", total: 10, items: ["book", "pen"] });
  const rows = read.execute();

  assert.deepEqual(rows[0], { id: "o-1", total: 10, itemCount: 2 });
  assert.equal(repository.loads, 0);
});

test("41: the write service only touches the write model", () => {
  const repository = new WriteRepository();
  const write = new WriteService(repository);

  write.place({ id: "o-3", total: 30, items: ["lamp"] });

  assert.equal(repository.loads, 0);
});

test("41: the report loads the aggregate for every row", () => {
  const repository = new WriteRepository();
  repository.save({ id: "o-1", total: 10, items: ["book"] });
  repository.save({ id: "o-2", total: 20, items: ["pen"] });

  const rows = new BadOrderReport(repository).execute();

  assert.equal(rows.length, 2);
  assert.equal(repository.loads, 3); // 1 aggregate query + 2 item queries
});
