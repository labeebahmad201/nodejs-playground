# Aggregate root IDs and foreign keys

*Other aggregates may reference an aggregate by its **root ID**. They should not reference an **internal entity's ID**. The root has a global identity; internal entities have a local identity that is meaningful only inside the aggregate.*

## The short answer

| Question | Answer |
| --- | --- |
| Can another aggregate store the root ID? | **Yes.** That is the normal way to reference another aggregate: `Shipment.orderId`, `Order.customerId`. |
| Can another aggregate store an internal entity's ID? | **No, not as a durable external reference.** Internal IDs are local to the aggregate. |
| Can a child table inside the same aggregate have a foreign key to the root? | **Yes.** `order_lines.order_id → orders.id` is inside the aggregate boundary. |
| Can a table outside the aggregate have a foreign key to an internal entity? | **Avoid it.** It makes the internal entity part of the public schema contract. |
| Should you always add a database foreign key to the root? | **No.** The domain rule is "reference by identity." A DB foreign key is an implementation choice. |

The important distinction is **inside the aggregate vs outside the aggregate**. A child table pointing at its own root is normal. An outside table pointing at a child is the boundary leak.

## Root identity is global, internal identity is local

An aggregate has exactly one root. The root has a global identity: it can be looked up directly, and other aggregates can refer to it.

Entities inside the aggregate have local identity. An `OrderLine` with ID `1` in order A is not the same thing as an `OrderLine` with ID `1` in order B. The line ID only makes sense together with the order.

That is why external references go to the root:

- `Shipment.orderId` — points to the `Order` aggregate.
- `Order.customerId` — points to the `Customer` aggregate.
- `OrderLine.orderId` — points to its own root, inside the same aggregate.

An external `Shipment.orderLineId` would point at something that has no global identity. It is only meaningful inside one order, and its lifecycle is controlled by that order.

## The example: Order, OrderLine, Shipment

```text
Order (aggregate root)
  id: OrderId                 // global identity
  lines: OrderLine[]

OrderLine (entity inside Order)
  id: OrderLineId             // local identity, unique only inside this Order
  productId: ProductId
  quantity: number

Shipment (separate aggregate root)
  id: ShipmentId              // global identity
  orderId: OrderId            // allowed: reference to the Order root
  // orderLineId: OrderLineId // avoid: reference to an internal entity
```

Why `Shipment.orderLineId` is a problem:

- the line can be removed or replaced by the order;
- the line ID is not globally unique;
- the shipment would bypass the order root to reach the line;
- the order's internal structure can no longer change freely;
- the reference may dangle when the order is reconstituted or its lines are recreated.

If the shipment only needs to know which order it belongs to, `orderId` is enough. If it truly needs to address a specific line, that is a modeling signal: either keep the line reference transient and resolve it through the order, or promote the line to its own aggregate if it has an independent lifecycle.

## What the database schema can look like

Inside the aggregate, a child table may point to the root:

```sql
CREATE TABLE orders (
  id          UUID PRIMARY KEY,
  status      TEXT NOT NULL
);

CREATE TABLE order_lines (
  id          UUID PRIMARY KEY,
  order_id    UUID NOT NULL REFERENCES orders(id),
  product_id  UUID NOT NULL,
  quantity    INTEGER NOT NULL
);
```

That foreign key is fine because it is inside the aggregate boundary. The root owns the lines.

An outside aggregate may point to the root:

```sql
CREATE TABLE shipments (
  id        UUID PRIMARY KEY,
  order_id  UUID NOT NULL REFERENCES orders(id)
);
```

But an outside table should not point at the internal entity:

```sql
-- Avoid this.
CREATE TABLE shipments (
  id             UUID PRIMARY KEY,
  order_line_id  UUID NOT NULL REFERENCES order_lines(id)
);
```

That last foreign key makes `order_lines.id` part of the public contract. Now the order cannot delete or recreate its lines without considering shipments. The internal model is frozen by an external table.

Spring Data JDBC states the same assumption directly: "only the aggregate has a foreign key to a table storing non-root entities of the aggregate and no other entity points toward non-root entities." It also notes that referenced entities are deleted and recreated by the framework, which makes external references to their IDs especially unstable.

## Why internal entity IDs are a bad external reference

| Problem | What happens |
| --- | --- |
| **Local identity** | The ID is only unique inside one aggregate. An outside table can accidentally point at the wrong row unless it also carries the root ID. |
| **Lifecycle** | The root can remove or replace the internal entity. The external reference can dangle. |
| **Boundary** | External code reaches past the root and couples itself to the aggregate's internals. |
| **Evolution** | The aggregate can no longer change its internal structure without a schema or contract change outside it. |
| **Transactions** | A reference from another aggregate invites cross-aggregate consistency and accidental multi-aggregate transactions. |
| **ORM behavior** | Child rows may be deleted and reinserted; their IDs may not be stable. |

The internal entity is not supposed to change independently. Its lifecycle belongs to the root. Referencing it externally pretends it is an independent thing and breaks that ownership.

## "But the shipment needs a specific line"

There are better options than a foreign key to `order_lines.id`:

1. **Reference the order root.** Store `orderId` and let the order resolve the line through a business key, such as a product/SKU or a line number that is passed into an operation.
2. **Use the line ID only transiently.** If the application already loaded the order, it can pass `OrderLineId` into `order.changeQuantity(lineId, ...)`. That is a local operation, not a durable external reference.
3. **Promote the line to its own aggregate.** If a line has an independent lifecycle and other aggregates genuinely need to reference it, it may no longer be an internal entity.
4. **Use a read model for reporting.** Reporting and UI projections can join across tables freely. The rule is about the transactional domain model, not analytics.
5. **Use domain events.** Publish the root ID plus the relevant business identifiers. Do not make consumers depend on internal database IDs.

The AxonIQ guidance is useful here: an `OrderLine` identifier should always be used in the context of an `Order`. If you want to do something with a line, pass both `OrderId` and `OrderLineId`; the `OrderId` locates the aggregate, and the root performs the operation on the line.

## Root ID as a foreign key: allowed, but not automatic

Referencing another aggregate by its root ID is the intended pattern. But a database foreign key is not the same thing as the domain rule.

In code, prefer:

```ts
class Shipment {
  constructor(
    readonly id: ShipmentId,
    readonly orderId: OrderId,
  ) {}
}
```

Not:

```ts
class Shipment {
  constructor(
    readonly id: ShipmentId,
    readonly order: Order, // direct object reference across aggregates
  ) {}
}
```

In the same bounded context and database, a foreign key from `shipments.order_id` to `orders.id` can be reasonable if you want referential integrity. It does introduce temporal coupling: the order must exist before the shipment row can be written. That may be exactly what you want, or it may make asynchronous flows harder.

Across bounded contexts or microservices, avoid a database foreign key entirely. Store the other aggregate's ID as a value and integrate through an API or domain events. The other aggregate may not even be in the same database, and its lifecycle may be only eventually consistent with yours.

So the rule is:

> **Reference other aggregates by identity. A database foreign key to the root is an implementation choice, not a DDD requirement.**

## What about foreign keys inside the aggregate?

They are normal:

- `order_lines.order_id → orders.id` is inside the boundary.
- A child table may have a local primary key, a composite key, or no separate global ID.
- The root loads and saves the whole aggregate; child rows are not independently fetched by outside code.

The internal IDs are still useful. The root uses them to find a line when applying a command. They are just not public references.

## The nuance in one table

| Reference | Allowed? | Why |
| --- | --- | --- |
| `Shipment.orderId → Order.id` | Yes | Root has global identity; reference by identity. |
| `OrderLine.orderId → Order.id` | Yes | Child table inside the aggregate points to its root. |
| `Shipment.orderLineId → OrderLine.id` | Avoid | Internal entity has only local identity and no independent lifecycle. |
| `Shipment.order` (object reference) | Avoid | Cross-aggregate object reference invites loading and modifying both. |
| `Shipment.orderId` without a DB foreign key | Yes | Valid across bounded contexts and services; eventual consistency. |

## Summary

- The aggregate root has global identity; internal entities have local identity.
- Other aggregates may reference the root by ID.
- Other aggregates should not reference an internal entity by ID as a durable external reference.
- Inside the aggregate, child tables may have foreign keys to the root.
- Outside the aggregate, a foreign key to an internal entity freezes internals and leaks the boundary.
- A DB foreign key to the root is allowed in the same bounded context, but it is not required. Across services, store the ID and integrate explicitly.

## References

- Eric Evans, *Domain-Driven Design* (2003), chapter 6, "The Lifecycle of a Domain Object."
- Martin Fowler, [*DDD_Aggregate*](https://martinfowler.com/bliki/DDD_Aggregate.html) — "Any references from outside the aggregate should only go to the aggregate root."
- Vaughn Vernon, [*Effective Aggregate Design Part II: Making Aggregates Work Together*](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_2.pdf) — "Reference Other Aggregates By Identity."
- Microsoft Learn, [*Use Tactical DDD to Design Microservices*](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-domain-driven-design) — lookup by the root identifier; reference other aggregates by identity only.
- Spring Data JDBC, [*Domain Driven Design and Relational Databases*](https://docs.spring.io/spring-data/relational/reference/jdbc/domain-driven-design.html) — only the aggregate has a foreign key to non-root entity tables; no other entity points toward non-root entities.
- AxonIQ, [*How can I identify entities within an aggregate?*](https://www.axoniq.io/blog/how-can-i-identify-entities-within-an-aggregate) — internal entity identifiers are used in the context of the aggregate root.

## See also

- [Repositories do not live in aggregates](repositories-do-not-live-in-aggregates.md)
- [Aggregates](../../fundamentals/07-aggregates/README.md)
- [Repositories](../../fundamentals/08-repositories/README.md)
- [What actually fails in a layered CRUD app](what-fails-in-a-layered-crud-app.md)
