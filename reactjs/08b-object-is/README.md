# 8b. `Object.is` — the equality React actually uses

*`Object.is` is the `SameValue` equality check — `===` with two fixes. It's the comparison behind
React's "did this change?" decisions: when `useState` bails out, when a `useMemo`/`useEffect`
dependency is considered unchanged, and when a `memo()` component decides whether to re-render.*

Understanding `Object.is` explains a whole class of React gotchas: why setting the same value
doesn't re-render, and why **mutating** state silently does nothing.

## What it is

```js
Object.is(value1, value2); // → boolean
```

It compares two values and returns whether they are the **same value**, without any type
coercion. For almost every input it behaves exactly like `===`. It differs in exactly two cases.

| Expression | `===` | `Object.is` |
| --- | --- | --- |
| `Object.is(NaN, NaN)` | `false` | **`true`** |
| `Object.is(0, -0)` | `true` | **`false`** |
| `Object.is(1, 1)` | `true` | `true` |
| `Object.is("a", "a")` | `true` | `true` |
| `Object.is({}, {})` | `false` | `false` |
| `const o = {}; Object.is(o, o)` | `true` | `true` |

The two differences:

- **`NaN` equals itself.** With `===`, `NaN` is not equal to anything — including `NaN` — so
  `NaN === NaN` is `false`. `Object.is` treats `NaN` as the same value as `NaN`.
- **`+0` and `-0` are different.** With `===`, `0 === -0` is `true`. `Object.is` distinguishes
  them.

For **objects and arrays**, both operators compare the **reference**, not the contents. Two
distinct objects are never equal, and the *same* object is always equal — which is the fact that
makes the mutation pitfalls below possible.

```js
Object.is({ a: 1 }, { a: 1 }); // false — different references
const x = { a: 1 };
Object.is(x, x);               // true  — same reference
```

## Why React uses it

React needs a definition of "changed" that is *total* and *predictable*. `Object.is` fits: it
never throws on `NaN`, never surprises you by equating `0` and `-0`, and gives a clean
reference-based answer for objects. React uses it in three places you interact with constantly.

### 1. `useState` bails out when the value is unchanged

When you call a state setter, React compares the new value with the current one using
`Object.is`. If they're the same, React **skips re-rendering**:

```tsx
import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button
      onClick={() => {
        setCount(count); // Object.is(count, count) → true → no re-render
      }}
    >
      count: {count}
    </button>
  );
}
```

That "same value, no re-render" behavior is `Object.is` doing its job. (React may still render
that one component an extra time before bailing out, but it won't commit the update or render its
children.)

### 2. Hook dependency arrays

Every hook with a dependency array compares each entry with `Object.is` from the previous render.
An entry is "changed" only if `Object.is(prev, next)` is `false`:

```tsx
const options = { q: "" };

// Runs only when `options` is a NEW reference — Object.is(prev, next) === false.
useEffect(() => {
  search(options);
}, [options]);
```

This is why inline object/array literals in a dependency list cause the effect to re-run on every
render: a fresh literal is a new reference, so `Object.is` says it changed. It's also why
`useMemo` (topic 8) exists — to hand a hook a **stable** reference.

### 3. `React.memo` prop comparison

`memo()` compares the props of the previous and next render with `Object.is`, prop by prop
(shallow). A prop that "looks the same" but is a new object still counts as changed.

```tsx
import { memo } from "react";

const Row = memo(function Row({ item }: { item: { id: number } }) {
  return <li>{item.id}</li>;
});

// <Row item={{ id: 1 }} />   ← new object every render → never "equal" → always re-renders
// <Row item={stableItem} />  ← same reference → skipped
```

## The mutation pitfall

Because `Object.is` compares **references**, mutating an object or array in place leaves the
reference unchanged — so React sees "no change" and renders nothing.

```tsx
import { useState } from "react";

export function TodoList() {
  const [items, setItems] = useState<string[]>([]);

  function addWrong() {
    items.push("new");
    setItems(items); // Object.is(items, items) → true → no re-render!
  }

  function addRight() {
    setItems((prev) => [...prev, "new"]); // new array → different reference → re-renders
  }

  return (
    <div>
      <button onClick={addWrong}>add (wrong)</button>
      <button onClick={addRight}>add (right)</button>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
```

The fix is always the same: create a **new** value rather than mutating — `[...prev, x]`,
`{ ...prev, key: value }`, or `prev.map(...)`.

## Try it

Paste these into a browser console or any `.js` file:

```js
Object.is(NaN, NaN);          // true
NaN === NaN;                  // false

Object.is(0, -0);             // false
0 === -0;                     // true

Object.is({}, {});            // false  (distinct references)
const shared = {};
Object.is(shared, shared);    // true   (same reference)
```

## One-line summary

**`Object.is` is `===` except `NaN` equals itself and `+0`/`-0` differ; React uses it to decide
what "changed", so setting an equal value bails out and mutating an object/array in place looks
like no change at all — always produce a new reference.**

## References

- MDN — *`Object.is()`* — <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is>
- ECMAScript — *SameValue (`Object.is`) vs SameValueZero (`Array.prototype.includes`)* — <https://tc39.es/ecma262/#sec-samevalue>
- React — *`useState` — "React will skip re-rendering… if the new value is identical"* — <https://react.dev/reference/react/useState>
- React — *`memo` reference (shallow prop comparison)* — <https://react.dev/reference/react/memo>
- Related: `03-useState`, `08-memoization`
