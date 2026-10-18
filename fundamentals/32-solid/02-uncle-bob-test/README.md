# The Uncle Bob Test (SRP's blame test)

*SRP in its cheapest-to-ask form: for any piece of code, ask **who in the organization will
get blamed if this breaks at 2am**. One answer — the code serves one actor, proceed. Two
answers — the class or module carries two pulls, and that is a clear violation of the Single
Responsibility Principle.*

This is language-agnostic — the question is asked of org structure, not of code. The examples
lean on JavaScript/TypeScript because that's what this repo is built on.

## The test

The question: **who is responsible for this piece of code, if it breaks?** Not who *should*
be — who *will* be. The test reads the organization's real accountability, not its paperwork.

The rule: **if a class or module has two different people responsible for what it does, that
is a clear SRP violation** — two separate people both believe they own the file's behavior,
and only one of them can be paged first.

It's the same verdict the actor framing gives, measured from the opposite direction:

| | Classic actor framing | The Uncle Bob Test |
| --- | --- | --- |
| Question asked | who would want this file changed? | who will get blamed when this file breaks? |
| Asked | before a change — hypothetical | after a failure — concrete |
| Source of the pull | a change request | an incident |
| Cost of two actors | a refactoring conversation | a 2am page with two candidates |
| Verdict | one class, one actor | one class, one accountable person |

The two framings usually name the same stakeholder: the person who'd request the fix after a
bug is the person who owned the requirement that failed. The blame version just has a practical
edge — ownership of features can be fudged in a planning meeting; being accountable for a
failure cannot.

## The test on the baker

The same class the [SRP note](../01-srp) dissects:

```ts
class Baker {
  bakeBread() {}       // blamed if bread is wrong:   the baker
  manageInventory() {} // blamed if stock is wrong:   the store manager
  manageCustomer() {}  // blamed if service is wrong: the front counter
  cleanBakery() {}     // blamed if hygiene fails:    the health inspector
}
```

Ask the test question of the class as a whole and the file cannot answer — it depends which
method broke. Four different answerers, one class: violation, found without imagining any
future change request. Where the actor analysis asks "who would ever want to change this?",
the blame test asks "what happens on the first bad day?" — and adds the baking, inventory,
customer, and cleaning interests back into the same incident.

## Why two answers is a violation, not a smell

- **Accountability pressure is real pressure.** If two different people are responsible for
  one class, the coupling is no longer hypothetical: an incident or hotfix will make the
  split inevitable, and the test only found the conflict earlier than production did.
- **Blame malfunctions when it must route to two.** The page fires at whoever's code is the
  loudest culprit — so the innocent actor absorbs blame for a failure born of the other's
  concern. The baker gets blamed because an inventory bug took the oven scheduler down. That
  is the ripple-risk cost from the [SRP note](../01-srp) wearing an on-call uniform: a class
  serving two actors has a broken blame routing table, not just a crowded file.

## Three mappings, one line

This test is the third place the organization projects itself into the system:

1. **Communication paths** draw module boundaries — see [Conway's Law](../../33-conways-law).
2. **Change requests** come from actors — the classic "one class, one reason to change."
3. **Blame** routes to accountability — the Uncle Bob Test.

When SRP holds, all three converge on one line: the conversation that defines the interface,
the person who requests its changes, and the person paged at 2am are the same stakeholder, so
an incident actually teaches the org something. When a class mixes two actors, the three maps
disagree — and the three-way tension is what the test detects in one question.

## Nuance

- **One accountable person can have many hands.** Robert C. Martin's unit is "a single
  person, or rather, a single tightly coupled group of people representing a single narrowly
  defined business function" — a billing squad of six iterating on one payment class is one
  actor. The violation is not two *people*; it is two **pulls** — two separate conversations
  that both believe they own the file.
- **Real accountability, not titles.** A module "owned" by Billing but realistically paged
  through Platform is Platform's in test terms, whatever the directory structure was meant to
  say. That is why the question is "who **will** get blamed," not "who should."
- **A reflex, not a project.** The test is cheap enough to run when opening any file; one
  answer, proceed. Two answers — the seam is located, split along the boundary between the
  two accountable people. Like the SRP note's "wait for the second change driver," the test
  fires under real pressure — and after an incident, there is always pressure.

## One-line summary

**For every piece of code ask who will get blamed when it breaks — one answer means the code
serves one actor and is fine; two answers means the class or module carries two pulls and
violates SRP, so tell the two accountable people apart and split along the seam between
them.**

## References

- Robert C. Martin — *Clean Architecture* (Ch. 7: SRP, the actor framing the test sharpens)
- Robert C. Martin — *Single Responsibility Principle* (blog) —
  <https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html>
- This repo — [Single Responsibility Principle (SRP)](../01-srp) — the full deep dive the
  test scores
- This repo — [Conway's Law](../../33-conways-law) — the same org↔architecture mapping at
  system scale
