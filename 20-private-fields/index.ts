// Private class fields (`#`) — ES2022.
//
// A field, method, accessor or static member whose name starts with `#` is *truly*
// private: reachable only from code physically inside the class body, via `this.#x`
// (or `ClassName.#x` for statics). The engine enforces this — it is not a naming
// convention like `_x`, and it is not the TypeScript `private` keyword.
//
// Run: node index.ts

class Counter {
  #count = 0; // private instance field
  static #instances = 0; // private static field (shared by all instances)
  #step: number; // private field, set in the constructor

  constructor(step = 1) {
    this.#step = step;
    Counter.#instances += 1;
  }

  #bump() {
    this.#count += this.#step;
  } // private method

  increment() {
    this.#bump();
    return this.#count;
  } // public API drives the privates

  get value() {
    return this.#count;
  } // public getter

  static get instances() {
    return Counter.#instances;
  } // public static getter

  // Ergonomic brand check: `#count in obj` is true only for real Counter instances.
  static isCounter(obj: unknown): boolean {
    return #count in (obj as object);
  }
}

const c = new Counter(2);
console.log("c.increment():", c.increment()); // 2
console.log("c.increment():", c.increment()); // 4
console.log("c.value:", c.value); // 4

console.log("\n--- the private field is invisible from outside ---");
console.log("Object.keys(c):", Object.keys(c)); // [] — not enumerable
console.log("JSON.stringify(c):", JSON.stringify(c)); // {} — no data props
console.log('"#count" in c:', "#count" in c); // false — a string key is not the private name
console.log('c["#count"]:', (c as unknown as Record<string, unknown>)["#count"]); // undefined

// Writing a same-named *public* string property does NOT touch the private field:
(c as unknown as Record<string, unknown>)["#count"] = 999;
console.log('after c["#count"] = 999 -> c.value:', c.value); // still 4
console.log('c["#count"] is a separate public prop:', (c as unknown as Record<string, unknown>)["#count"]); // 999

console.log("\n--- brand check ---");
console.log("Counter.isCounter(c):", Counter.isCounter(c)); // true
console.log("Counter.isCounter({}):", Counter.isCounter({})); // false

console.log("\nCounter.instances:", Counter.instances); // 1

// NOTE: writing `c.#count` out here is a *SyntaxError* ("Private field '#count' must
// be declared in an enclosing class") — it does not even parse. Uncomment to see:
// console.log(c.#count);
