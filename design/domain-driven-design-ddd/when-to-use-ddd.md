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

The failure mode that makes those invariants hard to protect is covered in [What actually fails in a layered CRUD app](what-fails-in-a-layered-crud-app.md).

## What to use instead

For less complex subdomains, the alternatives are legitimate:

| Alternative | Good when | Breaks down when |
| --- | --- | --- |
| Anemic CRUD + service layer | Simple data entry, admin screens, reporting | Rules multiply and invariants span several tables |
| Transaction script | The workflow is simple and well understood | Scripts grow, logic gets duplicated, one change touches many scripts |
| Table model / Active Record | The app is data-centric and follows the schema | The domain model is tied to the database and rules leak |
| Anemic model + services | The team knows the style and the domain is simple | Behavior is scattered, invariants are not protected |
| Simple OO model | Moderate complexity, small team | Boundaries and consistency become unclear at scale |

None of this is an argument against layered architecture. The blue book recommends layering: UI, application, domain, infrastructure. The problem is an anemic domain layer with procedural rules in services, not the layers themselves.

The practical rule:

- Use CRUD or transaction scripts for low-complexity subdomains.
- Use strategic DDD — bounded contexts and ubiquitous language — to draw boundaries.
- Use tactical DDD — entities, value objects, aggregates, domain services — where invariants span objects and change over time.
- Start simple. Refactor toward a richer model when the pain shows up.

DDD is not a badge. It is a tool for the part of the system where the rules are worth modeling.

## See also

- [Lessons from Eberhard Wolff's DDD example](lessons-from-eberhard-wolff.md)
- [What actually fails in a layered CRUD app](what-fails-in-a-layered-crud-app.md)
- [Subdomains and bounded contexts](subdomains-and-bounded-contexts.md)
- [Where DDD came from](where-ddd-came-from.md)
