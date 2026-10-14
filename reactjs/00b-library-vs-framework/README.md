# 0b. Library vs framework — the inversion-of-control test

*React is called a **library**, not a **framework**. That word choice is not pedantry — it
tells you exactly who owns your app's flow. This dir isolates that one idea: what actually
separates a library from a framework, why React is the former, and why the ecosystem around it
nevertheless feels like the latter.*

Separated from `00-why-react` because it's a **different concept**: that dir is about *what
React is and why it exists*; this one is about *how to classify it* — a distinction that
applies to every tool you'll meet (React Router, Next.js, TanStack Query), not just React.

## The distinction is inversion of control, not size

People reach for "library = small, framework = big" or "framework = has more features." Both
are wrong. The real test is **who calls whom** — *inversion of control* (IoC), a.k.a. the
**"Hollywood principle": don't call us, we'll call you.**

- **A library** is a set of functions **you call**. You are in control of the flow; you decide
  when and where to invoke it.
- **A framework** is a program that **calls your code**. It owns the flow and the lifecycle;
  you fill in the blanks it defines. The framework runs *you*.

```
   LIBRARY (you are in charge)              FRAMEWORK (it is in charge)
   ───────────────────────────             ───────────────────────────
   your code ──► import { render } ──►     framework ──► calls your handlers,
   you decide WHEN to call it                              renders your components,
                                                           runs your routes/lifecycle
   "I call the library"                    "the framework calls me"
```

The word *inversion* is the key: in a framework, control is **inverted** relative to a normal
library — the framework is at the top of the call stack and your code is the subroutine.

## React fits the library shape

You call React yourself:

```jsx
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")).render(<App />);
```

React does not know your routes, your data layer, or your build; it does not boot your app. It
hands you a way to describe UI plus a reconciler, and steps out of the way. The entry point —
the `index.html`, the mount call — is **yours**. That's the tell: when *you* supply the entry
point, you're calling a library.

## The telling test

Look at what React *doesn't* decide for you:

| Concern | Does React decide? | Who does |
| --- | --- | --- |
| Rendering & reconciliation | **Yes** | React |
| Component model & props | **Yes** | React |
| Routing / URLs | No | React Router, TanStack Router |
| Data fetching & caching | No | TanStack Query, SWR, `fetch` |
| Global state | No | Context/`useReducer`, Redux, Zustand, Jotai |
| Forms & validation | No | React Hook Form + Zod |
| Build tooling | No | Vite, Next.js |
| `index.html` boot & mount | No | **you** |

When you must assemble the entry point, the router, the data layer, and the server story
yourself, you're using a **library**. A framework would have made those decisions for you and
called your code from them.

## But the ecosystem feels like a framework

Here's the honest nuance: **"library vs framework" is a spectrum, and React sits near the
"library" end — but the ecosystem wraps it into framework-like shapes.**

- **Meta-frameworks** (Next.js, React Router v7, TanStack Start) *are* frameworks. They own
  routing, data loading, and the rendering mode (SSR/RSC), and they call your components. They
  are frameworks **built on top of** the React library.
- **Convention stacks** (Vite + Router + Query, and historically CRA) are frameworks in
  practice even when no single file owns the flow.
- React itself stays a library: even inside Next.js, the thing you `import` and write
  components against is the library, and the meta-framework orchestrates it.

So the precise statement is: **React is a library; the things you usually adopt alongside it
are frameworks that use it.** Knowing which layer decides what (the table above) keeps the
mental model clean — and is exactly why later tracks separate "React" from "Next.js".

## One-line summary

**Library vs framework is about inversion of control, not size: you call a library, a framework
calls you. React is a library — you boot the app and assemble the rest; the meta-frameworks you
add later are the frameworks that call it.**

## References

- Martin Fowler — *Inversion of Control* — <https://martinfowler.com/bliki/InversionOfControl.html>
- Martin Fowler — *Inversion of Control Containers and the Dependency Injection pattern* — <https://martinfowler.com/articles/injection.html>
- React docs — *Start a New React Project* (why an app wants "a framework", while React stays a library) — <https://react.dev/learn/start-a-new-react-project>
- React docs — *Adding React to an Existing Project* (you call `createRoot`) — <https://react.dev/learn/add-react-to-an-existing-project>
- MDN — *Introduction to client-side frameworks* (library vs framework) — <https://developer.mozilla.org/en-US/docs/Learn/Tools_and_testing/Client-side_JavaScript_frameworks/Introduction>
- Related: `00-why-react`, `21-nextjs`, `24-meta-framework-landscape`
