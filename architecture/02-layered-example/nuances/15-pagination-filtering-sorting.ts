// 15 — Pagination, filtering, and sorting
// Scenario: query parameters pass through the layers; the domain stays a domain object.
import { test } from "node:test";
import assert from "node:assert/strict";

type Order = { id: string; total: number };

type PageRequest = { limit: number; offset: number };
type OrderFilter = { minTotal?: number };
type OrderSort = "id" | "total";

class OrderRepository {
  queryCalls = 0;
  allCalls = 0;
  private readonly rows: Order[] = [
    { id: "o-1", total: 10 },
    { id: "o-2", total: 20 },
    { id: "o-3", total: 30 },
    { id: "o-4", total: 40 },
    { id: "o-5", total: 50 },
  ];

  query(page: PageRequest, filter: OrderFilter, sort: OrderSort): Order[] {
    this.queryCalls += 1;
    const filtered = this.rows.filter(
      (order) => filter.minTotal === undefined || order.total >= filter.minTotal,
    );
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "id") return a.id.localeCompare(b.id);
      return a.total - b.total;
    });
    return sorted.slice(page.offset, page.offset + page.limit);
  }

  all(): readonly Order[] {
    this.allCalls += 1;
    return this.rows;
  }
}

class OrderService {
  private readonly repository: OrderRepository;

  constructor(repository: OrderRepository) {
    this.repository = repository;
  }

  list(page: PageRequest, filter: OrderFilter, sort: OrderSort): Order[] {
    return this.repository.query(page, filter, sort);
  }
}

// (a) correct: the query parameters go through the service to the repository.
class OrderController {
  private readonly service: OrderService;

  constructor(service: OrderService) {
    this.service = service;
  }

  list(query: { limit: number; offset: number; minTotal?: number; sort: OrderSort }): Order[] {
    return this.service.list(
      { limit: query.limit, offset: query.offset },
      { minTotal: query.minTotal },
      query.sort,
    );
  }
}

// (b) anti-pattern: load everything and page in the service.
class BadOrderService {
  private readonly repository: OrderRepository;

  constructor(repository: OrderRepository) {
    this.repository = repository;
  }

  list(page: PageRequest, filter: OrderFilter): Order[] {
    const all = [...this.repository.all()];
    const filtered = all.filter(
      (order) => filter.minTotal === undefined || order.total >= filter.minTotal,
    );
    return filtered.slice(page.offset, page.offset + page.limit);
  }
}

test("15: the repository applies paging and filtering", () => {
  const repository = new OrderRepository();
  const controller = new OrderController(new OrderService(repository));

  const page = controller.list({ limit: 2, offset: 1, minTotal: 20, sort: "total" });

  assert.deepEqual(page.map((order) => order.id), ["o-3", "o-4"]);
  assert.equal(repository.queryCalls, 1);
  assert.equal(repository.allCalls, 0);
  assert.equal("page" in page[0]!, false);
});

test("15: the anti-pattern loads every row before paging", () => {
  const repository = new OrderRepository();
  const service = new BadOrderService(repository);

  const page = service.list({ limit: 2, offset: 1 }, { minTotal: 20 });

  assert.deepEqual(page.map((order) => order.id), ["o-3", "o-4"]);
  assert.equal(repository.allCalls, 1);
  assert.equal(repository.queryCalls, 0);
});
