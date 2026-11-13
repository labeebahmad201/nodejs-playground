# Single Source of Truth

*Every fact should have one authoritative definition. The first copy is a decision; the second is a promise to update both forever. Duplication is not a formatting problem — it is a correctness problem scheduled for the next edit.*

Part of the language-agnostic [`fundamentals/`](../) track. Complements
[`14-state`](../14-state) (state vs derived state) and
[`16-anemic-domain-via-dtos`](../16-anemic-domain-via-dtos) (when duplicated shapes are legitimate).

## The rule

> A fact has exactly one owner. Every other place either derives it, references it, or validates
> against it — it does not restate it.

The **owner** is the place allowed to define the fact. To **restate** is to write the same decision
again, even in different words, a different shape, or a different file. The second copy doesn't have
to look like the first to be a duplicate; it only has to encode the same knowledge.

## What counts as a fact

Not just data. A fact is any decision that can change independently of the code around it:

- a constant, limit, timeout, or retry count;
- the set of valid values — statuses, roles, bracket characters, feature flags;
- a validation rule — max length, regex, allowed state transitions;
- a schema — database columns, API shape, event payload;
- a permission rule;
- a default value;
- an error message or status-code contract;
- a business rule — discount threshold, tax rate, grace period;
- a type that is supposed to describe a runtime value.

Two copies can look completely different and still be the same fact. In a parentheses validator:

```python
close_to_open = {")": "(", "}": "{", "]": "["}

if c == '(' or c == '{' or c == '[':
```

The dictionary and the `if` are two statements of "which bracket characters exist." One is a lookup,
the other is a condition, but they encode the same alphabet.

## The failure mode is drift, not inconsistency

Two copies are consistent on the day you write them. The bug arrives on the **next change**, when
someone updates one and not the other. The compiler usually cannot help, because the relationship
between the copies is implicit — there is no type, import, or foreign key connecting them.

Continue the example. Add `"<": ">"` to the dictionary and forget the `if`:

- `<` is not recognized as an opening bracket;
- it falls into the closing branch;
- `close_to_open["<"]` raises `KeyError`.

Add `<` to the `if` and forget the dictionary, and the same class of failure appears on the first
`>` instead. Either edit breaks the program unless both are made together, forever. That coupling is
the cost, and it is invisible in review because neither line looks wrong on its own.

The fix is to let the dictionary define the alphabet and derive the branch from it:

```python
if c not in close_to_open:
    stack.append(c)
    continue
```

Now there is one owner. Adding `"<": ">"` updates both behaviors at once. (This assumes the input is
restricted to known bracket characters, as the problem guarantees. If arbitrary text is possible,
keep one explicit `OPENING` set and derive the closing map from it — but still pick one owner.)

## The test

Ask three questions about any fact:

1. **If this fact changes, how many places must I edit?** One is a source of truth. More than one is
   duplication. "I don't know" is the worst case: nobody owns it.
2. **When the copies disagree, which one wins?** If there is no defined answer, there are two sources
   of truth, not one.
3. **Can a machine detect the disagreement?** Generated code, shared schemas, contract tests, and
   reconciliation jobs can turn silent drift into a build failure. If nothing checks, the drift is
   latent.

## Where it hides

| Fact | First copy | Second copy | Better |
| --- | --- | --- | --- |
| Valid values | a lookup map | an `if` chain | derive one from the other |
| Validation rule | controller | domain / DB constraint | one rule definition; DB as a backstop |
| API shape | handler | docs / client types | generate clients from OpenAPI or protobuf |
| Config default | code | `.env.example` / deploy manifest | one config module; document it by reference |
| Permissions | middleware | UI hiding / tests | one policy source; UI asks, never decides |
| Database schema | migrations | ORM model / TypeScript types | generate types from the schema |
| Timeout or limit | a constant | docs / config | import or reference the constant |

The pattern is always the same: the first copy is close to the work, so it feels canonical. The
second copy is convenient, so it gets added. Then the two drift, and the bug shows up somewhere
neither copy lives.

## Duplication vs accidental similarity

DRY is about **knowledge**, not text. The real rule is:

> Every piece of knowledge must have a single, unambiguous, authoritative representation.

Two functions that look alike but change for different reasons are not duplicates. Collapsing them
creates a false coupling: a change to one requirement now forces a change to the other. Sandi Metz's
warning applies — *duplication is far cheaper than the wrong abstraction.*

This is why a DTO, a domain entity, and a database row can legitimately share a shape today and still
deserve to be separate types. Their **change reasons** differ: the DTO changes when the API changes,
the row when the table changes, the entity when the business rule changes. That is accidental
similarity, not duplicated knowledge. Conversely, two identical string literals in different files
*are* a violation if they encode the same decision, even though they are only one line each.

## When a second copy is legitimate

A second copy is fine when it is explicitly **derived**, not authoritative:

- **Cache / read model / materialized view.** Allowed if it has an owner, a refresh or expiry path,
  and a defined reconciliation when it is stale. A cache is an optimization of the source, not a
  second source.
- **Boundary models.** DTO vs domain vs row, when they change for different reasons. See
  [`16-anemic-domain-via-dtos`](../16-anemic-domain-via-dtos).
- **Defense in depth.** A database constraint plus application validation can both enforce a rule.
  Keep one canonical definition of the rule and test the layers against it; otherwise the two
  enforcements can disagree (case sensitivity is the classic example).
- **Event logs and audit trails.** The log is the source; projections are derived and rebuildable.
- **Independent test expectations.** Hardcoding the expected output in a test is good — it is an
  independent statement of the requirement. Reimplementing the production algorithm inside the test
  is bad: the test then agrees with the bug.

So the question is not "is there a second copy?" It is: **"Is there a designated owner, and is the
second copy derived or reconciled?"** If yes, it is a projection. If no, it is a second source of
truth waiting to disagree.

## How to establish one

1. **Name the owner.** A module, table, schema, or service owns the fact. Write it down.
2. **Derive the rest.** Compute it, import it, generate it, or query it.
3. **If you must copy, mark it as a projection.** Document the source and the refresh path.
4. **Make disagreement detectable.** Contract tests, schema validation, generated types,
   reconciliation jobs.
5. **Delete the copy you don't own.** Constants duplicated across layers are the easiest win.

## One-line summary

**Every fact should have one authoritative definition; every other place should derive, reference,
or validate against it — and any intentional copy should be an explicit projection with an owner
and a way to detect drift.**

## References

- Andrew Hunt & David Thomas — *The Pragmatic Programmer* — the DRY principle: "Every piece of
  knowledge must have a single, unambiguous, authoritative representation within a system."
- Sandi Metz — "The Wrong Abstraction" — duplication versus a false abstraction.
- Martin Fowler — *Patterns of Enterprise Application Architecture* — derived and cached values.
- The Twelve-Factor App — *Config* — one configuration source per environment.
- OpenAPI, Protocol Buffers, and Prisma — schema-first code generation as an explicit single source.
- Related: [`14-state`](../14-state), [`16-anemic-domain-via-dtos`](../16-anemic-domain-via-dtos),
  [`41-testability-and-anti-patterns`](../41-testability-and-anti-patterns)
