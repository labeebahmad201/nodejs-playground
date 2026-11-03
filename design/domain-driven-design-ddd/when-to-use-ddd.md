# When to use DDD

DDD is a bet on domain complexity. The question is not whether DDD is good, but where the complexity lives and what it costs to model it.

## The Upwork clone example

An Upwork-like marketplace is not one domain. It is a collection of subdomains with very different levels of complexity.

| Area | Complexity | Sensible approach |
| --- | --- | --- |
| Auth, notifications, file storage | Low / generic | Use existing services or simple modules |
| Profiles, job postings, proposals | Low–medium | CRUD + simple workflow |
| Messaging | Medium | Buy or use a service; keep the model simple |
| Reviews and reputation | Medium | Simple model with clear eligibility rules |
| Matching and search | High, if it is your differentiator | Data/ML and a separate context, not necessarily DDD tactical patterns |
| Contracts, milestones, escrow | High | Rich model with invariants |
| Payments, fees, payouts, refunds | High | Rich model plus a payment provider |
| Disputes and trust & safety | High | Explicit workflow, policies, audit trail |

Most of the surface is CRUD and workflow. The money-and-contract core is where the invariants live. That is where DDD pays off. The table is also a warning against applying DDD uniformly: a rich model for a profile screen is overhead.

## What actually fails in a layered CRUD app

Layered architecture does not fail by itself. A layered architecture can host a rich domain model: UI → application → domain → infrastructure. The failure mode people usually mean is the **anemic, CRUD-shaped** version of layering:

- entities are data bags with getters and setters;
- business rules live in service methods;
- repositories expose generic queries;
- the database schema is the real model;
- every entry point — REST, admin, batch, events — can call the services directly.

In that shape, invariants are procedural checks, not properties of the model. They are easy to bypass, duplicate, and get wrong under concurrency.

### Example: contract milestones

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

### The general pattern

The same failure repeats in different forms:

- **State transitions become status columns.** A contract can move from `draft` to `active` to `completed`, but a CRUD app lets any service set `status = "active"`. The model does not express which transitions are legal.
- **Money becomes primitives.** Amounts, currencies, fees, and rounding rules get recomputed in several services. A `Money` value object makes invalid combinations unrepresentable.
- **Cross-object rules have no home.** A rule that spans a contract, its milestones, and its escrow account lands in a service, then gets copied to another service, then to a batch job.
- **The database becomes the model.** The schema is the only shared source of truth, so business rules migrate into SQL, service code, UI validation, and scheduled jobs.

The architecture is still layered. The domain model is gone.

## Layering is not the villain

DDD's own reference architecture is layered: UI, application, domain, infrastructure. Hexagonal architecture is another way to protect the same domain behind ports and adapters. You can have a layered architecture with a rich domain model, and you can have a hexagonal architecture with an anemic one.

The problem is not the layers. It is the **anemic model plus procedural rules scattered across services**. Layering determines where code sits and which way dependencies point. It does not determine whether the domain has behavior, invariants, or a model.

## What to use instead

For less complex subdomains, the alternatives are legitimate:

| Alternative | Good when | Breaks down when |
| --- | --- | --- |
| CRUD + service layer | Simple data entry, admin screens, reporting | Rules multiply and invariants span several tables |
| Transaction script | The workflow is simple and well understood | Scripts grow, logic gets duplicated, one change touches many scripts |
| Table model / Active Record | The app is data-centric and follows the schema | The domain model is tied to the database and rules leak |
| Anemic model + services | The team knows the style and the domain is simple | Behavior is scattered, invariants are not protected |
| Simple OO model | Moderate complexity, small team | Boundaries and consistency become unclear at scale |

The practical rule:

- Use CRUD or transaction scripts for low-complexity subdomains.
- Use strategic DDD — bounded contexts and ubiquitous language — to draw boundaries.
- Use tactical DDD — entities, value objects, aggregates, domain services — where invariants span objects and change over time.
- Start simple. Refactor toward a richer model when the pain shows up.

DDD is not a badge. It is a tool for the part of the system where the rules are worth modeling.

## See also

- [Lessons from Eberhard Wolff's DDD example](lessons-from-eberhard-wolff.md)
