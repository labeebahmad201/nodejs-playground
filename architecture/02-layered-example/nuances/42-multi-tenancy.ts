// 42 — Multi-tenancy
// Scenario: tenant scoping belongs in the repository, not in an optional service argument.
import { test } from "node:test";
import assert from "node:assert/strict";

type OrderRow = { tenantId: string; id: string; total: number };

class TenantContext {
  tenantId: string | null = null;
}

// (a) correct: every query is scoped by the repository.
class OrderRepository {
  private readonly context: TenantContext;
  private readonly rows: OrderRow[] = [
    { tenantId: "tenant-a", id: "o-1", total: 10 },
    { tenantId: "tenant-b", id: "o-2", total: 20 },
  ];

  constructor(context: TenantContext) {
    this.context = context;
  }

  find(id: string): OrderRow | undefined {
    const tenantId = this.context.tenantId;
    if (!tenantId) throw new Error("tenant context is required");
    return this.rows.find((row) => row.tenantId === tenantId && row.id === id);
  }
}

// (b) anti-pattern: tenant scoping is an optional argument the caller can forget.
class LeakyOrderRepository {
  private readonly rows: OrderRow[] = [
    { tenantId: "tenant-a", id: "o-1", total: 10 },
    { tenantId: "tenant-b", id: "o-2", total: 20 },
  ];

  find(id: string, tenantId?: string): OrderRow | undefined {
    return this.rows.find(
      (row) => (!tenantId || row.tenantId === tenantId) && row.id === id,
    );
  }
}

test("42: tenant A cannot read tenant B's order", () => {
  const context = new TenantContext();
  context.tenantId = "tenant-a";
  const repository = new OrderRepository(context);

  assert.equal(repository.find("o-1")?.total, 10);
  assert.equal(repository.find("o-2"), undefined);
});

test("42: a missing tenant is rejected, not silently unscoped", () => {
  const repository = new OrderRepository(new TenantContext());
  assert.throws(() => repository.find("o-1"), /tenant context/);
});

test("42: the optional filter leaks another tenant's row", () => {
  const repository = new LeakyOrderRepository();

  assert.equal(repository.find("o-2")?.tenantId, "tenant-b");
  // The caller forgot the argument, and the repository returned a cross-tenant row.
});
