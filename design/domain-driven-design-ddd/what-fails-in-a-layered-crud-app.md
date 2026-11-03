# What actually fails in a layered CRUD app

Layered architecture does not fail by itself. In fact, the blue book recommends it: UI, application, domain, infrastructure. A layered architecture can host a rich domain model. The failure mode people usually mean is the **anemic, CRUD-shaped** version of layering:

- entities are data bags with getters and setters;
- business rules live in service methods;
- repositories expose generic queries;
- the database schema is the real model;
- every entry point — REST, admin, batch, events — can call the services directly.

In that shape, invariants are procedural checks, not properties of the model. They are easy to bypass, duplicate, and get wrong under concurrency.

## Example: contract milestones

Invariant: the sum of a contract's milestones cannot exceed the contract value.

A CRUD service might look like this:

```ts
class MilestoneService {
  async create(contractId: string, amount: Money): Promise<void> {
    const contract = await contractRepository.findById(contractId);
    const milestones = await milestoneRepository.findByContract(contractId);

    const total = milestones.reduce(
      (sum, milestone) => sum.add(milestone.amount),
      Money.zero(amount.currency),
    );

    if (total.add(amount).isGreaterThan(contract.value)) {
      throw new Error("Milestones exceed the contract value");
    }

    await milestoneRepository.insert({ contractId, amount });
  }
}
```

The rule works for this one path. Then:

- `MilestoneService.update()` needs the same check, or it can break the invariant.
- An admin endpoint, an import script, or a new API version may insert milestones without going through the service.
- Two concurrent `create` calls can both read the same total, both pass the check, and together exceed the contract value.
- The contract itself cannot protect its own consistency; the rule lives outside it.

With an aggregate, the contract owns the rule:

```ts
class Contract {
  addMilestone(amount: Money): void {
    const total = this.milestones.total().add(amount);

    if (total.isGreaterThan(this.value)) {
      throw new Error("Milestones exceed the contract value");
    }

    this.milestones.push(new Milestone(amount));
  }
}
```

The repository saves the whole `Contract` aggregate, and the transaction boundary matches the consistency boundary. There is one entry point and one place for the rule. Optimistic locking or a version field handles concurrent updates.

## The general pattern

The same failure repeats in different forms:

- **State transitions become status columns.** A contract can move from `draft` to `active` to `completed`, but a CRUD app lets any service set `status = "active"`. The model does not express which transitions are legal.
- **Money becomes primitives.** Amounts, currencies, fees, and rounding rules get recomputed in several services. A `Money` value object makes invalid combinations unrepresentable.
- **Cross-object rules have no home.** A rule that spans a contract, its milestones, and its escrow account lands in a service, then gets copied to another service, then to a batch job.
- **The database becomes the model.** The schema is the only shared source of truth, so business rules migrate into SQL, service code, UI validation, and scheduled jobs.

The architecture is still layered. The domain model is gone.

## Rules multiply, and invariants span tables

A single rule in a service is manageable. The failure comes from what happens as the domain grows:

- a new customer type adds an exception;
- a new payment method adds a branch;
- a new region adds a tax rule;
- a new admin flow needs the same rule and gets its own implementation.

Each change adds a conditional to a service or a new service method. The rule is duplicated, the copies drift, and the model never becomes the place where the rule lives. The codebase accumulates rules instead of expressing them.

An invariant that spans several tables is worse. Consider an invoice whose total must equal the sum of its line items, minus discounts, plus tax. The invoice, line items, discounts, and tax live in separate tables, each with its own repository. A service must load all of them, compute the total, and write the rows. That works in one code path, but:

- another path can update a line item without recomputing the invoice total;
- two concurrent updates can each pass the check and leave the total wrong;
- a batch job can insert rows directly;
- the schema allows invalid combinations because the invariant is not a constraint.

The invariant is real, but it has no single owner. It is a property of the whole invoice, not of any one row. The table-per-repository design gives you many places to change data and no place that owns the condition.

That is the difference between a rule that is *checked* and an invariant that is *protected*. A check is a procedure that can be skipped. An invariant is a condition the model maintains by construction. When the invariant spans tables, the aggregate boundary should match it: the invoice and its line items belong together, loaded and saved as one consistency boundary. If the invariant genuinely spans aggregates, make that explicit with a domain service or an eventual-consistency process instead of hoping every service remembers the rule.

## Layering is not the villain

DDD's own reference architecture is layered: UI, application, domain, infrastructure. Hexagonal architecture is another way to protect the same domain behind ports and adapters. You can have a layered architecture with a rich domain model, and you can have a hexagonal architecture with an anemic one.

The problem is not the layers. It is the **anemic model plus procedural rules scattered across services**. Layering determines where code sits and which way dependencies point. It does not determine whether the domain has behavior, invariants, or a model.

## See also

- [When to use DDD](when-to-use-ddd.md)
- [Lessons from Eberhard Wolff's DDD example](lessons-from-eberhard-wolff.md)
