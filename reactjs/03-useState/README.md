# 3. useState — a component's memory

*`useState` is the hook that turns a static function component into an interactive one. It
gives a component **memory** that survives re-renders, and updating it is what tells React
"re-render this component." This dir covers what it is, why function components need it, and
the handful of rules that keep it predictable.*

Source video: **"Learn React Hooks: useState — Simply Explained!"** (Cosden Solutions, *Learn
React Hooks* series) — <https://youtu.be/V9i3cGD-mts>.

## First, what is "state"?

**State is the data a component remembers between renders, which — when it changes — makes the
component re-render.** It's the "memory" half of `UI = f(state)`: the UI is derived from state,
so changing state is how you change the UI.

Concretely, state is anything a component needs to hold onto over time that isn't passed in from
above: a counter's value, whether a menu is open, the current text in an input, a list of items
being edited. Contrast it with **props**:

| | Props | State |
| --- | --- | --- |
| Comes from | the parent (passed in) | the component itself |
| Controlled by | the parent | the component |
| Mutable by this component? | No — **read-only** | Yes — via its setter |
| Changing it causes? | parent to re-render (you get new props) | this component to re-render |

Two properties matter most:

- **State is a source of truth.** You don't change the DOM directly; you change state and
  re-render (see `00-why-react`). Anything derivable from state should be **computed**, not
  stored again.
- **State is a snapshot.** For a given render, the value is fixed. Setting it asks for the *next*
  render — it doesn't mutate the current one. (Fleshed out under "State is a snapshot" below.)

## The problem: function components forget

A component is just a function, and React calls it **again on every render**. That's the whole
trick from `00-why-react` (`UI = f(state)`) — but it has a sharp edge: **local variables are
recreated on every call.**

```jsx
function Counter() {
  let count = 0;             // reset to 0 on every render
  return <button onClick={() => count++}>Count: {count}</button>;
}
```

Clicking does nothing visible: `count++` mutates a local that vanishes when the function
returns, and nothing tells React to render again. The component has no **memory** and no way to
ask for a re-render. `useState` supplies both.

## What `useState` is

`useState` is a **Hook** — a function that lets a function component "hook into" React
features. It declares a piece of state that React stores **outside** the component, keyed to
that component instance, so it persists across renders.

```jsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0); // declare state, initial value 0

  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}
```

A few things are happening at once:

- It returns a **pair**: `[value, setter]`. `value` is the current state read *for this render*;
  `setter` is a function that updates it and schedules a re-render. The names are your choice
  (convention: `[thing, setThing]`).
- The argument is the **initial value**, used only on the **first** render.
- Calling the setter does **not** mutate `count` in place — it asks React to re-render with the
  new value. On the next render, the component runs again and `useState` hands back the new
  value.

```
render #1:  useState(0) → [0, setCount]      UI shows 0
 click → setCount(1)
render #2:  useState(0) → [1, setCount]      UI shows 1   (initial arg ignored after first render)
 click → setCount(2)
render #3:  useState(0) → [2, setCount]      UI shows 2
```

## Why we need it

Without it, a function component could only render props → static UI. `useState` is what makes
components **stateful and interactive** while staying plain functions:

1. **Memory across renders.** State lives in React, not in the discarded function scope.
2. **Re-rendering on change.** The setter is the signal that `state` changed and the UI must be
   recomputed.
3. **Isolation per instance.** Each mounted component gets its **own** state. Two `<Counter />`s
   don't share a count.
4. **Local by default.** State belongs to the component that declared it; to share, you *lift*
   it or move it into context (topics 3b / 10).

## State is a snapshot, not a live variable

This is the mental model that prevents most bugs: **the `value` returned is captured for the
current render and never changes during it.** Reading it inside a callback (like `onClick`)
gives you the value from the render that created that callback.

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1); // `count` is the value from THIS render's snapshot
    setCount(count + 1); // same snapshot → still count + 1, not count + 2
    console.log(count);  // logs the old value — state updates are async + batched
  }

  return <button onClick={handleClick}>Count: {count}</button>;
}
```

To update based on the **previous** state, pass a **functional updater** — React feeds it the
freshest value:

```jsx
setCount((c) => c + 1); // "increment whatever the latest value is"
setCount((c) => c + 1); // both apply → +2
```

The same snapshot rule explains why logging `count` right after `setCount` shows the old value:
the re-render (and the new state) happens *after* the event handler finishes.

## Rules that keep it predictable

- **Never mutate state directly.** React compares with `Object.is`; mutating an array/object
  keeps the same reference, so nothing re-renders. Create a **new** value instead:

  ```jsx
  const [items, setItems] = useState([]);
  // items.push(x);                 // wrong: same reference, no re-render
  setItems([...items, x]);          // right: a new array
  setItems((prev) => [...prev, x]); // right: functional updater
  ```

- **Hooks go at the top level.** Call `useState` (and every hook) unconditionally at the top of
  the component — never inside loops, conditions, or nested functions. React matches hooks to
  state **by call order**, so the order must be identical on every render.
- **Initial value is only for the first render.** Passing a new prop next render won't "reset"
  state; to recompute an expensive initial value once, use a **lazy initializer**:
  `useState(() => expensiveCompute())`.
- **`key` resets state.** Changing a component's `key` unmounts and remounts it, throwing away
  its state (see topic 4 for how `key` also drives list reconciliation).
- **Don't store what you can compute.** Derived values (e.g. `fullName` from `first`/`last`, or
  filtered lists) should be calculated during render, not held in extra state that can drift.

## Choosing initial state & when to lift

- Prefer the **smallest** state that captures what changes; derive the rest.
- If two components must agree on a value, **lift** the state to their closest common parent
  and pass it down as props with a setter callback (`03b-state-events`).
- If many distant components need it, that's a job for **context**/a store (topic 10), not
  prop drilling.

## One-line summary

**`useState` gives a function component memory that survives re-renders and a setter that
schedules a re-render; the value is a per-render snapshot, so update with a functional updater
when depending on the previous value, never mutate state in place, and always call hooks at the
top level in a stable order.**

## References

- React — *State: A Component's Memory* — <https://react.dev/learn/state-a-components-memory>
- React — *`useState` reference* — <https://react.dev/reference/react/useState>
- React — *Updating state / snapshot & batching (Queueing a Series of State Updates)* — <https://react.dev/learn/queueing-a-series-of-state-updates>
- React — *Updating objects / arrays in state* — <https://react.dev/learn/updating-objects-in-state>, <https://react.dev/learn/updating-arrays-in-state>
- React — *Rules of Hooks* — <https://react.dev/reference/rules/rules-of-hooks>
- React — *You Might Not Need an Effect* (derived state) — <https://react.dev/learn/you-might-not-need-an-effect>
- Video — *Learn React Hooks: useState — Simply Explained!* (Cosden Solutions) — <https://youtu.be/V9i3cGD-mts>
- Related: `00-why-react`, `03b-state-events`, `04-lists`, `10-state-architecture`
