# The Min Stack: A Minimum Is a History, Not a Variable

*`getMin()` looks like it should be a single variable. It isn't. The minimum is a fact about the whole stack at a point in time, and the moment you can undo a `push`, you need the minimum from before that push — not the minimum now. The fix is not a cleverer variable. It's storing the answer with every frame.*

---

## The problem

Design a stack that supports `push`, `pop`, `top`, and `getMin`, all in **O(1)** time.

```python
MinStack()
push(-2)
push(0)
push(-3)
getMin()  # -3
pop()
top()     # 0
getMin()  # -2
```

The first three operations are ordinary stack operations. `getMin` is the interesting one, because it is **derived state**: its value is a function of everything currently in the stack, not of the last operation. That difference is the whole problem.

## The obvious solution is O(n)

Scan the stack and take the minimum:

```python
def getMin(self) -> int:
    return min(value for value, _ in self.stack)
```

Correct, but O(n). If an interviewer calls `getMin` after every push and pop, the whole sequence is O(n²). The requirement says O(1), so scanning is out.

## The tempting solution is wrong

The natural next idea is a single field that tracks the smallest value seen so far:

```python
def push(self, value: int) -> None:
    self.stack.append(value)
    self.minimum = value if self.minimum is None else min(self.minimum, value)

def pop(self) -> None:
    self.stack.pop()          # ...and the minimum is never restored

def getMin(self) -> int:
    return self.minimum
```

Push `5`, `3`, `4`. The minimum is `3`. Pop `4` — the minimum is still `3`, and that happens to be right. Pop `3` — the stack now contains only `5`, but `getMin()` still returns `3`.

The bug is not that the code forgot to update a variable. It's that **the variable cannot be updated correctly, because the information needed to update it is gone.**

### Why no scalar can work

The minimum is a *summary* of a set. Summaries are lossy, and this one is not invertible. Given:

- the minimum of a set `S ∪ {x}`, and
- the fact that `x` was removed,

there is no way to recover the minimum of `S`. Example: `min({5} ∪ {3}) = 3`. Remove `3`. Was the rest `{5}`? `{5, 7}`? `{4, 9, 12}`? All of them produce `3` before the removal. The scalar collapsed all of those possibilities into one number.

The values themselves are still in the stack, so you *could* rescan them — that's the O(n) solution again. The point is that the minimum needs either **recomputation** or **history**. There is no third option.

## The idea: every frame carries the minimum as of its arrival

Store two things per element:

```python
self.stack.append((value, minimum))
```

The second slot is not "the current minimum of the stack." It is **the minimum of the stack at the moment this element was pushed** — a snapshot of the prefix ending at this frame.

```text
push 5  →  [(5, 5)]
push 3  →  [(5, 5), (3, 3)]
push 4  →  [(5, 5), (3, 3), (4, 3)]
getMin  →  3
pop     →  [(5, 5), (3, 3)]
getMin  →  3
pop     →  [(5, 5)]
getMin  →  5
```

The invariant is:

> For every frame `i`, `stack[i][1] == min(stack[0][0] … stack[i][0])`.

It holds by induction. The first frame's minimum is its own value. Each new frame takes `min(previous frame's minimum, new value)`, which is exactly the minimum of the new prefix.

Now look at what `pop` does. It removes the last frame, and the new top frame's second slot was computed *before* the removed element existed. So it is, by definition, the minimum of the remaining stack. **`pop` doesn't recompute anything. It reveals a value that was already true.** Reversing the push restores the previous minimum because the previous minimum was recorded, not derived.

That is the takeaway: the tuple is a **history of the answer**, one entry per frame. `getMin()` is just `stack[-1][1]`.

## The implementation

```python
class MinStack:
    def __init__(self) -> None:
        self.stack: list[tuple[int, int]] = []

    def push(self, value: int) -> None:
        if not self.stack:
            minimum = value
        else:
            minimum = min(self.stack[-1][1], value)

        self.stack.append((value, minimum))

    def pop(self) -> None:
        self.stack.pop()

    def top(self) -> int:
        if self.stack:
            return self.stack[-1][0]

        return 0  # default to show there is none.

    def getMin(self) -> int:
        return self.stack[-1][1]
```

Every operation touches only the top frame, so everything is O(1). Space is O(n) — two integers per element. You can't get O(1) `getMin` and O(1) `pop` without keeping some per-element history; the only question is how compactly you store it.

Duplicates are fine. Push `3` twice and you get `(3, 3)` twice; popping one leaves `(3, 3)`, which is still correct. Negative numbers are fine too — `min` doesn't care about sign.

## The same idea, two stacks

A common alternative keeps a parallel stack of minimums:

```python
self.values = []
self.minimums = []

def push(self, value):
    self.values.append(value)
    self.minimums.append(value if not self.minimums else min(self.minimums[-1], value))

def pop(self):
    self.values.pop()
    self.minimums.pop()

def getMin(self):
    return self.minimums[-1]
```

This is the tuple solution with the pairs stored in two arrays instead of one. It is equally correct, and some people find it easier to read. But it has two structures that must stay in lockstep: every `push` and `pop` has to touch both, and a bug in one path silently desynchronizes them. The tuple makes the pairing structural — one frame, one push, one pop — which is harder to get wrong.

There is also a space optimization: only push onto the minimum stack when the new value is `<=` the current minimum, and only pop when the popped value equals the top of the minimum stack. That saves memory when few elements are new minima, but it turns a simple invariant into conditional bookkeeping. Use `<=` and `==`, not `<`, or duplicates will pop the minimum too early. For an interview, the tuple is the clearer answer.

## One thing I'd change: `top()` returning `0`

The implementation above returns `0` when the stack is empty. The intent is robustness, and that instinct is right, but `0` is a valid stack value. LeetCode's constraints allow anything from `-2^31` to `2^31 - 1`, so `0` is indistinguishable from a real element. A caller doing `if stack.top() == 0` now has an ambiguity, not a guard.

More importantly, it is inconsistent: `top()` has a fallback, but `getMin()` still raises `IndexError` on an empty stack. The object doesn't have one clear empty-stack contract; it has two.

On LeetCode this never matters, because the problem guarantees that `pop`, `top`, and `getMin` are only called on a non-empty stack. The branch is dead code there. If you keep a guard for real-world use, make it explicit:

```python
def top(self) -> int:
    if not self.stack:
        raise IndexError("top() called on an empty stack")
    return self.stack[-1][0]

def getMin(self) -> int:
    if not self.stack:
        raise IndexError("getMin() called on an empty stack")
    return self.stack[-1][1]
```

Or return `Optional[int]` and use `None` for "no value." Either is honest. A magic number is not, and in Python there is no out-of-range sentinel to fall back on: integers are unbounded, so *every* integer is a legal element. "Robust" means a predictable contract, not a value that happens to not crash.

## Testing the invariant, not the example

The example from the problem statement is necessary but weak. The bug in the single-variable version only appears after a specific sequence of pops, so the useful test is a randomized comparison against a deliberately naive implementation:

```python
import random

for _ in range(1000):
    fast = MinStack()
    slow = []  # just a list; getMin is min(slow)

    for _ in range(100):
        op = random.choice(["push", "push", "push", "pop", "top", "getMin"])
        if not slow and op in ("pop", "top", "getMin"):
            continue

        if op == "push":
            value = random.randint(-50, 50)
            fast.push(value)
            slow.append(value)
        elif op == "pop":
            fast.pop()
            slow.pop()
        elif op == "top":
            assert fast.top() == slow[-1]
        else:
            assert fast.getMin() == min(slow)
```

The naive version is obviously correct and obviously slow. The fast version is subtle. Running them against the same random operation stream is what turns "I think the invariant holds" into "the invariant held across up to 100,000 operations." It also catches the duplicate-minimum and empty-adjacent cases that hand-written examples tend to miss.

## What generalizes

The tuple is not a Min Stack trick. It is a pattern:

- **Prefix aggregates.** A running sum, product, count, or maximum can be stored alongside each element. Query the aggregate at the top, and `pop` restores the previous one for free.
- **Undo and versioning.** Any state you can only move forward needs a recorded prior value if you want to move back. The tuple is a one-step undo log; event sourcing is the same idea at system scale.
- **Monotonic stacks.** For "next greater element," you pop elements that can never be the answer again. That is also history management: discard what cannot matter, keep what can.
- **Why this doesn't work for a queue.** The trick depends on LIFO. The minimum you need after a `pop` is exactly the one recorded before that `push`, because the element leaving is the element that arrived last. In a FIFO queue the element leaving is the *oldest*, and the min-so-far stored at the tail says nothing about what happens when the head leaves. Sliding-window minimum needs a monotonic deque instead. Same question, different structure, different answer.

The common thread: **derived state plus destructive updates loses information. If an operation must be reversible, store what you need to reverse it.**

## The takeaway

A single `minimum` variable answers "what is the smallest value right now?" It cannot answer "what was the smallest value before the last push?" Those are different questions, and `pop` asks the second one.

The tuple works because it stops treating the minimum as a current value and starts treating it as a **property of a prefix** — a small, per-frame historical record. `push` extends the record; `pop` truncates it; `getMin` reads the end. That is why the fix is one extra slot per element, and why no amount of cleverness with a scalar could have replaced it.
