# Coupling Through Shared Database Schema

## Definition

Shared-database coupling exists when multiple services or components depend on the same database schema or tables, especially when one component reads or writes data owned by another. No static import edge connects the services, but a schema change in one place breaks the other.

## Real-world SQL example

From the “Shared Database Across Services” anti-pattern ([microservices.io](https://microservices.io/patterns/data/shared-database.html)):

```sql
-- Payment Service modifies Order's data (tight coupling!)
UPDATE orders SET status = 'paid' WHERE id = ?;
```

`PaymentService` directly updates the `orders` table owned by `OrderService`.

## Real-world Python example

```python
class PaymentService:
    def process_payment(self, order_id, amount):
        cursor = shared_db.cursor()
        cursor.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
        order = cursor.fetchone()
        # ...
        # Payment Service modifies Order table (tight coupling!)
        cursor.execute(
            "UPDATE orders SET status = %s WHERE id = %s",
            ('paid', order_id)
        )
```

`PaymentService` never imports `OrderService`, yet it is tightly coupled to the `orders` table’s schema.

## Fix: database per service

Apply the [database-per-service pattern](https://microservices.io/patterns/data/database-per-service.html): each service owns its data store, and services communicate through APIs rather than shared tables. Schema changes then affect only the owning service, and data ownership becomes unambiguous.

In this example, `PaymentService` should ask `OrderService` to mark the order as paid—or publish a payment event that `OrderService` consumes—instead of writing the `orders` table directly.
