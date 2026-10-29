// Immutability — values, references, and copies.
//
// Primitives are immutable: changing a primitive variable creates a new value and
// rebinds the variable. Arrays and objects are mutable: the variable holds a
// reference, so changing the object in place changes what every reference sees.
//
// Run: node index.ts

const show = (label: string, value: unknown): void => {
  console.log(`${label}:`, value);
};

console.log("=== 1. primitives: new values, not mutation ===");
let greet = "Hello";
const originalGreet = greet;
greet += " World";
show("greet", greet); // Hello World
show("originalGreet", originalGreet); // Hello
show("same string?", greet === originalGreet); // false

let total = 42;
const originalTotal = total;
total += 1;
show("total", total); // 43
show("originalTotal", originalTotal); // 42

console.log("\n=== 2. const is not immutability ===");
const ages = [10, 20, 30];
ages.push(40); // legal: the binding is const, the array is not
show("ages after push", ages); // [10, 20, 30, 40]
// ages = []; // TypeError: Assignment to constant variable.

console.log("\n=== 3. arrays are mutable; references see the change ===");
const sameAges = ages;
ages.push(50);
show("sameAges === ages", sameAges === ages); // true
show("sameAges", sameAges); // [10, 20, 30, 40, 50]

console.log("\n=== 4. an immutable update creates a new array ===");
const before = [10, 20, 30];
const after = [...before, 40];
show("before", before); // [10, 20, 30]
show("after", after); // [10, 20, 30, 40]
show("same reference?", before === after); // false

show("filter(>= 20)", before.filter((n) => n >= 20)); // [20, 30]
show("map(* 2)", before.map((n) => n * 2)); // [20, 40, 60]
show("slice(1, 3)", before.slice(1, 3)); // [20, 30]
show("before still unchanged", before); // [10, 20, 30]

const source = [30, 10, 20];
const sorted = source.toSorted((a, b) => a - b);
show("source after toSorted", source); // [30, 10, 20]
show("sorted", sorted); // [10, 20, 30]
show("before.with(1, 99)", before.with(1, 99)); // [10, 99, 30]
show("before after with", before); // [10, 20, 30]

console.log("\n=== 5. objects are mutable; spread creates a new object ===");
const person = { name: "Ada", age: 36 };
const samePerson = person;
person.age = 37;
show("samePerson === person", samePerson === person); // true
show("person", person); // { name: 'Ada', age: 37 }

const older = { ...person, age: 38 };
show("person after spread update", person); // { name: 'Ada', age: 37 }
show("older", older); // { name: 'Ada', age: 38 }
show("same reference?", person === older); // false

console.log("\n=== 6. spread is shallow ===");
const original = { name: "Ada", address: { city: "London" } };
const shallow = { ...original };
shallow.address.city = "Paris";
show("original.address.city", original.address.city); // Paris — shared
show("shallow.address.city", shallow.address.city); // Paris

const deepUpdate = {
  ...original,
  address: { ...original.address, city: "Rome" },
};
show("original after deep update", original.address.city); // Paris
show("deepUpdate.address.city", deepUpdate.address.city); // Rome

console.log("\n=== 7. Object.freeze is shallow ===");
const frozen = Object.freeze({
  name: "Ada",
  address: { city: "London" },
});
show("Object.isFrozen(frozen)", Object.isFrozen(frozen)); // true
try {
  (frozen as unknown as { name: string }).name = "Grace";
} catch (error) {
  show("top-level write", (error as Error).name); // TypeError (strict mode)
}
frozen.address.city = "Paris"; // nested object is not frozen
show("nested write", frozen.address.city); // Paris

console.log("\n=== 8. structuredClone makes a deep copy ===");
const clone = structuredClone(original);
clone.address.city = "Berlin";
show("original.address.city", original.address.city); // Paris
show("clone.address.city", clone.address.city); // Berlin
show("same reference?", original === clone); // false

console.log("\n=== 9. TypeScript readonly is compile-time only ===");
type ReadonlyPerson = Readonly<{
  name: string;
  address: { city: string };
}>;

const typed: ReadonlyPerson = { name: "Ada", address: { city: "London" } };
// typed.name = "Grace"; // Compile error: cannot assign to 'name' because it is read-only.

(typed as unknown as { name: string }).name = "Grace"; // bypasses the checker
typed.address.city = "Paris"; // allowed: Readonly<T> is shallow

show("typed.name after cast", typed.name); // Grace
show("typed.address.city", typed.address.city); // Paris
