// Node strips the types and runs this file even though it contains a type error.
// Type checking is a separate step: `npx tsc --noEmit` (or `npm run typecheck`).

const add = (a: number, b: number): number => a + b;

// Type error: "2" is a string, but add() expects a number.
// Node runs it anyway and prints "12" (string concatenation at runtime).
console.log(add(1, "2"));
