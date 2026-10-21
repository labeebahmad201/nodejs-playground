# Polymorphism in OOP

*Polymorphism means "many forms". It allows objects of different types to be treated through the same interface, with each type providing its own implementation.*

## What is Polymorphism?

With polymorphism, a parent type reference can point to child objects, and the correct overridden method is called at runtime. This enables flexibility and extensibility.

## Example (Runtime Polymorphism)

```ts
abstract class Shape {
  abstract draw(): void;
}

class Circle extends Shape {
  draw() {
    console.log("Drawing a circle");
  }
}

class Square extends Shape {
  draw() {
    console.log("Drawing a square");
  }
}

class Triangle extends Shape {
  draw() {
    console.log("Drawing a triangle");
  }
}

// All treated as Shape, but behave differently
function render(shape: Shape) {
  shape.draw();
}

render(new Circle());   // Drawing a circle
render(new Square());   // Drawing a square
render(new Triangle()); // Drawing a triangle
```

## Types of Polymorphism

| Type | When | Example |
|---|---|---|
| **Compile-time (Static)** | Resolved at compile time | Method overloading (same method name, different parameters) |
| **Runtime (Dynamic)** | Resolved at runtime | Method overriding (child overrides parent's method) |

```ts
// Compile-time polymorphism (overloading)
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  add(a: string, b: string): string {
    return a + b;
  }
}

// Runtime polymorphism (overriding) - as shown above with draw()
```

## Key Points

- **"Many forms"**: Same method call, different behavior based on object type
- **Loose coupling**: Code can work with base/abstract types without knowing concrete types
- **Extensible**: Add new shapes/classes without changing `render()`
- **Core to SOLID**: Especially OCP and LSP rely heavily on polymorphism

See [Strategy vs Subtype Polymorphism](../strategy-polymorphism/34-strategy-vs-subtype-polymorphism.md) and [When to use subtype polymorphism](../strategy-polymorphism/42-when-to-use-subtype-polymorphism.md) for deeper discussion.
