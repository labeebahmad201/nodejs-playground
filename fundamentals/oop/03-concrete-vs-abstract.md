# Concrete vs Abstract

## Concrete

A **concrete** class is one that can be instantiated directly. It provides full implementations for all its methods (including inherited abstract ones). You can do `new` on it.

**Example:**
```ts
class Dog {
  bark() {
    console.log("Woof!");
  }
}

const dog = new Dog(); // can instantiate directly
dog.bark();
```

## Abstract

An **abstract** class is one that cannot be instantiated directly. It exists to define a base template for subclasses. It may contain abstract methods (no implementation) that subclasses must implement, or concrete methods that are shared.

**Example:**
```ts
abstract class Animal {
  abstract makeSound(): void;

  sleep() {
    console.log("Zzz...");
  }
}

class Cat extends Animal {
  makeSound() {
    console.log("Meow!");
  }
}

// new Animal() // Error: cannot instantiate abstract class
const cat = new Cat();
cat.makeSound();
cat.sleep();
```

## Key Difference

| Aspect | Concrete | Abstract |
|---|---|---|
| Can instantiate? | Yes (`new`) | No |
| Has full implementations? | Usually yes | Can have partial (mix of abstract + concrete methods) |
| Purpose | Represents a usable object | Represents a shared idea/base to be extended |
