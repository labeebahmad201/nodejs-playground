# Bounded contexts, microservices, and teams

A bounded context is a model boundary. A microservice is a deployment boundary. They are related, but they are not the same decision.

Two bounded contexts do not have to become two microservices. They can live in one deployable unit, such as a modular monolith, as long as the model boundary stays explicit.

## When separate services make sense

There is a stronger case for separate microservices when separate teams own the contexts. Each team can then deploy independently, work in parallel, and avoid coordinating every release. The point is not the number of services; it is removing coordination overhead and letting teams move independently.

A separate service is a strong option in that situation, not an automatic rule. The deployment boundary should follow a real need for independent change.

## One team can own multiple contexts

If a bounded context is small, one team can manage more than one. That is normal. Ownership is about the model and the language, not a one-team-per-context headcount rule.

The boundaries still need to be explicit. One team owning several contexts does not mean the contexts collapse into one model.

## Do not assign two teams to one bounded context

This is where the problems start:

- **Data ownership** — who owns the schema, and who decides when it changes?
- **Code ownership** — both teams edit the same model and collide.
- **Deployment** — who deploys, when, and with what sign-off?
- **Architecture and design** — who makes the binding decisions when the teams disagree?

With two teams, every change becomes a negotiation. The bounded context loses a single owner, and the model and language drift.

## Rule of thumb

- One bounded context should have one owning team.
- One team can own multiple bounded contexts.
- A bounded context does not require its own microservice.
- Use a separate microservice when independent teams and independent deployment cadence justify it.
- Do not split one bounded context across teams.

The model boundary and the deployment boundary are separate decisions. Keep the model boundary even when you keep one deployment.

## See also

- [Subdomains and bounded contexts](subdomains-and-bounded-contexts.md)
- [Lessons from Eberhard Wolff's DDD example](lessons-from-eberhard-wolff.md)
- [When to use DDD](when-to-use-ddd.md)
