# The Min Stack Is Not About Stacks

*`getMin()` looks like it should be a single variable. It isn't. The minimum is a fact about the whole collection at a point in time, and the moment you undo a push, you need the value it had before that push — not the value it has now. The stack is incidental. What you're actually learning is how to keep history for a property that is derived from data.*

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

## The real problem is not the stack

Strip away the container and the question underneath is:

> Given a collection of values, maintain a property `P(collection)` derived from all of them. Answer `P` in O(1) — including immediately after an element is removed.

Here `P` is the minimum. It could just as easily be the maximum, the sum, the product, the number of distinct values, or the GCD. The stack is not the point. What makes the problem hard is that `P` is **derived**: no single element stores it. It is a function of all the elements currently present. So when an element leaves, `P` doesn't merely change — it has to become the value it had *before that element arrived*.

That is a historical question: "what was `P` at time `t−1`?" A structure that only knows "what is `P` at time `t`?" cannot answer it.

The stack is just the simplest arena for this. Removal is LIFO, so the history you need to restore is exactly the history you recorded. That convenience is why it's the interview question — and why it can hide the general problem.

| | Stored per element | Derived from the collection |
| --- | --- | --- |
| Examples | the value itself | min, max, sum, size, distinct count |
| On push | the new fact arrives with the element | recompute it, or update it |
| On pop | the fact leaves with the element | **restore the previous answer** |
| Recoverable from the element? | yes | no — the element never contained the aggregate |

A derived property is a **summary**, and a summary is lossy. The rest of this article is about what that loss costs and how to pay for it.

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

The values themselves are still in the stack, so you *could* rescan them — that's the O(n) solution again. The point is that the minimum needs something outside the scalar: recomputation, recorded history, or a structure that supports deletion. A scalar has none of the three.

## The fix: record the answer at every point in time

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

That is the mechanism: the tuple is a **history of the answer**, one entry per frame. `getMin()` is just `stack[-1][1]`.

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

## The general shape: three ways to answer a historical question

Once you frame it as "restore a derived property after a removal," the Min Stack stops being a special case and becomes one point in a design space. There are only three ways to answer `P` after the data changes:

1. **Recompute.** Keep the data, scan it on demand. O(n) query, O(1) extra space. Perfectly valid when queries are rare.
2. **Record the answer.** Persist `P` at each point in time. O(1) query, O(n) history. Works when the undo is an *exact reversal* of the step that produced the state — as it is for a LIFO pop.
3. **Keep a structure that supports deletion.** When the answer can't be snapshotted cheaply, or removal isn't LIFO, maintain something that can delete efficiently: a heap with lazy deletion, a monotonic deque, a balanced tree, a segment tree.

The Min Stack picks option 2. That's why the tuple works: `push` appends a new answer, `pop` removes the last one, and the previous answer is already sitting there.

The same three options show up everywhere:

| Situation | Recompute | Record the answer | Deletion-aware structure |
| --- | --- | --- | --- |
| Stack minimum | scan the stack | tuple `(value, min)` | — |
| Sliding-window minimum | scan the window | doesn't work (FIFO) | monotonic deque |
| Range sum | sum the range | prefix sums | Fenwick tree |
| Median of a stream | sort on demand | — | two heaps |
| Undo in an editor | replay from scratch | command log / snapshots | — |
| Consistent read in a database | — | MVCC versions | — |

The right column isn't better than the middle one; it's for when the middle one breaks. And the middle one breaks precisely when **the order of removal doesn't match the order of recording**. A stack is the easy case: the element leaving is the element that arrived last, so the history lines up with the frames. A queue is not: the element leaving is the *oldest*, and the min-so-far stored at the tail says nothing about what happens when the head leaves. Same question, different structure.

This is also why "just cache the derived value" is not a complete strategy. A cache is option 2 without the undo path. It works until something is removed or invalidated — then you need to know what the value was before, or be able to recompute it. Event sourcing, MVCC, and version control are all the same admission: **if the current state is derived, the history is part of the state.**

> Recompute it, record it, or keep a structure that can delete. Those are the only three moves. The mistake is pretending a scalar is one of them.

## The takeaway

The stack was never the subject. It's the simplest setting for a much more common problem:

> **A property derived from data changes when the data changes. Reversing the change means restoring the property's previous value.**

The Min Stack answer is one extra slot per frame — not because tuples are clever, but because the minimum is a property of a *prefix*, and a prefix has a history. `push` extends the history, `pop` truncates it, `getMin` reads its end. The data structure didn't get smarter. It started remembering.

That's the transferable move. Whenever you maintain a running aggregate — a min, a max, a sum, a count, a flag, an invariant — ask two questions:

1. **Is this stored in the elements, or derived from the collection?**
2. **Can an element leave? If so, what does this property become when it does?**

If the answer to the second is "the value from before it arrived," you need history. A variable will happily hold the current answer and silently lie about the previous one.

Once you see that, `MinStack` is no longer a trick to memorize. It's the smallest example of a pattern you'll meet again in undo stacks, prefix sums, event logs, caches, and versioned data.

