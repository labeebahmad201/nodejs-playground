# Single Responsibility Principle (SRP)

*A class should have **one reason to change** — one job, one owner, one axis of change. If a class does several jobs, every change risks all of them. The code works, but the cost is hidden: every change has to be paid for in attention across the whole class.*

This is language-agnostic. The examples lean on JavaScript/TypeScript because that's what this repo is built on, but the idea applies to any stack.

## The principle

Robert C. Martin's phrasing: *a module should have one, and only one, reason to change* — and a slightly sharper version: *a module should be responsible to one, and only one, actor.*

The word **actor** is doing a lot of work here. Think of "reason to change" as **"a person who would want this file changed"**:

- The baker cares about how bread is baked.
- The store manager cares about how inventory is tracked.
- The front counter cares about how customers are served.
- The health inspector cares about how the bakery is cleaned.

Four different people, one class — that's why "one reason to change" is really **one class, one role**.

## The problem: a class with several jobs

```ts
class Baker {
  bakeBread() {}
  manageInventory() {}
  manageCustomer() {}
  cleanBakery() {}
}
```

Each method belongs to a different concern. `bakeBread` changes because of a new recipe. `manageInventory` changes because of a new stock system. `manageCustomer` changes because of a new loyalty program. `cleanBakery` changes because of a new health rule. Nothing about those changes touch each other — but they all live in the same file, so every one of them requires opening, understanding, and re-testing all of it.

## Why it hurts

Three concrete costs:

- **Cognitive load.** Whoever is changing the inventory logic also has to read, and mentally check, the baking, customer, and cleaning code they'll never touch. They pay attention tax for code that isn't their problem.
- **Ripple risk.** Those methods aren't cleanly separated, so a change to one can accidentally break another. Every change needs an audit of the whole class for potential breakage instead of being contained locally.
- **Scaling pain.** A `bakeBread` that has to cater to inventory, customer, and cleaning concerns accumulates branches and special cases. Where the concern belongs is no longer obvious, so new functionality gets bolted on wherever it happens to fit — and the class becomes a magnet for tech debt.

## The fix: split by role

Each concern gets its own class with exactly one change driver:

```ts
class Baker {
  bakeBread() {}
}

class BakeryInventory {
  trackStock() {}
  reorderSupplies() {}
}

class BakeryDesk {
  serveCustomers() {}
  handlePayment() {}
}

class BakeryCleaner {
  deepClean() {}
  restockSanitarySupplies() {}
}
```

Nothing about the *behavior* changed. What changed is the boundary: now a change to inventory is a change to `BakeryInventory` alone. The person making it doesn't need to read `Baker`, `BakeryDesk`, or `BakeryCleaner` at all.

## Why it matters (recap)

- **Lower cognitive load.** Readers only pay for the slice they change. One file per concern, not one file per *everything*.
- **Independence.** Each class changes on its own, without checking sibling methods for breaking changes — they aren't tightly coupled, so ripple isn't a concern.
- **Scalability.** Fewer constraints on the class, so it's easy to add more functionality to the module it actually belongs in.

## How to spot violations

Smells:

- **Manager / Util / Helper / Service names.** They hide *which* thing is being managed, used, or served. If a class needs a vague name, it's probably doing several things.
- **Wide imports.** A class importing `db`, `emailClient`, `logger`, `stripe`, and `pdfRenderer`is being pulled by several actors.
- **Tests that mock four different worlds.** A test suite that has to fake the DB, the mailer, the payment provider, and the clock just to run one class is telling you those actors share the file.
- **Explaining the class takes "and … and … and …".** "This handles customers *and* inventory *and* cleaning." Every "and" after the first is a missing boundary.

Guardrail question before you start editing: **how many reasons does this class have to change?** If you can name more than one actor, split first, then change. (A blame-flavored version of this question lives in the [Uncle Bob Test](../02-uncle-bob-test): ask who will get paged when it breaks — two accountable people, same verdict.)

## Violations in the wild

Three published examples, quoted from their sources — a teaching one, a textbook one, and a real production codebase.

### 1. Uncle Bob's `Employee` — three actors, one class

From Robert C. Martin's article that defined the actor framing:

```java
public class Employee {
  public Money calculatePay();
  public void save();
  public String reportHours();
}
```

Same shape as our `Baker`, mapped to a business instead of a bakery. Martin works out which executive "would be fired" for each method: the **CFO** owns `calculatePay` (pay calculation is a financial responsibility), the **COO** owns `reportHours` (specifying what auditors get is an operations responsibility), and the **CTO** owns `save` (the enterprise database is his). Three requesters, one class — so it changes for any of them.

His warning is exactly the ripple-risk cost from the baker note:

> If you change the `calculatePay` method, and inadvertently break the `reportHours` method; then the COO will start demanding that you *never change the* `calculatePay` *method again.*

And then the paragraph that gets to the crux of it — his words, verbatim:

> And this gets to the crux of the Single Responsibility Principle. **This principle is about people.**
>
> When you write a software module, you want to make sure that when changes are requested, those changes can only originate from a single person, or rather, a single tightly coupled group of people representing a single narrowly defined business function. You want to isolate your modules from the complexities of the organization as a whole, and design your systems such that each module is responsible (responds to) the needs of just that one business function.

And his alternative phrasing of SRP:

> Gather together the things that change for the same reasons. Separate those things that change for different reasons.

**The leap: SRP is a boundary-drawing rule, not a code-splitting tip.** This quote gets to the heart of it — and honestly, it surprised me: I had never used the principle *this* way before. I'd treated SRP as guidance for tidying a class I already had ("make the baker smaller"). But read as "a reason to change = a person (or group) who requests the change," the principle answers bigger questions than "should I split this class": **which** boundaries exist at all, what the module structure should look like, and **how many** modules you should have — because the departments of the org, and the people within them, are the things that determine it. Filter the org chart by "who would ask this piece of code to change?", and the module structure almost draws itself: one narrow business function per module, one tightly coupled group of people per module.

(This points the same direction as [Conway's Law](../../33-conways-law) — the observation that an organization's communication structure gets copied into the systems it designs. Conway's Law says the org shows up in your architecture whether you plan it or not; SRP-with-actors is the same mapping used *deliberately*, as the tool for drawing the boundaries.)

Source: <https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html>

### 2. Wikipedia's `GameManager` — the textbook god object

Wikipedia's *God object* article (which opens by calling the god object an anti-pattern that violates the single-responsibility principle) uses this C++ class to do "everything from managing players, handling game logic, rendering, reading input and file I/O". Signatures shown; bodies omitted here, full listing at the source:

```cpp
class GameManager {
public:
    void addPlayer(const std::string& name);
    void listPlayers() const;
    void startGame();
    void updateGame();
    void endGame();
    void draw();                       // rendering
    void handleInput(const std::string& input);
    void saveGame();                   // file I/O
    void loadGame();                   // file I/O
    void run();
private:
    std::vector<std::string> players;
    int score = 0;
    bool running = false;
};
```

Wikipedia's own statement of the cost paraphrases our ripple-risk bullet almost exactly:

> Changes made to the object for the benefit of one routine can have a ripple effect on other unrelated functions.

Its fix matches our "split by role" section one-for-one: five narrower classes (`PlayerManager`, `GameLogic`, `Renderer`, `InputHandler`, `SaveSystem`) with a `GameManager` reduced to composing them and hosting `run()`.

The same article quotes a heuristic worth keeping next to the naming smells — Riel, *Object-Oriented Design Heuristics* (1996), heuristic 3.2:

> Do not create god classes/objects in your system. Be very suspicious of an abstraction whose name contains Driver, Manager, System, or Subsystem.

Source (CC BY-SA): <https://en.wikipedia.org/wiki/God_object>

### 3. Rails `ActiveRecord::Base` — a production god class

From the actual source (rails v4.2.11, `activerecord/lib/active_record/base.rb`), the entire declaration of the class everything in Rails inherits from — quoted verbatim:

```ruby
class Base
  extend ActiveModel::Naming

  extend ActiveSupport::Benchmarkable
  extend ActiveSupport::DescendantsTracker

  extend ConnectionHandling
  extend QueryCache::ClassMethods
  extend Querying
  extend Translation
  extend DynamicMatchers
  extend Explain
  extend Enum
  extend Delegation::DelegateCache

  include Core
  include Persistence
  include ReadonlyAttributes
  include ModelSchema
  include Inheritance
  include Scoping
  include Sanitization
  include AttributeAssignment
  include ActiveModel::Conversion
  include Integration
  include Validations
  include CounterCache
  include Attributes
  include AttributeDecorators
  include Locking::Optimistic
  include Locking::Pessimistic
  include AttributeMethods
  include Callbacks
  include Timestamp
  include Associations
  include ActiveModel::SecurePassword
  include AutosaveAssociation
  include NestedAttributes
  include Aggregations
  include Transactions
  include NoTouching
  include Reflection
  include Serialization
  include Store
end
```

Count the change drivers: query building and querying, validation, callbacks, transactions, optimistic *and* pessimistic locking, associations, serialization, attribute typecasting, connection handling, single-table inheritance, enums. The class's rdoc alone walks through constructor forms, condition syntaxes, accessor overwriting, dynamic finders, YAML serialization, STI, connection pooling, and a dozen exception classes. Application developers, framework maintainers, and database admins all care — about different slices.

Two notes worth having honestly:

- The SRP critique of the Active Record pattern itself, put cleanly:

  > The responsibility of managing persistence of values to a data store and the responsibility of the domain logic that applies to the data held by the object are completely orthogonal to each other

  (K. McKelvin, *ActiveRecord Callbacks and the Single Responsibility Principle*, 2016 — <https://medium.com/@kmckelvin/activerecord-callbacks-and-the-single-responsibility-principle-1f42da092e5d>)

- Note the module pattern: Rails *did* split the code into \~30 modules, one per concern. That fixes file-level pain (search it, edit one module), but every model class still exposes the combined interface — the *public surface* of the class still serves every actor at once. Splitting the file is not the same as splitting the responsibility; see "one class, one role" above.

Source (MIT-licensed, quoted verbatim): <https://github.com/rails/rails/blob/v4.2.11/activerecord/lib/active_record/base.rb>

## Nuance

- **It is not one method per class.** The boundary is the *responsibility*, not the member count — ten methods can share one reason to change and be fine.
- **"Responsibility" is relative to actors, not to lines.** The same class in a small bakery and in a national chain might have a different set of actors, so the split can differ. SRP is judged by your system's change drivers, not by an absolute list of what counts as a responsibility.
- **The unit is the role, not the person.** In a smaller organization one person may be running
  both billing and customer service. Putting billing and customer-service concerns in one module
  because "it's just one person" is a mistake: the person is working two different roles, and two
  different roles are two actors. This wears-many-hats case is common in small orgs, so counting
  humans instead of roles quietly misreads the principle exactly where it feels most optional.
- **SRP is fundamentally about managing change over time.** Change requests can originate from
  multiple actors, and when two actors share one module, conflicting requirements can block each
  other there. Drawing the module boundary along the actor means each module's changes come from
  one originator — and you can count on the fact that one actor won't issue conflicting
  requirements to itself.
- **It applies at every scale.** A function, a module, a service, a repo — same question: how many reasons does this thing have to change? (See also `01-pure-functions`, which is one way to make the answer "one" at the function level.)
- **One actor — or one reason to change — does not mean one module or class; two forces are at
  play, not one.** The typical misreading of the principle: "a class or module should have one
  reason to change, therefore everything with that one reason belongs bundled in a single class
  or module." SRP says no such thing — bundling the code artifacts together just because they
  share a reason to change, or share an actor, is not part of the principle. Separating by
  actor is a cap on combining, not an instruction to combine. The
  same-reason pull is one force pushing responsibilities into one module — and there is an
  opposite force pushing the same responsibilities into separate modules even though the actor
  count says otherwise: design decisions that change independently and at different rates,
  responsibilities that are used or done independently, domain concepts that stand on their
  own. The actor rule governs the walls between actors; what lives *inside* one actor's walls
  is decided by the opposing force, and can be more than one module.
- **Don't split preemptively into one-class-per-actor before any actor exists.** Wait for the
  second change driver to show up, then split on the seam that hurts, not the seam you predict.

## Roles change — and the architecture must follow

The actors you organized around are not permanent: roles merge, split, appear, and disappear.
When a role changes, the code architecture has to catch up — that change takes time and has to
be made, because otherwise the system accumulates ownership problems over who gets to change
each piece of software. This is one reason architecture is never fixed: it evolves as the
organization does.

Not all role changes stress the architecture equally:

| Role change | Effect on the modules | Architectural stress |
| --- | --- | --- |
| **Role merge** (two actors become one) | code that was separated now serves a single actor; SRP is still satisfied | low — over-separation is fine; consolidate only when cohesion or simplicity asks for it |
| **Role split** (one actor becomes two) | a module built for one actor now serves two actors with potentially divergent needs — it has silently acquired two reasons to change | high — a genuine SRP violation that appears without any code changing |
| **New role** | existing modules may now be serving a stakeholder they were never designed for, or new code needs a home | examine — it depends on where the new role's concerns land |
| **Role eliminated** | code may become dead or need reassignment | usually low |

The split case is the one to watch: nothing in the repository changed, yet a module went from
one change originator to two. This is exactly what the [Uncle Bob Test](../02-uncle-bob-test)
detects — after a role split, the 2am page suddenly has two candidate owners. More broadly it
is [Conway's Law](../../33-conways-law) running in real time: the org changed, and the system's
boundaries will be pressed into the new shape whether or not anyone plans it. The job is to
make the module split on the seam that hurt first, rather than letting ownership conflicts do
the splitting for you.

## One-line summary

**A class should have one reason to change — one job, one actor; if a class serves several responsibilities, every change requires opening all of them, so split by concern and each part can change, scale, and be understood independently.**

## References

- Wikipedia — *Single-responsibility principle* — <https://en.wikipedia.org/wiki/Single-responsibility_principle>
- Robert C. Martin — *Clean Architecture* (Ch. 7: SRP, the actor framing)
- Robert C. Martin — *Single Responsibility Principle* (blog) — <https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html>
- Wikipedia — *Conway's Law* (org structure reflecting into system design) — [https://en.wikipedia.org/wiki/Conway's_law](https://en.wikipedia.org/wiki/Conway%27s_law)
- Wikipedia — *God object* (contains the `GameManager` example; CC BY-SA) — <https://en.wikipedia.org/wiki/God_object>
- Arthur J. Riel — *Object-Oriented Design Heuristics* (1996), heuristic 3.2 (quoted in the Wikipedia article)
- rails/rails — `activerecord/lib/active_record/base.rb`, tag `v4.2.11` (MIT) — <https://github.com/rails/rails/blob/v4.2.11/activerecord/lib/active_record/base.rb>
- K. McKelvin — *ActiveRecord Callbacks and the Single Responsibility Principle* (Medium, 2016) — <https://medium.com/@kmckelvin/activerecord-callbacks-and-the-single-responsibility-principle-1f42da092e5d>