# Design follows business reality

*Why DDD adoption looks different in different markets.*

> **Design follows the business. Geography is a proxy, not the reason.**

## The observation

In the US companies I have seen, teams often optimize for speed: ship quickly, validate, buy instead of build, and keep the model simple. DDD is less visible there.

In parts of Europe, teams more often talk about DDD, long-lived models, and stability. The business context rewards a different kind of design.

This is an observation, not a law. A US company can invest in DDD; a European company can optimize for speed.

## Where DDD came from

Eric Evans is American. He developed DDD from consulting work in the US and on international projects from the early 1990s to the 2003 book. His projects were large Java and Smalltalk systems in finance, shipping, insurance, and manufacturing automation. The cargo-shipping example in the book is loosely based on a real container-shipping project.

So the problems behind DDD were large enterprise systems with many domain experts, multiple teams, legacy integration, and long-lived rules. They were not a specifically European problem.

Europe became a strong DDD community later: DDD Europe, JCON, Citerus in Sweden, and Event Storming from Italy. That is adoption and visibility, not origin.

This reinforces the point: **DDD came from a problem context, not a passport.**

Sources: [Eric Evans bio](https://www.informit.com/authors/bio/8E421D92-285C-4C52-B8D1-604A3B3322E1), [Evans on the cargo-shipping project](https://www.informit.com/articles/article.aspx?p=102604&seqNum=5), [DDD sample app and Citerus](https://www.dddcommunity.org/examples2).

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
