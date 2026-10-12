# 20. Private class fields (`#`)

A class member whose name starts with **`#`** is *truly* private: it can only be read
or written by code physically **inside the class body**, via `this.#x` (or
`ClassName.#x` for statics). This is a real, engine-enforced feature (ES2022), not a
naming convention like `_x` and not the TypeScript `private` keyword.

```
20-private-fields/
├── index.ts    # private fields/methods/statics, brand check, outside-access attempts
└── README.md
```

Run it:

```sh
node index.ts
```

## Kinds of private members

Any class member can be private — just prefix its name with `#`:

```js
class Counter {
  #count = 0;                 // private instance field
  static #instances = 0;      // private static field
  #bump() { this.#count++; }  // private method
  get #double() { ... }       // private getter
  static #reset() { ... }     // private static method
}
```

Private members are **declared in the class body** — unlike public fields, you cannot
create one by assignment. Referencing an undeclared `#name` is a `SyntaxError`.

## Truly private vs `_` vs TypeScript `private`

| Form | Enforced by | Accessible at runtime? | Accessible from outside? |
|---|---|---|---|
| `#field` | the JS engine (hard privacy) | no | no — `obj.#field` is a `SyntaxError` |
| `private field` (TS) | the TypeScript compiler only | yes (a normal property) | yes, via `obj["field"]` / `any` |
| `_field` (convention) | nobody | yes | yes — just a normal property |

- **`#`** lives in a separate internal-slot namespace. There is no string form of a
  private name, so it cannot be reached with brackets, `in`, `Object.keys`,
  `JSON.stringify`, or reflection. Only code inside the class can touch it.
- **TypeScript `private`/`protected`** are *compile-time* checks that are **erased** at
  runtime — the property is still a plain, accessible property in the emitted JS. Use
  `#` when you need privacy that survives to runtime.
- **`_field`** is a "please don't touch" hint. Nothing enforces it.

## What you cannot do from outside

```js
const c = new Counter();

c.#count;          // SyntaxError: Private field '#count' must be declared in an enclosing class
c["#count"];       // undefined — a *string* key, unrelated to the private field
Object.keys(c);    // []  — not enumerable
JSON.stringify(c); // {}  — private state is not serialized
"#count" in c;     // false — the private name is not a string property
```

Note the trap: `c["#count"] = 999` does **not** modify the private field. It creates (or
writes) a **separate public property literally named `"#count"`**, while the real
`#count` is untouched — exactly what `index.ts` demonstrates.

## Brand checks: `#x in obj`

The `in` operator accepts a private name, giving an *ergonomic brand check* — a reliable
"is this really one of mine?" test that does not rely on a forgeable public flag:

```js
static isCounter(obj) { return #count in obj; }  // true only for real Counter instances
```

This works because the private name only resolves for objects that actually carry the
private slot; for anything else (including plain objects) it returns `false`.

## Why use it

- **Real encapsulation** — internal state can't be read, mutated or monkey-patched from
  outside, so invariants hold.
- **No key collisions** — a private name can never clash with a public/user property
  (the `"#count"` example above).
- **Self-documenting intent** — the `#` marks "this is mine, not API."

## Sources / references

- MDN, *Private elements* —
  <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_elements>.
- TC39 proposal, *Class fields* (includes private fields + brand checks) —
  <https://github.com/tc39/proposal-class-fields>.
- V8 blog, *Class fields* — <https://v8.dev/features/class-fields>.
- MDN, *`in` operator* (private names / brand checks) —
  <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in>.
