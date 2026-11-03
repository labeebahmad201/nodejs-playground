# Bounded contexts, microservices, and teams

> **One unit of change, one owner.**

A bounded context is a model boundary. A microservice is a deployment boundary. They are related, but they are not the same decision.

Two contexts can live in one deployable unit, such as a modular monolith. They can also be separate services. The question is not "how many contexts?" It is "who needs to change what without coordinating?"

## The real cost: coordination

Sharing code, data, or a deployment has a price. Two teams on the same piece of work create:

- merge conflicts and duplicate work;
- unclear data ownership;
- release coordination and sign-offs;
- design arguments with no final decision-maker.

That overhead is sometimes acceptable. Sometimes it is not. The goal is to make it a choice, not an accident.

## Four ownerships to make explicit

| Ownership | The question |
| --- | --- |
| **Code** | Who can change it, and who approves? |
| **Data** | Who writes it, and who owns the schema? |
| **Deployment** | Who ships it, when, and who rolls it back? |
| **Design** | Who decides when there is a disagreement? |

If these are unclear, the coordination cost is hidden. It shows up later as conflict.

## When separate services make sense

Separate when separate teams need independent deployment cadence. Then each team can ship without waiting for the other. That is the strong case for a microservice.

But separation is not free. It adds network calls, operations, duplication, and failure modes. Use it when the coordination cost is higher than the cost of separation.

## One team can own many contexts

Small contexts can share a team. That is normal. The number of bounded contexts is not a team-count formula.

What matters is not one team per context. It is **one owner per context**.

## Do not put two teams on one context

Two teams on one bounded context means:

- both teams can change the same model;
- both teams can disagree on the same rule;
- every change needs negotiation.

The context loses a single owner. The model and the language drift.

## Remember

- **Bounded context:** one model, one language, one owner.
- **Microservice:** one deployable unit, not automatically one context.
- **One team can own many contexts.**
- **Two teams should not own one context.**
- **Separate only when coordination costs more than separation.**

This is not DDD-specific. It applies to modules, microservices, monorepos, and open source. In open source, maintainers are the owners; shared areas need explicit maintainers and a decision process.

## See also

- [Subdomains and bounded contexts](subdomains-and-bounded-contexts.md)
- [Lessons from Eberhard Wolff's DDD example](lessons-from-eberhard-wolff.md)
- [When to use DDD](when-to-use-ddd.md)
