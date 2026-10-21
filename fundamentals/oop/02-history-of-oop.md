# The Forgotten "Why": History, OOP, and Repeating Mistakes

*Every generation learns the "how", but forgets the "why". And without the "why", we repeat the same mistakes.*

## The OOP split: Simula vs Smalltalk

There were two very different origins to what we call Object-Oriented Programming:

- **Kristen Nygaard and Ole-Johan Dahl (Simula 67, late 1960s)** — Created the first language with classes, objects, and inheritance. Their goal was simulation modeling. This gave us the *mechanics* of OOP.
- **Alan Kay (Xerox PARC)** — Coined the term "object-oriented programming" while designing **Smalltalk**. For Kay, OOP was about **autonomous objects communicating via messaging**, inspired by biological cells. The goal was about decoupling, late-binding, and creating systems where objects act like independent agents. This gave us the *philosophy* of OOP.

**Simula gave us the mechanics. Kay gave us the philosophy.** What most of us learn today is far closer to Simula than to Kay's original vision.

## How the "why" got lost

Alan Kay has been vocal about this for decades. What happened was that OOP went mainstream, and the focus shifted from *messaging and decoupling* to *inheritance hierarchies, classes, and data encapsulation*.

Programmers learned:
- *"Make a class"* 
- *"Use inheritance here"*
- *"Follow this pattern"*

But rarely learned:
- *"Why was this invented in the first place?"*
- *"What problem was this trying to solve?"*
- *"When is this actually the right tool?"*

Without the "why", patterns become **cargo-culted**. We reach for polymorphism, SOLID principles, or design patterns not because the problem demands it, but simply because "that's what you're supposed to do".

## History repeats itself

This is exactly the same pattern we see throughout history. When a generation forgets the lessons of those that came before it, it ends up paying the same price all over again.

- **We forget the white space.** We see the end result — the classes, the patterns, the principles — but we forget the pain, constraints, and failures that produced them. We only see the solution, not the war that necessitated it.
- **We repeat the mistakes.** Just like with OOP, people jump straight to the "how" without understanding the original intent. The same design mistakes get rediscovered, debated, and "solved" again decades later.
- **It's not unique to software.** Every profession suffers from this. Nations forget the lessons of their past and repeat them. Fields forget their history and repeat their cycles. Software is no different.
- **Time and tutorials favor "how".** Most resources optimize for getting something working quickly, not for understanding the historical context or trade-offs.
- **Success breeds dilution.** Once an idea becomes mainstream, it gets stripped down to a checklist, taught by people who may have never learned its nuance themselves.
- **Career churn accelerates it.** Constant influx of new people means the cycle restarts every few years.

**History repeats itself because we refuse to learn it.** The people before us already fought these battles and paid the tuition. Ignoring their lessons means we pay it all over again.

## The junior majority and knowledge loss

Robert C. Martin (Uncle Bob) has pointed out something important about this cycle: as an industry, we are constantly flooded with new developers. Year after year, juniors enter in large numbers, while more experienced developers retire, move into management, or leave the industry. This creates a structural imbalance — the **junior population is often the majority** at any given time.

Uncle Bob's warning is roughly this: if the majority of practitioners never learn *why* things were done, if they only learn the surface-level practices of their immediate cohort, then the hard-earned lessons of the field get diluted and lost with each passing wave. The experience that was expensive to gain gets eroded, not preserved.

What this means practically:

- **Wisdom doesn't automatically propagate.** Experience has to be deliberately passed down. If mentorship is weak and education is reduced to "how-to" tutorials, that transmission breaks.
- **The field can forget its own discipline.** When juniors vastly outnumber those who know the history and trade-offs, the default culture becomes "what's popular now", not "what has stood the test of time".
- **We keep relearning the basics.** This is why we keep re-inventing, re-debating, and re-branding the same solutions every decade. It's not that the problems are new — it's that the memory of how we solved them keeps getting lost.

This isn't a criticism of juniors — it's a structural reality of our field. The responsibility is on both sides: experienced engineers need to teach the "why", and newcomers need to seek out the context behind the practices they're taught.

## The antidote

As Christopher Okhravi often demonstrates, we need to go back to first principles. We need to understand the problems our tools were designed to solve.

- **Ask "why" before "how".** Don't just learn the syntax or the principle — learn the problem it addresses.
- **Go to primary sources.** Read the original papers, watch the original talks, understand the context.
- **Learn the history of your field.** The lessons of the past save us from paying the same tuition again.
- **Resist cargo-culting.** Just because something is considered "best practice" doesn't mean it's best for *your* problem.
- **Pass it down intentionally.** Document the rationale, explain the trade-offs, and teach the history, not just the mechanics.

## Sources

- **Alan Kay** — ["The Early History of Smalltalk"](https://dl.acm.org/doi/10.1145/155360.155364) (ACM SIGPLAN Notices, 1993). The clearest account of what he was actually trying to build.
- **Kristen Nygaard & Ole-Johan Dahl** — Original Simula papers on simulation and class-based modeling.
- **Alan Kay Talks** — ["The Computer Revolution Hasn't Happened Yet"](https://www.youtube.com/watch?v=oKg1hTOQXoY) is a great starting point. He constantly contrasts the original vision with what we ended up with.
- **Robert C. Martin (Uncle Bob)** — *Design Principles and Design Patterns* (2000), *Agile Software Development: Principles, Patterns, and Practices* (2002). Often speaks about the loss of discipline and why we must preserve the "why" across generations.
- **Christopher Okhravi** — [YouTube Channel](https://www.youtube.com/@ChristopherOkhravi). His videos consistently go back to the "why" behind OOP, polymorphism, and SOLID.
- **Martin Fowler** — His essays often trace ideas back to their origins before explaining modern forms.

## AI, tutorials, and the shift in learning

This problem has only gotten worse with the rise of AI and tutorial culture.

- **Tutorials taught "how", not "why".** Most tutorials were written for beginners looking to get something working immediately. They taught step-by-step instructions, but rarely explained the reasoning behind them. That's useful to *start*, but dangerous if it becomes the end of learning.
- **AI killed that model.** With AI, you don't need to follow a 10-hour tutorial to get boilerplate working. You can ask for it, have it generate it, and run it. The "how" is now cheaper than ever.
- **That makes the "why" more important than ever.** If AI can write the code for you, the value shifts. Knowing *what* to ask, *when* to use a pattern, *why* a design is good or bad, and *when* to reject it — these are the things AI won't reliably teach you unless you already know to ask for them.
- **We need to learn from people who explain the "why".** Watch videos, read books, and follow creators who go back to first principles. Christopher Okhravi is a great example of this — he doesn't just show you how to write polymorphic code, he shows you *when* and *why* it matters. Those are the resources worth investing your time in.
- **The real skill is discernment.** In a world where anyone can generate working code, the engineer who understands history, trade-offs, and intent will stand out. The one who only knows how to copy-paste from tutorials (or now from AI) will struggle to know when it's wrong.
