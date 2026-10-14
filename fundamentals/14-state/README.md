# State

***State** is the data a program remembers between events — its memory over time. It's what makes
the same input produce different outputs, and therefore what makes a function impure and a system
complex. Understanding where state lives, who owns it, and how long it lasts is central to
reasoning about software.*

Part of the language-agnostic [`fundamentals/`](../) track. Directly complements
`01-pure-functions`; see also `05-entities` and `reactjs/03-useState` for the React angle.

## Definition

**State is data that persists across time and affects future behavior or output.** If a piece of
data changes how the program behaves *later* — and isn't just consumed and forgotten — it's state.

The key consequence: **same input + different state → different output.** That's the whole reason
state is both essential and dangerous:

```ts
// No state: 3 + 4 is always 7.
add(3, 4);

// State: the result depends on history, not just arguments.
counter.increment();   // 1
counter.increment();   // 2   ← same call, different effect
```

A **pure function has no state** (`01-pure-functions`); a **stateful** one remembers something
between calls. Most real systems are stateful — the skill is in managing *where* and *how long* that
memory lives.

## State vs related ideas

| Thing | Is it state? | Why |
| --- | --- | --- |
| A function's local variable, reset each call | no | doesn't persist between events |
| An object's field | yes | survives across method calls |
| A database row | yes | durable state |
| A cache entry | yes | derived-but-persisted, with a lifetime |
| Config / env vars | usually no | fixed for the process (constant input, not evolving) |
| A request's parsed body | transient | state only for the life of the request |
| A `const` computed from inputs | no | a value, not memory |

## Stateless vs stateful

| | Stateless | Stateful |
| --- | --- | --- |
| Same input → same output | yes | no (depends on history) |
| Remembers anything? | no | yes |
| Examples | pure functions, stateless services, HTTP handlers that read the DB each time | counters, sessions, caches, in-memory queues |
| Testability | trivial | needs setup/reset of state |
| Scale-out | easy (any instance) | needs shared/persistent state |

The design tension: state is **necessary** (you need memory), but **statelessness is cheap to scale,
reason about, and test**. Good systems concentrate state where it belongs and keep the rest stateless.

## Where state lives

State has a **scope** (who can see it) and a **lifetime** (how long it lasts):

| Location | Scope | Lifetime |
| --- | --- | --- |
| Local variable | one call | the call |
| Object/instance field | that object | the object |
| Module/global variable | whole process | the process |
| Request context | one request | the request |
| Session | one user | until expiry |
| Browser memory / `localStorage` / URL | client | until tab close / cleared / navigation |
| Cache (Redis, in-memory) | service(s) | until eviction/TTL |
| Database / file | the system | durable |

Choosing scope + lifetime well *is* state design.

## Mutable vs immutable state

- **Mutable state** — the same reference is changed over time (`account.balance -= 10`). Convenient,
  but a source of bugs — shared mutation, races, and "who changed this?".
- **Immutable state** — changes produce a **new** value (`{ ...prev, x }`). Easier to reason about,
  compare, snapshot, and share. This is why value objects are immutable (`04-value-objects`) and why
  React compares references (`reactjs/08b-object-is`).

You rarely eliminate mutation, but you can **confine** it: keep mutable state in as few, as small,
and as clearly-owned places as possible.

## Sources of truth & derived state

- Keep **one source of truth** per piece of data. Two places holding the same fact will drift.
- **Derive, don't duplicate.** If a value can be computed from other state, compute it — storing it
  again creates a second source of truth that can disagree.

```ts
// Two sources of truth — they can drift out of sync.
state = { items: [...], count: 3 };   // count is derived — don't store it

// One source of truth; count is computed.
state = { items: [...] };
const count = state.items.length;
```

(Derived values that are *expensive* may be cached — but the cache is an optimization of a source of
truth, not a second one.)

## State in the frontend

The UI is a function of state: **`UI = f(state)`**. You don't change the DOM directly; you change
state and re-render (`reactjs/00-why-react`, `reactjs/03-useState`).

Distinguish the *kinds* of state, because they differ in ownership and lifecycle:

| Kind | Example | Owned by |
| --- | --- | --- |
| **Local/UI state** | a toggle, input text | the component |
| **Shared client state** | current user, theme | app-wide store/context |
| **Server state** | fetched data | the server — the client holds a *cache* of it |
| **URL state** | current route, filters | the URL (shareable, bookmarkable) |

Server state is really a **cache of remote state**: it can be stale, so it wants revalidation
(TanStack Query/SWR), not hand-managed duplication.

## State in the backend

- **Request-scoped vs application-scoped.** A value should be request-scoped unless it *must*
  outlive the request. Application-scoped (globals/singletons) is where concurrency bugs live.
- **The database is the durable source of truth.** In-memory state is a cache or a working copy.
- **Stateless services scale; stateful ones don't (easily).** The twelve-factor approach: keep
  processes stateless, push state into backing services (DB, cache, queue) so you can run many
  identical instances.
- **Shared mutable state = concurrency hazard.** When two requests/threads touch the same state,
  you need locking/atomicity or you get races — prefer immutable values and single writers.

## Managing state well

- **Minimize it.** The less state, the fewer bugs. Prefer computation over stored memory.
- **Localize it.** Keep state as close as possible to where it's used; lift only when shared.
- **Own it.** Make it clear which component/service is responsible for each piece of state.
- **Bound its lifetime.** Reset/expire state explicitly (request ends, session expires, cache TTLs).
- **Make transitions explicit.** Model changes as operations (events/actions) rather than arbitrary
  field writes; state machines make illegal states unrepresentable.
- **Prefer immutability at the boundaries.** New values over in-place mutation make change detection
  and reasoning easy.

## Pitfalls

- **Hidden state.** Module globals, singletons, and memoized caches create state you didn't declare —
  the source of "it works until it doesn't".
- **Shared mutable state.** Two writers, no coordination → races and corruption.
- **Duplicated/derived state stored twice.** Inevitable drift between copies.
- **State that never resets.** Leaks across requests/users (caches that never expire, globals that
  accumulate).
- **Over-globalising.** Reaching for a global store when local state would do.

## One-line summary

**State is the data a program remembers over time — the memory that makes behavior depend on history
rather than just inputs — so it's both necessary and the main source of complexity; design it by
minimizing it, keeping one source of truth, localizing and bounding its lifetime, and confining
mutation so the rest of the system can stay stateless, testable, and easy to reason about.**

## References

- React — *State: A Component's Memory* — <https://react.dev/learn/state-a-components-memory>
- React — *Managing State* — <https://react.dev/learn/managing-state>
- Ben Moseley & Peter Marks — *Out of the Tar Pit* (2006) — state as the root of complexity — <https://curtclifton.net/papers/MoseleyMarks06a.pdf>
- The Twelve-Factor App — *Processes* (run stateless) — <https://12factor.net/processes>
- Erich Gamma et al. — *Design Patterns* (GoF), the **State** pattern
- Related: `01-pure-functions`, `04-value-objects`, `05-entities`, `07-aggregates`, `reactjs/03-useState`
