# React Roadmap

Living list of React topics to build and document. Each topic gets a runnable example in its own numbered directory (`reactjs/{n}-{name}`) with a `README.md`.

Status: `[ ]` not started · `[~]` in progress · `[x]` done

## Guiding principles

1. **Build, don't just read.** Every topic gets a runnable example under `reactjs/{n}-{name}`where possible, with a `README.md` (what it shows, how to run, real output, citations).
2. **Reproduce → measure → cite.** Real numbers and authoritative sources; no content copied from docs.
3. **TypeScript everywhere.** End-to-end types from the API to the component — the schema is the contract.
4. **Server-aware.** Always know what renders on the client vs the server (SSR / RSC).
5. **Vertical slices over breadth.** One end-to-end app (build → fetch → render → ship → observe) beats a wide checklist of unconnected notes.

## Prerequisites

JS fundamentals (closures, `this`, array methods, promises, modules) and TypeScript basics (types, generics, unions).

---

## Track 0 — Orientation

- [x] **0. What is React & why we need it** — the problem (imperative DOM vs `UI = f(state)`) and what React is. Example dir: `reactjs/00-why-react`.

- [x] **0b. Library vs framework** — inversion of control ("Hollywood principle"), why React is a library, and why the ecosystem still feels like a framework. Example dir: `reactjs/00b-library-vs-framework`.

## Track 1 — React foundations

- [ ] **1. Rendering model** — elements vs components; what JSX compiles to; virtual DOM; reconciliation and `key` semantics; render phase vs commit phase. Example dir: `reactjs/01-rendering-model`.

- [ ] **2. Components, props & composition** — function components, `children`/slots, composition over inheritance, prop drilling and when it hurts. Example dir: `reactjs/02-composition`. *See Backlog: Rojo's "Composition Is All You Need".*

- [x] **3. `useState`** — a component's memory: the `[value, setter]` pair, snapshots per render, functional updaters, never mutate state, lazy initializer, rules of hooks. Example dir: `reactjs/03-useState`.

- [ ] **3b. State & events** — automatic batching, event handling, lifting state, derived vs stored state (don't store what you can compute). Example dir: `reactjs/03b-state-events`.

- [ ] **4. Lists & conditional rendering** — why `key` matters, reconciliation pitfalls, `&&`/ternary gotchas, rendering large lists. Example dir: `reactjs/04-lists`.

- [ ] **5. Forms** — controlled vs uncontrolled, refs, validation, and React 19 form actions (`useActionState`, `useFormStatus`, `useOptimistic`). Example dir: `reactjs/05-forms`.

## Track 2 — Hooks

- [ ] **6.** `useEffect` **& lifecycle** — dependency array, cleanup, StrictMode double-invoke, effects vs event handlers, "you might not need an effect". Example dir: `reactjs/06-effects`.

- [ ] **7. Refs & the DOM** — `useRef`, direct DOM access, `ref` as a prop (React 19), `useImperativeHandle`, ref cleanup. Example dir: `reactjs/07-refs`.

- [ ] **8. Memoization** — `useMemo`, `useCallback`, `React.memo`; when **not** to optimize; how the **React Compiler** changes the calculus. Example dir: `reactjs/08-memoization`.

- [ ] **9. Custom hooks** — rules of hooks, extracting reusable logic, testing hooks. Example dir: `reactjs/09-custom-hooks`.

- [ ] **10. Context & state architecture** — `Context` + `useReducer`; server state vs client state; Redux / Zustand / Jotai; why server state wants a cache (TanStack Query). Example dir: `reactjs/10-state-architecture`.

- [ ] **11. Concurrent features** — `Suspense`, `useTransition`, `useDeferredValue`, `useId`; urgent vs transition updates; the `use` hook. Example dir: `reactjs/11-concurrent`.

## Track 3 — TypeScript with React

- [ ] **12. Typing components** — props, `children`, event types, the `React.FC` debate, discriminated-union props, generic components.

- [ ] **13. Typing hooks & context** — generic hooks, reducer action unions, context defaults and the "no default" pattern.

## Track 4 — Tooling & build

- [ ] **14. Vite & bundling** — dev server, HMR, production build, code splitting, tree shaking, bundle analysis. Example dir: `reactjs/14-vite`.

- [ ] **15. Linting & formatting** — ESLint (`eslint-plugin-react-hooks`, `react-refresh`), Prettier, strict TS, editor setup.

- [ ] **16. Styling** — CSS Modules, Tailwind, CSS-in-JS tradeoffs, design tokens.

## Track 5 — Data, routing & APIs

- [ ] **17. Routing** — React Router (framework / data mode), nested routes, loaders & actions.

- [ ] **18. Data fetching & caching** — TanStack Query / SWR: loading/error/empty states, caching, invalidation, optimistic updates.

- [ ] **19. Forms & validation** — React Hook Form + Zod; a typed schema as the contract.

- [ ] **20. Talking to a backend** — CORS, cookies/credentials, auth (session vs JWT), `fetch`keep-alive, error handling. Example dir: `reactjs/20-api-integration`.

## Track 6 — Frameworks, SSR & RSC

- [ ] **21. Next.js (App Router)** — file-based routing, layouts, route handlers, SSR/SSG/ISR, caching layers. Example dir: `reactjs/21-nextjs`.

- [ ] **22. React Server Components** — the server/client boundary, `"use client"` / `"use server"`, what can cross the wire, data access from the server.

- [ ] **23. Streaming SSR & hydration** — `renderToPipeableStream`, Suspense on the server, progressive hydration, hydration mismatches.

- [ ] **24. Meta-framework landscape** — Next.js vs React Router v7 vs Astro vs TanStack Start; when a plain SPA is the right call.

## Track 7 — Quality & performance

- [ ] **25. Testing** — Vitest + React Testing Library; test behavior, not implementation; MSW to fake the API.

- [ ] **26. Performance** — React DevTools profiler, finding re-render causes, `memo`, virtualization, bundle size, **Core Web Vitals**.

- [ ] **27. Accessibility** — semantic HTML, ARIA, keyboard navigation, focus management, automated a11y checks.

## Track 8 — Shipping

- [ ] **28. Build & deploy** — static hosting vs a server runtime; containerize the front end; CDN vs origin; build-time vs runtime env config.

- [ ] **29. Observability** — client error tracking (Sentry), web vitals / RUM.

- [ ] **30. Security** — XSS and `dangerouslySetInnerHTML`, CSP, where to store tokens, CSRF with cookie-based sessions.

---

## Vertical slices (example projects)

End-to-end examples that tie a whole track together. One directory each, with a `README.md`.

- [ ] **Slice 1 — "Full-stack, typed end to end."** A Vite + React + TS front end over a typed API, sharing Zod schemas, fetching with TanStack Query, tested with Vitest + RTL, then built and served. *Covers Tracks 1–5, 7.*

- [ ] **Slice 2 — "SSR / RSC."** The same data via Next.js App Router with React Server Components and streaming, compared side by side with the SPA. *Covers Track 6.*

- [ ] **Slice 3 — "Observe the front end."** Sentry + Core Web Vitals so one request is traceable across client and server. *Covers Track 8.*

## Backlog — to watch & investigate

Things to review down the line, not yet their own topic.

- [ ] **"Composition Is All You Need" — Fernando Rojo (React Universe Conf 2025)** — composition vs. prop-heavy "God"/iceberg components (Almighty `<Button>`, `<PlotChart>`); compound components; base & variants (Open-Closed); JSX over POJOs; context-based state so the consumer owns state. Feeds topic **2** (`02-composition`). Video: <https://www.youtube.com/watch?v=4KvbVq3Eg5w>. Commentary: <https://www.ianduvall.com/blog/composition>.

## Suggested order

Tracks 1 → 2 → 3 are the core; run Track 4 alongside them from day one (Vite + TS + ESLint). Then Track 5, and only then Track 6 (frameworks make far more sense once you've felt the SPA pain). Tracks 7–8 run continuously.

## Local tooling (what to install)

| Tool | For | Notes |
| --- | --- | --- |
| Node + `npm` | runtime, package manager | already installed |
| Vite | dev server & build | `npm create vite@latest` |
| Next.js | SSR / RSC framework | `npx create-next-app` |
| Vitest + React Testing Library | testing | Vite-native |
| TanStack Query | server state | <https://tanstack.com/query> |
| React Router | routing | <https://reactrouter.com> |
| Tailwind CSS | styling | <https://tailwindcss.com> |
| ESLint + Prettier | lint / format | `eslint-plugin-react-hooks` |

## Sources / references

- **React** — Learn <https://react.dev/learn>; Reference <https://react.dev/reference/react>; Server Components <https://react.dev/reference/rsc/server-components>; React 19 <https://react.dev/blog/2024/12/05/react-19>; React Compiler <https://react.dev/learn/react-compiler>.
- **TypeScript** — Handbook <https://www.typescriptlang.org/docs/handbook/>; React guide <https://react.dev/learn/typescript>.
- **Next.js** — <https://nextjs.org/docs>.
- **Vite** — <https://vite.dev/guide/>.
- **React Router** — <https://reactrouter.com>.
- **TanStack Query** — <https://tanstack.com/query/latest>.
- **Testing Library** — <https://testing-library.com/docs/react-testing-library/intro/>; Vitest <https://vitest.dev>.
- **Web performance** — web.dev Core Web Vitals <https://web.dev/articles/vitals>.
- **Web platform** — MDN <https://developer.mozilla.org/>.

## How to add a React topic

1. Pick the next number and create `reactjs/{n}-{name}`.
2. Add the code plus a `README.md` (what it shows, how to run, real output, citations).
3. Tick the topic here (status + example dir).