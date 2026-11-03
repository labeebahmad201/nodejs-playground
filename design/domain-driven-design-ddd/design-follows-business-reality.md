# Design follows business reality

*Why DDD adoption looks different in different markets.*

> **Design follows the business. Geography is a proxy, not the reason.**

## The observation

In the US companies I have seen, teams often optimize for speed: ship quickly, validate, buy instead of build, and keep the model simple. DDD is less visible there.

In parts of Europe, teams more often talk about DDD, long-lived models, and stability. The business context rewards a different kind of design.

This is an observation, not a law. A US company can invest in DDD; a European company can optimize for speed.

## What actually differs

Geography is a proxy for things like:

- funding horizon and growth pressure;
- regulation and compliance;
- market maturity and customer expectations;
- the cost of failure and the cost of change;
- labor market and team structure.

Those forces shape the design more than the country does.

## Two design tendencies

| If the business optimizes for... | Design tends to... | DDD is... |
| --- | --- | --- |
| **Speed and experimentation** | small slices, buy over build, simple architecture, delayed modeling | selective |
| **Stability and longevity** | explicit boundaries, ubiquitous language, rich models, documentation | more central |

Most real companies are a mix. The core domain may get DDD while the generic parts are bought and kept simple.

## The useful question

Do not ask "Is this a US or EU company?" Ask:

- What is the business optimizing for?
- What is the cost of change?
- What is the cost of failure?
- How long will this system live?
- What must be stable, and what must move fast?

Then choose the design that fits those answers.

## Remember

- **Design follows the business, not the map.**
- **Speed favors simple, selective modeling.**
- **Stability favors explicit boundaries and richer models.**
- **Geography is a proxy for funding, regulation, risk, and time horizon.**
- **Do not copy a practice from a context that does not match yours.**

## See also

- [When to use DDD](when-to-use-ddd.md)
- [Subdomains and bounded contexts](subdomains-and-bounded-contexts.md)
- [Lessons from Eberhard Wolff's DDD example](lessons-from-eberhard-wolff.md)
