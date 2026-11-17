# SELECT ... FOR UPDATE in PostgreSQL

*`FOR UPDATE` turns a read into a lock: the rows the query matches are held until the transaction ends, so the value you read is still true when you write from it. The useful part is taking the lock before the decision. The dangerous part is that it silently does nothing in three common situations.*

## What it buys you

```sql
BEGIN;
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;  -- other writers wait here
UPDATE accounts SET balance = balance - 40 WHERE id = 1;
COMMIT;                                                -- lock released here
```

Three properties follow from that statement:

- It locks the rows the query **matched**, at read time.
- It holds them until `COMMIT` or `ROLLBACK`, not until the end of the statement.
- It blocks **writers and other lockers**; a plain `SELECT` in another session keeps reading the old version.

That last point surprises people. `FOR UPDATE` coordinates writers. It does not hide the row from readers, and it does not stop a read-only report from showing stale data.

## The four clauses

| Clause | Strength | Blocks |
| --- | --- | --- |
| `FOR UPDATE` | Exclusive, strongest | Every other lock, plus `UPDATE`/`DELETE` |
| `FOR NO KEY UPDATE` | Exclusive, weaker | Other updates that are not key-share |
| `FOR SHARE` | Shared | Any write until you commit |
| `FOR KEY SHARE` | Shared, weakest | `FOR UPDATE` only |

Use `FOR UPDATE` when you know you will write. `FOR SHARE` sounds like "a safe read" but blocks writers until commit, which is rarely what a read-only path wants.

## Three ways it does nothing

1. **No matching row.** There is no tuple to lock, so a concurrent `INSERT` walks straight through. A unique index, an advisory lock, or `SERIALIZABLE` is the fix.
2. **A reader.** Another session's plain `SELECT` is unaffected. If you need the row to be unchangeable, you have to write or lock from that session too.
3. **Autocommit.** Outside an explicit transaction the lock is released at the end of the statement, which makes it a no-op.

## The lock you already have

`UPDATE` already takes `FOR NO KEY UPDATE`, and `DELETE` takes `FOR UPDATE`. The first write locks regardless.

`FOR UPDATE` changes *when* the lock arrives. Taking it at the read means the value the decision was based on cannot move; taking it at the write means the decision was made against a value that already could.

## Holding it too long

The lock lives on the connection until commit. That is fine for the milliseconds between two statements and fatal across a network call: one held lock is one pinned pool connection, and the row is blocked for everyone.

If the critical section crosses an HTTP boundary, this is the wrong tool — see [Concurrency control across requests](03-cross-request-concurrency-control.md). Set `lock_timeout` on user-facing transactions so a wait fails fast instead of piling up.

## Claiming work with SKIP LOCKED

```sql
UPDATE jobs
SET status = 'running', started_at = now()
WHERE id = (
  SELECT id FROM jobs
  WHERE status = 'pending'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

`SKIP LOCKED` ignores rows another worker already locked, so N workers claim N jobs without waiting. It is the standard queue claim in PostgreSQL, with two caveats: the result is a deliberately inconsistent view, and a worker that dies leaves its row `running` until a lease or reaper takes it back. `NOWAIT` is the fail-fast variant.

## Deadlocks

Two transactions locking the same two rows in opposite order will deadlock; PostgreSQL aborts one with `40P01`. Use a consistent order (`ORDER BY id`), keep the locked set small, and retry at the transaction boundary.

## Traps

- [ ] `FOR UPDATE` outside a transaction: released immediately.
- [ ] Locking in one order in one code path and the reverse in another: deadlock.
- [ ] Expecting it to lock a row that does not exist.
- [ ] Expecting it to block readers.
- [ ] Holding it across an HTTP call, upload, or LLM request.
- [ ] Using it where an atomic `UPDATE ... WHERE` would do.

## Rules of thumb

- **Take the lock at the read that drives the write.**
- **Ask for `FOR UPDATE` when you will write.** Shared locks invite upgrade deadlocks.
- **A missing row needs a constraint, an advisory lock, or `SERIALIZABLE`.**
- **`SKIP LOCKED` claims work; claimed work needs a lease.**

## See also

- [What a transaction guarantees](02-what-a-transaction-guarantees.md) — why a lock is a separate guarantee from an atomic commit.
- [Concurrency control across requests](03-cross-request-concurrency-control.md) — why this lock cannot cross an HTTP boundary.
- [Optimistic vs. pessimistic locking — Vlad Mihalcea](01-vlad-mihalcea-optimistic-vs-pessimistic-locking.md) — the same lock in the article's pessimistic diagram.

## References

- PostgreSQL documentation, [`SELECT` — The Locking Clause](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE) — syntax, `NOWAIT`, `SKIP LOCKED`, and the restrictions.
- PostgreSQL documentation, [Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html) — the four row-lock modes and their conflict matrix.
