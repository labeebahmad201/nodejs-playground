# Abstractions vs Details (DIP's second sentence)

*Martin's full DIP statement has two parts. The first (A) says high-level and low-level modules should both depend on abstractions. The second (B) locks down the polarity: the abstraction must not look down; details must look up.*

> A. High-level modules should not depend upon low-level modules. Both should depend upon abstractions.
> B. Abstractions should not depend upon details. Details should depend upon abstractions.

## 1) "Abstractions should not depend on details"

An abstraction (interface/abstract class) is the contract — it only answers *what* needs to happen, in the vocabulary of the policy (high-level code). It must not answer *how* it happens.

If an abstraction references a concrete class, it has leaked a detail. If you change that detail, you may have to change the abstraction — and everyone who depends on that abstraction now changes too.

**Rule of thumb:** your abstraction files should not contain the names of concrete implementation classes (no `SqlDatabase`, `PostgresClient`, `FileSystem`, etc.).

## 2) "Details should depend on abstractions"

A "detail" is the concrete implementation (the *how*: SQL, files, HTTP, etc.). It must *conform to* the abstraction's contract. The concrete class points *upward* to the abstraction:

```ts
interface Database {                // abstraction (policy-owned)
  insert(table: string, row: unknown): Promise<void>;
}

class SqlDatabase implements Database {  // detail depends on abstraction
  insert(table: string, row: unknown): Promise<void> {
    // ...SQL-specific code...
  }
}
```

- `SqlDatabase` **names** `Database` (`implements Database`) → the detail depends on the abstraction.
- `Database` **does not name** `SqlDatabase` → the abstraction does not depend on the detail.

## Source dependencies vs runtime flow

- **At runtime**, control still flows *downward*: the policy calls the abstraction and the call executes the detail's code (`OrderService` → `Database.insert()` → `SqlDatabase.insert()`).
- **At compile-time** (source-code dependencies), the arrows flip: instead of policy depending on `SqlDatabase`, both policy and `SqlDatabase` depend on `Database`. The dependencies point *against* the flow of control.

That is the "inversion."

## A concrete example

**Wrong** — abstraction depends on a detail:

```ts
interface OrderRepository {
  save(row: SqlOrderRow): Promise<void>; // ❌ abstraction knows about SQL shape
}
```

The `SqlOrderRow` type is a DB detail. If you swap SQL for MongoDB, this interface must change. The abstraction is polluted by *how* you store data.

**Right** — abstraction stays in policy terms:

```ts
interface OrderRepository {
  save(order: Order): Promise<void>; // ✅ uses domain model, not DB detail
}

class SqlOrderRepository implements OrderRepository {
  save(order: Order): Promise<void> {
    const row = mapToSql(order); // detail maps down here
    // ...
  }
}
```

Now `OrderRepository` never mentions SQL. `SqlOrderRepository` depends on `OrderRepository`. 

## Practical test

If you delete all your concrete implementation files, do your abstraction files still compile? If yes, you're honoring this rule. If they don't, some abstraction is still depending on a detail.
