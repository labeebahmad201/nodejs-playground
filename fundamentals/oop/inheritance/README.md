# Inheritance in OOP

*Inheritance allows a new class (child/subclass) to inherit properties and methods from an existing class (parent/superclass). It establishes an "is-a" relationship.*

## What is Inheritance?

Inheritance promotes code reuse by letting child classes inherit behavior from parent classes. The child can also override methods or add its own.

## Example

```ts
class Animal {
  eat() {
    console.log("Eating...");
  }

  sleep() {
    console.log("Sleeping...");
  }
}

class Dog extends Animal {
  bark() {
    console.log("Woof!");
  }
}

class Cat extends Animal {
  meow() {
    console.log("Meow!");
  }
}

const dog = new Dog();
dog.eat();  // inherited from Animal
dog.sleep(); // inherited from Animal
dog.bark();  // own method
```

## Key Points

- **"Is-a" relationship**: A `Dog` *is an* `Animal`
- **Code reuse**: Shared logic lives in the parent class
- **Extensibility**: Children can add or override behavior
- **Hierarchy**: Creates parent-child relationships

## Caveat: Favor Composition

Overusing inheritance can lead to rigid, deep class hierarchies. These days, we often prefer **composition** ("has-a") over inheritance ("is-a") because it's more flexible.

```ts
// Composition approach
class BarkBehavior {
  bark() { console.log("Woof!"); }
}

class Dog {
  constructor(private barkBehavior: BarkBehavior) {}

  bark() {
    this.barkBehavior.bark();
  }
}
```

See [Inheritance vs Composition](../strategy-polymorphism/36-inheritance-vs-composition.md) for more.
