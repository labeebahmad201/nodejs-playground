# 8. Memoization — `useMemo`

`useMemo` *caches the result of a calculation between renders, recomputing it only when its dependencies change. It buys you two things: **not repeating expensive work** and **stable value identity** for values that other hooks or* `memo()` *components compare by reference.*

All the examples below are complete and drop-in — see [Trying the examples](#trying-the-examples)for the two-line way to run them.

## The problem it solves

A component is just a function, and React calls it **again on every render** (that's `UI = f(state)` — see `00-why-react`). That's usually fine: rendering is cheap and React is designed to re-run components often. But some things you compute *during* render are **not** cheap:

- filtering/sorting a large list,
- parsing or transforming data,
- deriving a big object from props.

If an unrelated state change (`theme`, a counter, a toggle) triggers a re-render, the expensive line runs again — for a result that hasn't changed. `useMemo` lets React skip that work.

## What `useMemo` is

```jsx
import { useMemo } from "react";

const cached = useMemo(calculateValue, dependencies);
```

- `calculateValue` is a **pure** function that returns the value you want to cache.
- `dependencies` is an array of every reactive value `calculateValue` reads.
- React runs `calculateValue` **during render** and returns its result. On the **next** render it compares each dependency with `Object.is`; if they're all the same, it hands back the **cached**result instead of recomputing.

```
render #1  useMemo(calc, [a])  → calc() runs          → valueA (cached)
  a unchanged
render #2  useMemo(calc, [a])  → cache hit            → valueA
  a changes
render #3  useMemo(calc, [a])  → calc() runs again    → valueB (cached)
```

Edge cases worth knowing:

- `useMemo(fn, [])` computes **once** per mount (an empty dependency list never changes).
- Omitting the array entirely recomputes on **every** render — pointless for memoization.
- The cache is **per component instance**, not global, and React is allowed to **throw it away**(e.g. to free memory). Treat `useMemo` as a performance hint, never as a correctness guarantee.

## The two jobs of `useMemo`

### 1. Skip expensive computation between renders

Toggling the theme re-renders `PrimeCounter`, but `n` hasn't changed, so the prime is read from the cache instead of recomputed:

```tsx
import { useMemo, useState } from "react";

function isPrime(x: number): boolean {
  if (x < 2) return false;
  for (let i = 2; i * i <= x; i++) if (x % i === 0) return false;
  return true;
}

function nthPrime(n: number): number {
  let found = 0;
  let candidate = 1;
  while (found < n) {
    candidate += 1;
    if (isPrime(candidate)) found += 1;
  }
  return candidate;
}

export function PrimeCounter() {
  const [n, setN] = useState(30_000);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Recomputed only when `n` changes. Toggling the theme still re-renders
  // this component, but the heavy work is skipped — no lag.
  const prime = useMemo(() => nthPrime(n), [n]);

  return (
    <div>
      <input
        type="number"
        value={n}
        min={1}
        onChange={(e) => setN(Number(e.target.value))}
      />
      <button onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}>
        theme: {theme}
      </button>
      <p>The {n.toLocaleString()}th prime is {prime.toLocaleString()}</p>
    </div>
  );
}
```

Delete the `useMemo` wrapper (`const prime = nthPrime(n);`) and every theme toggle now recomputes the prime — that's the lag you're feeling.

### 2. Filtering a big list

The canonical case: an expensive **derived value** that should only change when its real input changes.

```tsx
import { useMemo, useState } from "react";

const ITEMS = Array.from({ length: 4000 }, (_, i) => `item-${i}`);

function slowFilter(items: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    for (let i = 0; i < 3000; i++) Math.sqrt(i); // simulate expensive work
    return q === "" || item.includes(q);
  });
}

export function SearchableList() {
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(false);

  // Only re-filter when `query` changes — not when `dark` flips.
  const results = useMemo(() => slowFilter(ITEMS, query), [query]);

  return (
    <div data-theme={dark ? "dark" : "light"}>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <button onClick={() => setDark((d) => !d)}>dark: {String(dark)}</button>
      <p>{results.length} of {ITEMS.length} match</p>
      <ul>
        {results.slice(0, 10).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
```

### 3. Keep a stable reference

Object and array *literals* create a **new reference on every render**. That matters when the value is a prop to a `memo()` component or a dependency of another hook — a new reference looks like a change.

```tsx
import { memo, useMemo, useState } from "react";

type Config = { label: string };

// Re-renders only when `config` changes by reference.
const Child = memo(function Child({ config }: { config: Config }) {
  return <p>config.label = {config.label}</p>;
});

export function Parent() {
  const [count, setCount] = useState(0);
  const [theme, setTheme] = useState("light");

  // Stable while `count` is unchanged, so `memo(Child)` skips re-rendering.
  const config = useMemo<Config>(() => ({ label: `user-${count}` }), [count]);

  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>count: {count}</button>
      <button onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}>
        theme: {theme}
      </button>
      <Child config={config} />
    </div>
  );
}
```

Swap the memoized line for a plain literal and the benefit disappears — a fresh object every render defeats `memo(Child)`:

```tsx
// New object every render → the child re-renders even when only `theme` changed.
const config: Config = { label: `user-${count}` };
```

## What `useMemo` is **not**

- **Not for side effects.** `calculateValue` must be pure. Effects, subscriptions, DOM writes, and logging belong in event handlers or `useEffect`. (Logging *inside* the calculation to show recomputation is a common debugging trick, but it makes the callback impure — don't ship it.)
- **Not** `React.memo`**.** `useMemo` caches a **value** inside one component. `React.memo` is a wrapper that skips re-rendering a **component** when its props are unchanged. Example 3 uses both together: `useMemo` produces the stable prop that `React.memo` compares.
- **Not a guarantee.** React may discard the cache; don't rely on `useMemo` for correctness.

## When **not** to use it

Memoizing is not free — it costs a little memory and a dependency comparison on every render, and it adds noise. Reach for `useMemo` only when you have a measured reason:

1. the calculation is **demonstrably expensive**, or
2. you **need a stable reference** for a `memo()` child or another hook's dependency array.

Otherwise compute it inline. And note the **React Compiler**: it can insert memoization automatically, which removes most of the manual `useMemo`/`useCallback`/`memo` busywork in compiler-enabled codebases. The concept is still worth understanding — it's what the compiler is doing under the hood, and you'll still meet it in code that predates the compiler.

## Trying the examples

Copy any component into a React project. The quickest scaffold:

```bash
npm create vite@latest usememo-demo -- --template react-ts
cd usememo-demo
npm install
npm run dev
```

Drop the snippet into `src/App.tsx`, save, and interact with it in the browser.

## One-line summary

`useMemo(calculateValue, deps)` **caches a value across renders and recomputes it only when a dependency changes (**`Object.is`**); use it to skip genuinely expensive work and to keep references stable for** `memo()` **children — not as a correctness tool, and not for side effects.**

## References

- React — `useMemo` *reference* — <https://react.dev/reference/react/useMemo>
- React — *You Might Not Need an Effect* — <https://react.dev/learn/you-might-not-need-an-effect>
- React — *React Compiler* — <https://react.dev/learn/react-compiler>
- React — `memo` *reference* — <https://react.dev/reference/react/memo>
- Related: `03-useState`, `06-effects`, `07-refs`, `09-custom-hooks`