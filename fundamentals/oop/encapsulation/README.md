# Encapsulation in OOP

*Encapsulation is bundling data and the methods that operate on that data together, while restricting direct access to some of the object's components.*

## What is Encapsulation?

Encapsulation means **hiding internal state** and only exposing controlled access through methods (getters/setters) or public behavior. It's about protecting the object's data from being modified in unintended ways.

## Example

```ts
class BankAccount {
  private balance: number = 0;

  deposit(amount: number) {
    if (amount <= 0) throw new Error("Amount must be positive");
    this.balance += amount;
  }

  withdraw(amount: number) {
    if (amount <= 0) throw new Error("Amount must be positive");
    if (amount > this.balance) throw new Error("Insufficient funds");
    this.balance -= amount;
  }

  getBalance(): number {
    return this.balance;
  }
}

const account = new BankAccount();
account.deposit(100);
account.withdraw(30);
console.log(account.getBalance()); // 70

// account.balance = 1000000; // Error: 'balance' is private
```

## Key Points

- **Data hiding**: Keep fields `private`/`protected` so external code can't access them directly
- **Controlled access**: Force all changes to go through methods where you can validate rules
- **Bundling**: Data and the logic that manipulates it live together in the same class
- **Integrity**: Prevents invalid states by enforcing rules in one place

## Encapsulation vs Abstraction

| Concept | Focus | Question |
|---|---|---|
| **Encapsulation** | Hiding *data/internal state* | *"How do we protect this object's internals?"* |
| **Abstraction** | Hiding *complexity* | *"What can this object do?"* |

**Encapsulation is about implementation. Abstraction is about design.**
