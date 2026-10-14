# 0. What is React, and why do we need it?

*Before writing a single component, answer the real question: what problem does React solve,
and what is it actually made of?* (For why it's classified as a **library** — and how that
differs from a **framework** — see `00b-library-vs-framework`.)

This dir is the "why" that makes the rest of the roadmap make sense. Every later topic —
JSX, state, hooks, reconciliation, RSC — is a consequence of the design decisions here.

## The problem: the DOM is imperative and the UI is a function of state

The browser gives you an **imperative** API. You tell it *how* to change the page, one step at
a time:

```js
const el = document.getElementById("count");
el.textContent = String(n);          // you pick the node...
el.classList.toggle("active", n > 0); // ...and do every mutation by hand
```

That works for one counter. It stops working for a real app, because the UI is really a
**pure function of state**:

```
UI = f(state)
```

But the DOM has no `f`. You have to keep two things in sync *by hand*: your application state
and the actual nodes on screen. Every new feature adds coordinates to the blast radius —

- **Which** nodes need to change when state changes?
- **In what order**, so you never leave the DOM in a half-updated state?
- What about **lists** where items were inserted/removed/reordered?
- What about state that lives in **three places** (component, DOM, server)?

Humans are bad at this. Bugs from missed mutations — stale values, detached nodes, event
listeners pointing at the wrong element — are the classic jQuery-era failure mode. The bigger
the app, the worse it gets, **quadratically** (each feature must know about the others).

## What React is

React is a **JavaScript library for building user interfaces**, built around one idea: *you
describe what the UI should look like for a given state, and React figures out how to make the
DOM match.*

- **Declarative, not imperative.** You write the destination (`if state is X, render this`),
  not the route. React does the DOM surgery.
- **Component-based.** A UI is a tree of small, reusable, composable functions that each
  return a piece of the description.
- **`UI = f(state)`.** Rendering is a pure function of props + state. Same inputs → same
  output description. No hidden mutation to reason about.

```jsx
// Declarative: "for this state, the UI looks like this."
// React reconciles the real DOM to match — you never call document.*
function Counter({ count }) {
  return <button className={count > 0 ? "active" : ""}>Count: {count}</button>;
}
```

The mental shift is that **you stop mutating the screen**. You update *state* and re-describe
the UI; React computes the minimal set of DOM operations to get there (the reconciler — see
`01-rendering-model`).

```
   imperative (jQuery)                  declarative (React)
   ────────────────────                 ────────────────────
   state ──┐                            state ──► f(state) ──► description of UI
           │ you enumerate every                              │
           │ mutation by hand                                 │ React diffs &
           ▼                                                  ▼ applies DOM ops
        ┌──────┐                                            ┌──────┐
        │ DOM  │                                            │ DOM  │
        └──────┘                                            └──────┘
   "you say HOW"                        "you say WHAT; React says HOW"
```

## Why we need it (the four things it buys you)

1. **You stop hand-syncing state and DOM.** The stated goal per [react.dev](https://react.dev/learn)
   is to let you build apps where *"you don't need to manipulate the DOM at all"* — you change
   state, the UI follows.
2. **Composition scales.** Small components that own their own logic compose into pages, and
   pages into apps, without each feature knowing about all the others. This is the answer to
   the quadratic-blast-radius problem.
3. **A single, testable data flow.** Data flows **down** as props; changes flow **up** via
   callbacks. Debugging becomes "what was the state at render?" instead of "which listener
   mutated which node?"
4. **It's just JavaScript.** Components are functions. Logic, not templates, describes the UI —
   so you can use `map`, `if`, and type it end to end with TypeScript.

React is not required for any of this, but it packages the whole bundle — declarative
rendering, components, reconciliation — behind one small conceptual model.

> **Is React a library or a framework?** That's a separate idea with its own test (inversion
> of control). See `00b-library-vs-framework`.

## One-line summary

**React is a JavaScript library for building UIs declaratively — you describe `UI = f(state)`
as a tree of components, and React reconciles the DOM for you instead of you mutating it by
hand.**

## References

- React — *Learn: Describing the UI / Adding Interactivity* — <https://react.dev/learn>
- React — *Thinking in React* — <https://react.dev/learn/thinking-in-react>
- React — *Your UI as a Tree* — <https://react.dev/learn/understanding-your-ui-as-a-tree>
- React 19 release notes — <https://react.dev/blog/2024/12/05/react-19>
- MDN — *DOM introduction (imperative APIs)* — <https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Introduction>
- Related: `00b-library-vs-framework`, `01-rendering-model`
