# 27. Immutability — values, references, and copies

*Based on [Deborah Kurata, “Understanding Immutability in JavaScript”](https://www.youtube.com/watch?v=DBZESPS-5mQ) (2024).*

An immutable value cannot be changed after it is created. JavaScript primitives already work that way; arrays and objects do not. The useful skill is telling the difference between **changing a value** and **reassigning a variable**.

```
27-immutability/
├── index.ts    # runnable examples for every point below
└── README.md
```

Run it:

```sh
node index.ts
```

## The distinction the video starts with

```js
let greet = "Hello";
const original = greet;

greet += " World";

console.log(greet);    // Hello World
console.log(original); // Hello
```

The string `"Hello"` did not become `"Hello World"`. JavaScript created a new string and rebound `greet` to it; `original` still points at the old value. Numbers behave the same way. **Primitives are immutable, but variables can be reassigned.**

This also means `const` is not immutability. `const` prevents rebinding the variable; it does not freeze the object:

```js
const ages = [10, 20, 30];
ages.push(40); // legal: the binding is const, the array is not
```

## Arrays are mutable

```js
const ages = [10, 20, 30];
const same = ages;

ages.push(40);

console.log(same === ages); // true
console.log(ages);          // [10, 20, 30, 40]
```

A variable holds a **reference** to an array or object, not the value itself. `push` changes the array in place, so every reference sees the change. The reference did not change, which is why reference-based change detection, setters, and state libraries can miss the update.

## Objects are mutable too

```js
const person = { name: "Ada", age: 36 };
const same = person;

person.age = 37;

console.log(same === person); // true
```

Arrays are objects, so they follow the same rule.

## Immutable updates: copy, then change the copy

```js
const before = [10, 20, 30];
const after = [...before, 40];

const person = { name: "Ada", age: 36 };
const older = { ...person, age: 37 };
```

The spread operator creates a new array or object at a new reference. The original is untouched, and `before !== after`, so change detection sees the difference.

## Which array methods mutate?

| Creates a new array | Changes the array in place |
| --- | --- |
| `map`, `filter`, `slice`, `concat`, `flat`, `flatMap` | `push`, `pop`, `shift`, `unshift`, `splice` |
| `toSorted`, `toReversed`, `toSpliced`, `with` | `sort`, `reverse`, `fill`, `copyWithin` |

The important pair is `sort` vs `toSorted`:

```js
const source = [30, 10, 20];
const sorted = source.toSorted((a, b) => a - b);

console.log(source); // [30, 10, 20] — unchanged
console.log(sorted); // [10, 20, 30]
```

`slice` and `toSpliced` make a new array, but only a **shallow** one. `with(index, value)` replaces one element and returns a new array without mutating the source.

## The copy is shallow

```js
const original = { name: "Ada", address: { city: "London" } };
const copy = { ...original };

copy.address.city = "Paris";

console.log(original.address.city); // Paris — the nested object is shared
```

Spread copies the top-level properties. Nested objects are still shared, so changing one changes both. For a nested immutable update, copy each changed path:

```js
const next = {
  ...original,
  address: { ...original.address, city: "Paris" },
};
```

That is **structural sharing**: the unchanged branches are reused, and only the changed path is copied.

## `Object.freeze` is shallow too

```js
const frozen = Object.freeze({
  name: "Ada",
  address: { city: "London" },
});

frozen.name = "Grace";          // throws in strict mode
frozen.address.city = "Paris";  // still allowed
```

`Object.freeze` prevents adding, removing, or reassigning **top-level** properties. It does not deep-freeze nested objects. If you need a genuinely independent deep copy, use `structuredClone`:

```js
const clone = structuredClone(original);
clone.address.city = "Paris";

console.log(original.address.city); // London
console.log(clone.address.city);    // Paris
```

`structuredClone` is a global in modern Node.js. It copies nested objects, arrays, `Map`, `Set`, `Date`, and similar values, but it cannot clone functions or symbols.

## TypeScript: `readonly` is compile-time only

```ts
type Person = {
  readonly name: string;
  readonly address: { city: string };
};
```

`readonly`, `Readonly<T>`, and `as const` stop writes through the type checker. They are erased before the code runs, and `Readonly<T>` is shallow. Use them to document intent, not to enforce runtime immutability.

## Why immutability matters

- **Predictable state.** A value that never changes cannot be changed by an unrelated function later.
- **Change detection.** Frameworks and state libraries can compare references: a new object means "something changed."
- **Fewer side effects.** Functions that return new values are easier to reason about, test, and compose.
- **Safer sharing.** Async or concurrent code holding the same reference cannot mutate it behind another caller's back.
- **Easier debugging.** You can keep the old value and compare it with the new one.

## When not to

Immutability is a boundary discipline, not a blanket ban. Mutating a local scratch array inside one function is fine and often faster. Copying a large structure on every update has a cost; copy only the state that is shared or observed. Use `structuredClone` for real independence, not as a reflex.

## Rule of thumb

- **Treat shared or observed state as immutable; mutate local scratch data freely.**
- Copy at the boundary, then change the copy.
- Use spread or `toSorted` / `with` for one-level updates; copy each changed nested path.
- Use `Object.freeze` for a shallow runtime guard, `structuredClone` for deep independence, and TypeScript `readonly` for compile-time intent.
- Do not use `JSON.parse(JSON.stringify(...))` as a general deep clone: it loses dates, `undefined`, functions, symbols, and prototypes.
- Remember: `const` prevents reassignment, not mutation.

## References

- Deborah Kurata — [*Understanding Immutability in JavaScript*](https://www.youtube.com/watch?v=DBZESPS-5mQ) (video)
- Deborah Kurata — [code from the video](https://stackblitz.com/edit/immutability-deborahk)
- MDN — [Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax), [`Object.freeze()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [non-mutating array methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#copying_methods_and_mutating_methods)
- TypeScript — [`readonly`](https://www.typescriptlang.org/docs/handbook/2/objects.html#readonly-properties), [`Readonly<T>`](https://www.typescriptlang.org/docs/handbook/utility-types.html#readonlytype)