// 02 — Downward dependency rule
// Scenario: a service calls a repository; the repository must not call back up.
import { test } from "node:test";
import assert from "node:assert/strict";

type Layer = "presentation" | "business" | "persistence" | "database";
type Edge = { from: Layer; to: Layer };

const rank: Record<Layer, number> = {
  presentation: 0,
  business: 1,
  persistence: 2,
  database: 3,
};

function hasUpwardEdge(edges: Edge[]): boolean {
  return edges.some((edge) => rank[edge.to] < rank[edge.from]);
}

interface Order {
  id: string;
  total: number;
}

interface OrderRepository {
  save(order: Order): void;
}

// (a) correct: presentation -> business -> persistence -> database.
class OrderService {
  private readonly repository: OrderRepository;

  constructor(repository: OrderRepository) {
    this.repository = repository;
  }

  place(order: Order): void {
    if (order.total <= 0) throw new Error("total must be positive");
    this.repository.save(order);
  }

  audit(order: Order): void {
    void order;
  }
}

class SqlOrderRepository implements OrderRepository {
  save(order: Order): void {
    // The database is below persistence; the repository may depend on it.
    void order;
  }
}

const correctEdges: Edge[] = [
  { from: "presentation", to: "business" },
  { from: "business", to: "persistence" },
  { from: "persistence", to: "database" },
];

// (b) anti-pattern: persistence calls back into business.
class UpwardRepository implements OrderRepository {
  private readonly service: OrderService;

  constructor(service: OrderService) {
    this.service = service;
  }

  save(order: Order): void {
    this.service.audit(order); // persistence -> business
  }
}

const antiPatternEdges: Edge[] = [
  ...correctEdges,
  { from: "persistence", to: "business" },
];

test("02: correct dependencies only point downward", () => {
  assert.equal(hasUpwardEdge(correctEdges), false);
});

test("02: a repository calling a service creates an upward edge", () => {
  assert.equal(hasUpwardEdge(antiPatternEdges), true);
  assert.ok(new UpwardRepository(new OrderService(new SqlOrderRepository())));
});
