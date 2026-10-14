# Pure vs impure functions

*A **pure function** returns the same output for the same input and does nothing else. An
**impure** one reaches out into the world — reads the clock, writes a file, mutates a shared
object, calls the network. Almost every practical system needs both; good design is about knowing
which is which and pushing the impurity to the edges.*

This is language-agnostic. The examples lean on JavaScript/TypeScript because that's what this
repo is built on, but the ideas apply to any stack — frontend, backend, or a data pipeline.

## The two rules

A function is **pure** if:

1. **Deterministic** — the same arguments always produce the same result. No reading the clock,
   no randomness, no global/config state that can drift.
2. **No side effects** — calling it changes nothing observable outside its own return value. No
   mutation of its arguments or of shared state, no I/O, no logging, no network, no DOM.

Anything that breaks either rule is **impure**.

| | Pure | Impure |
| --- | --- | --- |
| Same input | always same output | can differ each call |
| Side effects | none | logs, writes, mutates, fetches… |
| Depends on | only its arguments | clock, RNG, globals, env, DB, network, OS |
| Testability | assert input → output, no mocks | needs fakes/mocks for the outside world |
| Safe to cache? | yes (memoize, reorder, parallelize) | not without care |
| Examples | `add`, `normalize`, `map`, `formatDate(x, locale)` | `saveUser`, `log`, `Date.now`, `Math.random` |

A pure function is a **value in, value out** machine. An impure one is an **action** — it has
effects.

## Pure

```ts
function add(a: number, b: number): number {
  return a + b;
}

type User = { first: string; last: string };

// Same input → same output; touches nothing else.
function fullName(user: User): string {
  return `${user.first} ${user.last}`;
}
```

## Impure

Each of these breaks a rule:

```ts
let total = 0;

function addToTotal(n: number): void {
  total += n;          // mutates shared state
  console.log(total);  // I/O
}

function makeId(): string {
  return Math.random().toString(36).slice(2); // randomness → different every call
}

function nowLabel(): string {
  return new Date().toISOString();            // reads the clock
}

function pushItem(items: string[], item: string): string[] {
  items.push(item);    // mutates its argument
  return items;
}
```

## Where the impurities come from

The usual suspects, and the habit that tames each:

| Impure source | Instead, inject it |
| --- | --- |
| `Date.now()` / `new Date()` | pass `now: number` as a parameter |
| `Math.random()` / UUIDs | pass an `rng: () => number` or `id: string` |
| `fetch` / HTTP client | pass the client in |
| Database / file system | pass a repository/repo interface |
| `console.log` / logger | pass a logger, or log at the boundary |
| Env vars / config / globals | pass values in explicitly |
| Mutating a shared object | return a new value |

Passing these in (dependency injection) doesn't remove the side effect — someone still has to do
it — but it moves it to a **seam** where the function's core logic stays pure and testable.

## Why it matters

- **Reasoning.** A pure function is fully described by its signature. You can understand it
  without knowing the rest of the program.
- **Testing.** Pure functions need no mocks, no setup, no teardown — just input and expected
  output. Impure code needs fakes for the clock, network, and DB.
- **Caching & memoization.** Same input → same output means a result can be cached, deduped, or
  recomputed freely. (This is exactly what React's `useMemo` and a query cache rely on.)
- **Concurrency.** No shared mutable state means no data races when code runs in parallel.
- **Refactoring & reuse.** You can move, rename, reorder, or run a pure function anywhere without
  worrying about what it touched.
- **Retries & idempotency** (backend). A pure transform can be retried safely; an impure action
  can't, unless it's made idempotent.

## Frontend: render must be pure

React (and most UI frameworks) assume **rendering is pure**: given the same props and state, a
component returns the same UI and touches nothing outside itself. That's what lets React call it
extra times, run it in parallel, or in development invoke it twice (`StrictMode`).

```tsx
// Pure render: props in, JSX out. Safe to call repeatedly.
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}</h1>;
}
```

```tsx
// Impure render: mutates the outside world while rendering.
let renders = 0;

function BadGreeting({ name }: { name: string }) {
  renders += 1;                        // side effect during render
  document.title = `Hello ${name}`;    // DOM mutation during render
  return <h1>Hello, {name}</h1>;
}
```

The fix is not to make the component pure by removing the behavior, but to **move the effect to
where effects belong** — an event handler for user actions, or an effect for synchronization:

```tsx
function Greeting({ name }: { name: string }) {
  useEffect(() => {
    document.title = `Hello ${name}`; // effect: runs after render, not during
  }, [name]);
  return <h1>Hello, {name}</h1>;
}
```

## Backend: handlers are shells around a pure core

A request handler is inherently impure — it reads a request, writes to a DB, returns a response.
The trick is to keep the *decision* pure and the *doing* at the edges: **functional core,
imperative shell**.

```ts
// --- pure core: parse, validate, transform. No I/O. ---

type OrderRow = { id: string; qty: number; unitPrice: number };
type OrderDto = { id: string; total: number };

function toOrderDto(row: OrderRow): OrderDto {
  return { id: row.id, total: row.qty * row.unitPrice };
}

function isValidQty(qty: number): boolean {
  return Number.isInteger(qty) && qty > 0;
}

// --- impure shell: the boundary that touches the world. ---

async function createOrder(req: Request, deps: { db: Db; logger: Logger }) {
  const row = (await req.json()) as OrderRow;

  if (!isValidQty(row.qty)) {
    return Response.json({ error: "invalid quantity" }, { status: 400 });
  }

  const dto = toOrderDto(row);          // pure
  await deps.db.insert("orders", dto);  // side effect
  deps.logger.info("order created", dto); // side effect
  return Response.json(dto, { status: 201 });
}
```

`toOrderDto` and `isValidQty` are trivial to test. `createOrder` has all the impure parts in one
readable place, with the outside world injected (so tests can pass a fake `db`/`logger`).

## The pattern: functional core, imperative shell

The recurring move across FE, BE, and general engineering:

```
        ┌──────────────────────────────────────────┐
        │            imperative shell              │
        │   parse input · call effects · log · I/O │
        │                                          │
        │      ┌────────────────────────────┐      │
        │      │       pure core            │      │
        │      │  decisions · transforms    │      │
        │      │  validation · formatting   │      │
        │      └────────────────────────────┘      │
        └──────────────────────────────────────────┘
```

Push logic inward (pure, easy to test and reuse); keep effects at the thin outer ring. You'll
still *have* side effects — you just won't have them scattered through your business rules.

## Practical guidance

- **Don't chase 100% purity.** A program with no side effects does nothing. The goal is to
  *isolate* impurity, not eliminate it.
- **Return, don't mutate.** Prefer returning a new value over mutating a parameter or shared
  state.
- **Inject the volatile inputs** — clock, RNG, config, clients — so the core stays deterministic.
- **Test the core directly; fake the edges.** If a function is hard to test without mocks, that's
  a signal its pure core is tangled with its effects.
- **Pure by default, impure on purpose.** When you write an impure function, make the effect
  obvious (a verb name: `save`, `send`, `log`) and keep it small.

## One-line summary

**A pure function is deterministic and side-effect-free — same input, same output, nothing else
touched — which makes it easy to reason about, test, cache, and parallelize; real systems are
impure, so keep the decisions pure and push the effects (I/O, time, randomness, mutation) to a
thin, explicitly impure shell at the edges.**

## References

- Wikipedia — *Pure function* — <https://en.wikipedia.org/wiki/Pure_function>
- React — *Keeping Components Pure* — <https://react.dev/learn/keeping-components-pure>
- Gary Bernhardt — *Functional Core, Imperative Shell* (Destroy All Software) — <https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell>
- Mark Seemann — *From dependency injection to dependency rejection* — <https://blog.ploeh.dk/2017/01/27/from-dependency-injection-to-dependency-rejection/>
- MDN — *`Math.random()`* (nondeterminism example) — <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random>
