# The Four Fundamentals of OOP

*The classic pillars, viewed critically against Kay's original vision.*

## The four pillars

| Pillar | What it means | Example | Purpose |
|---|---|---|---|
| **Encapsulation** | Bundling data (fields) and the methods that operate on that data together, while hiding internal details. | A `BankAccount` class with a private `balance` and public `deposit()`/`withdraw()` methods. You can't directly mess with `balance` from outside. | Protects data integrity and prevents external code from depending on internal implementation. |
| **Abstraction** | Hiding complex implementation details and exposing only what's necessary. Focus on *what* an object does, not *how*. | A `Car` object has `start()`, `drive()`, `stop()`. You don't need to know how the ignition or fuel injection works to use it. | Reduces complexity and lets you change implementation without affecting users. |
| **Inheritance** | Creating new classes based on existing ones, inheriting their properties and behaviors. Establishes an "is-a" relationship. | A `Dog` class inherits from `Animal`. It gets `eat()` and `sleep()` for free, and can add its own `bark()`. | Promotes code reuse, but as we saw with DIP, overusing it can create rigid hierarchies. |
| **Polymorphism** | "Many forms" — the ability for objects of different types to be treated through the same interface, with different behaviors. Comes in two forms: compile-time (overloading) and runtime (overriding). | A `Shape` base class with `draw()`. `Circle.draw()` and `Square.draw()` behave differently, but both can be called through a `Shape` reference. | Enables flexibility and extensibility — you can add new types without changing existing code that uses the base type. |

## Important notes

- **Not universal.** As we discussed, Alan Kay's original vision centered around *messaging*, not these four. Many modern developers argue messaging/decoupling is the core, and these four are more of a Simula-derived checklist.
- **Composition over inheritance.** These days, especially with SOLID, we often prefer *composition* (has-a) over inheritance (is-a). You don't *have* to inherit to achieve polymorphism or reuse.
- **They're a means to an end.** The goal isn't to tick all four boxes — it's to achieve decoupling, flexibility, and maintainability. Ask *when* to use them, not just *what* they are.
