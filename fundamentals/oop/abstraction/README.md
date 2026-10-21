# Abstraction in OOP

*Abstraction means hiding complex implementation details and exposing only what's essential. It's about "what", not "how".*

## What is Abstraction?

Abstraction is the process of hiding complexity. You expose only the necessary details and keep the internal workings hidden. Users of an object don't need to know *how* it works, just *what* it does.

## Two Common Explanations

Abstraction is explained in two ways because it appears at different levels.

### 1. Class-Level Abstraction (Public Methods)

Every well-encapsulated class provides abstraction through its public API. The public methods are what the outside world sees, while private/internal details are hidden.

**Example:**
```ts
class CoffeeMachine {
  private grindBeans() { /* complex grinding logic */ }
  private heatWater() { /* complex heating logic */ }

  brew() {
    this.grindBeans();
    this.heatWater();
    console.log("Coffee is ready!");
  }
}

const machine = new CoffeeMachine();
machine.brew(); // You only need to know "brew()" exists. How it works is hidden.
```

Here, `brew()` is an abstraction. The public API simplifies a complex process.

### 2. Design-Level Abstraction (Interfaces & Abstract Classes)

Abstraction also means defining a contract that multiple implementations can fulfill. This lets you "program to an interface", not to concrete implementations.

**Example:**
```ts
interface Brewer {
  brew(): void; // Contract: anything that brews must have brew()
}

class EspressoMachine implements Brewer {
  brew() {
    console.log("Brewing espresso...");
  }
}

class FrenchPress implements Brewer {
  brew() {
    console.log("Brewing with french press...");
  }
}

function makeCoffee(brewer: Brewer) {
  brewer.brew(); // Doesn't care which implementation it is
}

makeCoffee(new EspressoMachine());
makeCoffee(new FrenchPress());
```

Here, `Brewer` is the abstraction. The code depends on the *contract*, not the concrete classes.

## Which one is it?

**Both are correct.**

- The **public methods of a class are an abstraction** — they hide the internals of that one class.
- An **interface/abstract class makes that abstraction explicit and reusable** — it hides implementation across multiple classes.

## Abstraction vs Encapsulation

| Concept | Focus | Question |
|---|---|---|
| **Abstraction** | Hiding *complexity* | *"What can this object do?"* |
| **Encapsulation** | Hiding *data/internal state* | *"How do we protect this object's internals?"* |

**Abstraction is about design. Encapsulation is about implementation.**

## Key Takeaway

A single class gives you abstraction through its public API. Interfaces take that idea further — they let you say *"I don't care what class this is, as long as it can do X."*
