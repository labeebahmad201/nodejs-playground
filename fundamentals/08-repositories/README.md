# Repositories

*A **repository** is a persistence abstraction that makes aggregates look like they're all in
memory — a collection you `find` and `save`. It lives between your domain and your database,
hiding the storage details so your logic never touches SQL.*

Part of the language-agnostic [`fundamentals/`](../) track. Works with `07-aggregates`; contrast
with the raw collaborators discussed in `06-collaborators`.

## Definition

A **repository** provides a collection-like interface to aggregates, hiding the mapping to and from
persistence. Your domain code says "give me the order with this id"; the repository figures out the
SQL/ORM/API call.

```ts
interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
  nextId(): OrderId;
  // collection-like operations where they make sense:
  // findByCustomer(customerId: CustomerId): Promise<Order[]>;
}
```

Notice the interface is **domain-shaped**: it speaks `Order` and `OrderId`, not `rows` and
`SELECT`. The implementation lives in infrastructure:

```ts
class PostgresOrderRepository implements OrderRepository {
  constructor(private db: Database) {}

  async findById(id: OrderId): Promise<Order | null> {
    const row = await this.db.queryOne("SELECT * FROM orders WHERE id = $1", [id.value]);
    if (!row) return null;
    const lines = await this.db.query("SELECT * FROM order_lines WHERE order_id = $1", [id.value]);
    return toOrder(row, lines);           // map rows → domain object
  }

  async save(order: Order): Promise<void> {
    await this.db.tx(async (t) => {
      await t.upsert("orders", toRow(order));
      await t.replaceAll("order_lines", order.id.value, order.lines.map(toLineRow));
    });
  }

  nextId(): OrderId {
    return new OrderId(crypto.randomUUID());
  }
}
```

And for tests you swap in a fake — no database required:

```ts
class InMemoryOrderRepository implements OrderRepository {
  private store = new Map<string, Order>();
  async findById(id: OrderId) { return this.store.get(id.value) ?? null; }
  async save(order: Order) { this.store.set(order.id.value, order); }
  nextId() { return new OrderId(crypto.randomUUID()); }
}
```

## Key traits

| Trait | Meaning |
| --- | --- |
| **Collection-like** | `find`, `save`, `remove` — as if aggregates were in memory |
| **Domain-shaped API** | speaks aggregates/value objects, not rows/columns |
| **Hides persistence** | SQL/ORM/HTTP details stay in the implementation |
| **One per aggregate root** | not one per entity, and not one per table |
| **Interface in the domain** | the abstraction belongs to the domain; the impl to infrastructure |
| **Mediates lifecycle** | it's how outside code gets a reference to an existing aggregate |

## Repository vs other patterns

| Pattern | Role |
| --- | --- |
| **Repository** | collection-like access to **aggregates**, hiding storage |
| **DAO** | thin wrapper over a table/query — usually lower-level, one per table |
| **Data Mapper** | object↔row translation (`toOrder`/`toRow` above) — often used *inside* a repository |
| **Active Record** | an entity that saves *itself* (`user.save()`) — couples domain to storage |
| **Service** | coordinates operations; a repository is often one of its collaborators |

Rule of thumb: if your domain code knows the word "row", "table", or "SELECT", it belongs in a
repository (or a mapper), not in the domain.

## Guidance

- **Interface in the domain, implementation in infrastructure.** The domain depends on
  `OrderRepository`; Postgres/Prisma/SQL details are an implementation detail.
- **One repository per aggregate root.** Inside-aggregate entities aren't independently fetched.
- **Return domain objects.** Map rows to `Order`, not to a DTO — but don't leak persistence
  entities either.
- **Keep it honest.** Don't expose query-builder power ("find by arbitrary predicate") if the domain
  only needs a few named queries; explicitly named methods keep intent clear.
- **Let it define `nextId()`** when ids are generated at persistence, so the domain doesn't reach
  for a database sequence.
- **Substitute in tests.** In-memory repositories make domain tests fast and container-free.

## Pitfalls

- **Leaking persistence types.** Returning rows/`ResultSet`/ORM entities defeats the abstraction.
- **Generic `Repository<T>` with 30 methods.** A catch-all base repository usually becomes a query
  builder; prefer a small, intent-specific interface per aggregate.
- **Anemic repositories.** If a repository contains business logic ("compute the discount"), it
  belongs on the aggregate or a domain service.
- **Repository per table.** Repositories map to **aggregate roots**, not tables. Two tables in one
  aggregate are one repository.

## One-line summary

**A repository is a domain-shaped, collection-like abstraction over persistence for a single
aggregate root — interface in the domain, implementation in infrastructure — so your logic works in
terms of `Order`, not rows and SQL, and tests can swap in an in-memory version.**

## References

- Martin Fowler — *Repository* (PoEAA) — <https://martinfowler.com/eaaCatalog/repository.html>
- Martin Fowler — *Data Mapper* (PoEAA) — <https://martinfowler.com/eaaCatalog/dataMapper.html>
- Eric Evans — *Domain-Driven Design* (2003), ch. 6 "The Lifecycle of a Domain Object"
- Related: `07-aggregates`, `06-collaborators`, `11-data-transfer-objects`
