# SELECT ... FOR UPDATE in PostgreSQL

*`FOR UPDATE` turns a read into a lock acquisition: the rows the query matches are held until the transaction ends, so the value you read is still true when you write based on it. It is the mechanism behind every "read, decide, write" block that cannot afford to be wrong.*

## What it does

```sql
BEGIN;
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
-- other transactions that try to update or lock this row now wait
UPDATE accounts SET balance = balance - 40 WHERE id = 1;
COMMIT;
-- the lock is released here
```

Three properties define it:

1. **It locks the rows the query matched**, with an exclusive lock, at read time.
2. **It holds them until the transaction ends** — `COMMIT` or `ROLLBACK`, not the end of the statement.
3. **It does not block plain `SELECT`s.** Readers under MVCC keep reading the previous version; writers and other lockers wait.

That combination is what makes it useful and what makes it dangerous: the guarantee costs a lock for the whole transaction, which is fine for milliseconds and fatal across a network call.

## The four locking clauses

| Clause | Lock | Who it blocks | Use it when |
| --- | --- | --- | --- |
| `FOR UPDATE` | Exclusive, strongest | All other locks, plus `UPDATE`/`DELETE` | You are about to modify these rows |
| `FOR NO KEY UPDATE` | Exclusive, weaker | `FOR NO KEY UPDATE`, `FOR SHARE`, `FOR UPDATE` | You are modifying non-key columns (the normal `UPDATE` path) |
| `FOR SHARE` | Shared | `FOR NO KEY UPDATE`, `FOR UPDATE` | You need the row to stay unchanged while you work, without writing it |
| `FOR KEY SHARE` | Shared, weakest | `FOR UPDATE` only | You only need the key to remain present (foreign-key checks use this) |

`FOR SHARE` is the one people misread. It is a shared *lock*, not a free read: it blocks writers until you commit. Reaching for it to "be safe" can serialise an otherwise read-only path.

## The conflict matrix

| Current lock ↓ / requested → | `FOR KEY SHARE` | `FOR SHARE` | `FOR NO KEY UPDATE` | `FOR UPDATE` |
| --- | --- | --- | --- | --- |
| `FOR KEY SHARE` | — | — | — | **conflict** |
| `FOR SHARE` | — | — | **conflict** | **conflict** |
| `FOR NO KEY UPDATE` | — | **conflict** | **conflict** | **conflict** |
| `FOR UPDATE` | **conflict** | **conflict** | **conflict** | **conflict** |

Read the matrix as "the second transaction waits". The takeaway for application code: when you know you will write, ask for `FOR UPDATE` and queue once, rather than taking a shared lock and hoping to upgrade later — upgrading two shared locks is a classic deadlock.

## It reads the latest committed row

`FOR UPDATE` is a locking read, so it is not served from your transaction's snapshot the way a plain `SELECT` is. When it waits for another transaction, what happens next depends on the isolation level:

| Level | Behaviour |
| --- | --- |
| `READ COMMITTED` (default) | After the other transaction commits, the row is re-read in its newest version and the `WHERE` clause is re-checked. You get a current row. |
| `REPEATABLE READ` / `SERIALIZABLE` | The row has changed since your snapshot, so you get `40001 could not serialize access due to concurrent update`. Retry the transaction. |

That difference matters when porting code: at `REPEATABLE READ`, `FOR UPDATE` is an assertion that the row has not moved, not a way to move to the newest version.

## What it covers

- **Read-then-write on the rows it matched.** The decision stays valid until commit.
- **Write-write collisions on those rows.** The second writer waits or aborts.
- **Multi-statement consistency.** Every statement in the transaction sees the same locked values.

## What it leaves uncovered

### Rows that do not exist

```sql
-- If no user has this name, this locks nothing and the next insert wins.
SELECT id FROM users WHERE username = 'alice' FOR UPDATE;
```

PostgreSQL has no gap locks, so there is no row to lock and no predicate to protect. Concurrent inserts slip through. The fixes are a unique index (the constraint arbitrates), an advisory lock on the logical key, or `SERIALIZABLE`.

### Rows outside the query

Two transactions can each lock their own row and together break an invariant that spans both — the write-skew case. `FOR UPDATE` locks what you name, so name all the rows the invariant depends on, or use `SERIALIZABLE`.

### Readers

A plain `SELECT` in another session reads the old version happily. `FOR UPDATE` coordinates writers; it does not make the row invisible.

## Locks the engine takes implicitly

| Statement | Lock taken |
| --- | --- |
| `UPDATE` changing non-key columns | `FOR NO KEY UPDATE` |
| `UPDATE` changing a key column / `DELETE` | `FOR UPDATE` |
| `INSERT` | `FOR KEY SHARE` on rows it checks (for example, FK targets) |

So a `SELECT` is not the only way to acquire a lock — the first write already does. `FOR UPDATE` exists to take it **earlier**, before you make a decision, which is the whole difference between serialized and correct.

## Deadlocks

```sql
-- Session 1                          -- Session 2
BEGIN;                                BEGIN;
SELECT * FROM t WHERE id = 1          SELECT * FROM t WHERE id = 2
  FOR UPDATE;                           FOR UPDATE;
SELECT * FROM t WHERE id = 2          SELECT * FROM t WHERE id = 1
  FOR UPDATE;                           FOR UPDATE;   -- deadlock
```

PostgreSQL detects the cycle after `deadlock_timeout` (1s by default) and aborts one transaction with `40P01`. Two habits avoid it:

- **Lock in a deterministic order.** `ORDER BY id` before `FOR UPDATE` cannot guarantee lock acquisition order by itself, but it makes the scan order stable; with a consistent application-level rule, the cycle disappears.
- **Keep the locked set as small and short-lived as possible.** Fewer locks, held for less time, means fewer intersections.

Retry `40P01` at the transaction boundary. It is not a data error.

## SKIP LOCKED: the queue pattern

```sql
UPDATE jobs
SET status = 'running', started_at = now()
WHERE id = (
  SELECT id
  FROM jobs
  WHERE status = 'pending'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

`SKIP LOCKED` skips rows another transaction has locked, so N workers claim N different jobs without waiting. It is the standard job-queue claim in PostgreSQL.

Two caveats:

- The result is a **stale view by design** — you will not see the rows you skipped, so it is wrong for "read everything consistently". Use it only for "claim one unit of work".
- A worker that dies mid-job leaves the row `running`. The queue needs a lease or a reaper, or `SKIP LOCKED` silently loses work.

`NOWAIT` is the fail-fast variant: if any matched row is locked, raise `55P03` (`lock_not_available`) immediately instead of waiting. Good for a UI that would rather say "busy, try again".

## Cost and lifetime

- **Held to commit**, including across application code inside the transaction.
- **Released by `ROLLBACK TO SAVEPOINT`** for locks taken after the savepoint.
- **Released automatically at the end of the transaction** — there is no unlock statement. In autocommit mode that means immediately, which makes `FOR UPDATE` outside a transaction a no-op.
- **Stored in the row header**, not as entries in a shared lock table, so locking a million rows does not exhaust `max_locks_per_transaction` — it dirties a lot of tuples and makes everyone wait.
- **Held across a network call** is the failure mode this whole folder keeps returning to: the lock is one connection, and the connection is one row of the pool.

## Observing locks

```sql
SELECT blocked.pid,
       blocked.query,
       pg_blocking_pids(blocked.pid) AS blockers,
       now() - blocked.query_start AS waiting
FROM pg_stat_activity AS blocked
WHERE cardinality(pg_blocking_pids(blocked.pid)) > 0;
```

For production, set `lock_timeout` on user-facing transactions so a wait turns into an error instead of a pile-up, and `log_lock_waits = on` to see waits in the log. `idle_in_transaction_session_timeout` is the safety net for a client that forgets to commit.

## A read-decide-write in Node

```ts
import type { Pool } from "pg";

async function withdraw(pool: Pool, id: number, amount: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{ balance: number }>(
      "SELECT balance FROM accounts WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (rows.length === 0) throw new Error("account not found");

    if (rows[0].balance < amount) {
      await client.query("ROLLBACK");
      throw new Error("insufficient funds");
    }

    await client.query(
      "UPDATE accounts SET balance = balance - $1 WHERE id = $2",
      [amount, id],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release(); // releasing before COMMIT would leak the lock
  }
}
```

The `finally` line is the subtle one: `client.release()` returns the connection to the pool, and the lock lives on that connection's transaction. Release before commit and the lock outlives your function.

## Traps

- [ ] `FOR UPDATE` outside a transaction: the lock is released immediately.
- [ ] Locking in one order in one code path and the opposite order in another: deadlock.
- [ ] `FOR UPDATE` on a row that does not exist: no lock, no gap protection.
- [ ] Assuming it blocks readers: it does not.
- [ ] Holding it across an HTTP call, file upload, or LLM request: pool exhaustion.
- [ ] `FOR SHARE` as a "safe read": it blocks writers until commit.
- [ ] A subquery with `FOR UPDATE` locking rows the outer query never returns.
- [ ] `FOR UPDATE` with `GROUP BY`, `DISTINCT`, or `UNION`: rejected, because rows cannot be identified individually.
- [ ] `FOR UPDATE` of the nullable side of an outer join: rejected.
- [ ] Using it where an atomic conditional `UPDATE ... WHERE` would do.
- [ ] Retrying `40P01` inside the same transaction instead of at the boundary.

## Rules of thumb

- **Take the lock at the read that drives the write, not after it.**
- **Ask for `FOR UPDATE` when you will write.** Shared locks invite upgrade deadlocks.
- **Lock the smallest set, in a stable order, for the shortest time.**
- **A row that does not exist needs a constraint, an advisory lock, or `SERIALIZABLE`.**
- **`SKIP LOCKED` is for claiming work, and claimed work needs a lease.**

## See also

- [What a transaction guarantees](02-what-a-transaction-guarantees.md) — why a lock is a separate guarantee from an atomic commit.
- [Concurrency control across requests](03-cross-request-concurrency-control.md) — why this lock cannot cross an HTTP boundary, and what replaces it.
- [Optimistic vs. pessimistic locking — Vlad Mihalcea](01-vlad-mihalcea-optimistic-vs-pessimistic-locking.md) — the same lock in the article's pessimistic diagram.
- [Layered architecture, §24](../../architecture/02-layered-nuances.md#24-optimistic-vs-pessimistic-locking) — a minimal version in TypeScript.

## References

- PostgreSQL documentation, [`SELECT` — The Locking Clause](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE) — syntax, `NOWAIT`, `SKIP LOCKED`, and the restrictions.
- PostgreSQL documentation, [Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html) — the row-lock modes, the conflict matrix, and how row locks are stored.
- PostgreSQL documentation, [Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) — what a locking read sees at each level, and `40001`.
- PostgreSQL documentation, [Monitoring Locks](https://www.postgresql.org/docs/current/monitoring-locks.html) — `pg_locks`, `pg_blocking_pids()`, and `log_lock_waits`.
- PostgreSQL documentation, [Advisory Locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS) — locking a logical key that may not exist yet.
