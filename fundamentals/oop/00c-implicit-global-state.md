# 🧠 Implicit Coupling via Global State

## Definition

Implicit coupling occurs when modules depend on shared state that is not declared in their interfaces. The state may be a global variable, a static field, or hidden mutable state inside a class. No function signature mentions the shared state, yet behavior depends on it.

## Real-world example — C global status

From the “Design with a global state” article:

```c
static struct Status status;

struct Data* receive(const struct Source*);
int alter(struct Data*);
int transmit(struct Sink*, struct Data*);
```

No function signature mentions `status`, yet every function depends on and may mutate it. The article notes this remains true even when the state is encapsulated as a private member in a class: “a hidden scoped state is still a global state.”

## Why it’s bad

Think of `status` as a whiteboard in a shared room. Any function can write on it. Any function that runs later reads whatever is currently there. The signatures don’t mention the whiteboard, so you can’t tell from the call alone what a function will read or leave behind.

The Nette DI guide calls this “wireless coupling”: one part of the code can reach another without passing a reference, so the dependency is invisible from the outside ([Nette](https://doc.nette.org/en/dependency-injection/global-state)).

That causes four practical problems.

**You can’t tell what a function needs.** `receive(source)` looks like it depends only on `source`. It also depends on `status`. Call it twice with the same source and it can do two different things because `status` changed in between. The signature is incomplete.

**Bugs show up far from their cause.** One function writes `status.mode`; another reads it much later:

```c
struct Data *d = receive(src); // writes status.mode
alter(d);                      // reads it later
```

`alter(d)` compiles on its own, but then it uses whatever `status.mode` happened to be left over. The failure may be in `alter`, but the mistake may have happened in `receive`, or in a third function that changed `status` in between.

**Tests interfere with each other.** A test that sets `status` leaves it set for the next test. Each test passes alone, but the suite fails when the tests run in a different order or in parallel. The tests are not isolated because the state is shared.

**You can’t run two copies independently.** One global `status` means one shared slot. Two orders, two users, or two pipelines cannot have different modes at the same time. With threads, they can also overwrite each other’s values, so you need locks just to protect a dependency that was never declared.

**A private field does not fix the hidden rule.** Moving `status` into a class stops other classes from touching it, but every method in that class still shares it. If callers must call `initialize()` before `spread()`, the rule is still invisible in the type system; it is just hidden one level lower. That is what the article means by “a hidden scoped state is still a global state.”

The fix is not “remove all state.” A class can own state safely if its constructor puts the object in a valid state and its methods don’t require an undocumented order. The problem is **mutable state that is shared and hidden**. Pass it in explicitly, or let one object own it and expose operations that keep it valid.

## Fix: dependency injection and a composition root

Replace the global state with dependency injection and a composition root. The remedy is to encapsulate the global property in a service with an explicit interface, and then pass that interface as a constructor parameter wherever it is needed. The composition root is the single, explicit place in the application where real implementations are created and dependencies are wired together.

Now the dependency is visible in the constructor. A caller cannot create the object without choosing which status service it uses, and the service—not an ambient global—owns the state. If two pipelines need independent state, they get two service instances instead of sharing one global slot.
