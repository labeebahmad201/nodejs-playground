# Abstraction vs Encapsulation

*Abstraction is about hiding complexity (what to expose). Encapsulation is about hiding data (how to protect).*

## Key Differences

| Aspect | **Abstraction** | **Encapsulation** |
|---|---|---|
| **Focus** | Hiding *complexity* - showing only what's necessary | Hiding *data/internal state* - protecting it from unauthorized access |
| **Question it answers** | *"What can this object do?"* | *"How do we protect this object's internals?"* |
| **Purpose** | Design-level concept - reduces complexity for the user | Implementation-level concept - prevents misuse and maintains integrity |
| **How it's achieved** | Interfaces, abstract classes, or just public methods | Access modifiers (`private`, `protected`, getters/setters) |
| **Scope** | Can span multiple classes (interfaces) or a single class (public API) | Usually within a single class |

## Example

```ts
// ABSTRACTION: We care about WHAT Payment can do, not HOW
interface Payment {
  pay(amount: number): void; // Only expose the essential method
}

class CreditCardPayment implements Payment {
  pay(amount: number): void {
    // Complex logic like validation, gateway calls, etc. are hidden here
    console.log(`Paid $${amount} using Credit Card`);
  }
}

// ENCAPSULATION: We protect the balance, control how it's modified
class BankAccount {
  private balance: number = 0; // Hidden data

  deposit(amount: number) {
    if (amount <= 0) throw new Error("Invalid amount"); // Controlled access
    this.balance += amount;
  }

  withdraw(amount: number) {
    if (amount <= 0) throw new Error("Invalid amount");
    if (amount > this.balance) throw new Error("Insufficient funds");
    this.balance -= amount;
  }

  getBalance(): number {
    return this.balance; // Controlled read
  }
}

// Using abstraction - we don't know how CreditCardPayment works internally
function checkout(payment: Payment, amount: number) {
  payment.pay(amount);
}

checkout(new CreditCardPayment(), 100);
```

## Simple Rule

**Abstraction is about design (what to expose). Encapsulation is about implementation (how to protect).**

They often work together - a well-encapsulated class also provides good abstraction through its public API.
