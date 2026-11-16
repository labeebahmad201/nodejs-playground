# Linked List Cycle: The Gap Shrinks by One

*A hash set detects a cycle by remembering every node it has seen. Two pointers detect it with O(1) memory — and the reason is simple: inside a cycle, the faster pointer closes the distance to the slower one by exactly one node per step.*

Part of the [`leetcode/`](../) section.

---

## The problem

Given the head of a singly linked list, return `true` if the list contains a cycle and `false`
otherwise. A cycle exists when following `next` from some node eventually returns to a node that
was already visited.

```text
head = [3, 2, 0, -4], pos = 1

3 → 2 → 0 → -4
    ↑         │
    └─────────┘
```

The tail points back to the node holding `2`, so the sequence never reaches `None`. LeetCode uses
`pos` only to describe how the test case was built; `hasCycle` receives only `head`, so it has to
discover the repeat on its own.

The follow-up is the interesting part: can you solve it with **O(1)** extra memory?

## The direct solution: remember every node

The straightforward approach is to walk the list and keep a set of the nodes already visited.

```python
# ListNode and Optional are provided by LeetCode.
class Solution:
    def hasCycle(self, head: Optional[ListNode]) -> bool:
        seen = set()
        node = head

        while node:
            if node in seen:
                return True
            seen.add(node)
            node = node.next

        return False
```

If the list ends, `node` becomes `None` and the loop exits with `false`. If there is a cycle, some
node is reached a second time. That second visit can only happen by looping back, so the answer is
`true`.

The important detail is that `seen` stores **node references**, not values. Two different nodes can
both contain `1`, and that is not a cycle:

```text
1 → 1 → None        # duplicate value, no cycle
```

LeetCode's `ListNode` uses identity for hashing and equality, so `seen.add(node)` distinguishes
those two nodes. `seen.add(node.val)` would make this list look like a cycle. Values are data;
cycles are about revisiting the same node.

This version is O(n) time and O(n) space: each node is visited once, and the set can grow to n
entries.

## The O(1) idea: two pointers at different speeds

This is **Floyd's tortoise and hare**. Start both pointers at `head`. On each iteration:

- `slow` moves one node.
- `fast` moves two nodes.

If there is **no cycle**, `fast` reaches the end first. It either becomes `None` or is the last
node; the loop stops, and the answer is `false`.

If there is a **cycle**, neither pointer can leave it. Once both are inside, the faster pointer
closes the gap.

### Why the gap closes

Suppose both pointers are in a cycle of length `C`. Measure the gap as the number of forward steps
`fast` needs to reach `slow`. Each iteration, `slow` advances one node and `fast` advances two, so
`fast` gains one on `slow`: the gap decreases by exactly one.

A finite, non-negative gap that decreases by one each step must reach zero. It cannot jump from
`1` to `-1`, because the *relative* movement is one node, not two.

```text
cycle: A → B → C → D → A

start    slow = A, fast = C    gap = 2
step 1   slow = B, fast = A    gap = 1
step 2   slow = C, fast = C    gap = 0
```

The cycle length does not have to be even. The same walk on a three-node cycle:

```text
cycle: A → B → C → A

start    slow = A, fast = B    gap = 2
step 1   slow = B, fast = A    gap = 1
step 2   slow = C, fast = C    gap = 0
```

Both traces follow the same `2 → 1 → 0` sequence: a three-node cycle and a four-node cycle both
close the gap and meet. The starting gap is 2 in both cases, so the only thing that changed is the
cycle length — and it changed nothing. The relative speed is still one, so each step removes
exactly one from the gap. The parity of the cycle length (and of the list) does not affect the
meeting.

Both traces start once the pointers are already inside the cycle. Their exact starting positions
only change how long the gap takes to close.

What if `fast` looks like it is *ahead* of `slow`? On a circle, "ahead" and "behind" are relative.
The gap measured forward from `fast` to `slow` is still finite and still shrinks by one. If fast is
ahead, it laps around and approaches slow from behind. The argument does not depend on who is ahead
at any particular moment.

The fast pointer may also complete several laps while `slow` is still approaching the cycle. That
does not break anything: `fast` cannot leave the cycle, and once `slow` enters, the gap starts
shrinking by one per iteration.

### The code

```python
class Solution:
    def hasCycle(self, head: Optional[ListNode]) -> bool:
        if not head:
            return False

        slow = head
        fast = head

        while fast and fast.next:
            slow = slow.next
            fast = fast.next.next

            if slow == fast:
                return True

        return False
```

### Check after moving, not before

Both pointers start at `head`, so `slow == fast` is true before the loop even begins. If the
comparison happened at the top of the loop, every non-empty list would immediately return `true`.

The first meaningful comparison is after both pointers have moved. That is why the check sits at the
bottom of the loop body: after the moves, `slow` and `fast` may have landed on the same node.

`slow == fast` is an identity comparison here because `ListNode` does not define value equality;
`slow is fast` says the same thing more explicitly.

(The early `if not head` is not strictly necessary; the loop guard already handles an empty list,
since `fast` is `None`. It just makes that case explicit.)

### The loop guard

`while fast and fast.next` is what makes the two-step move safe:

- If `fast` is `None`, there is no node to advance.
- If `fast.next` is `None`, `fast` is the last node, and `fast.next.next` would dereference
  `None`.

Both checks are required. This guard is also the no-cycle exit: when it fails, `fast` has reached
the end of the list.

## Complexity

| Approach | Time | Space |
| --- | --- | --- |
| Hash set | O(n) | O(n) |
| Fast/slow pointers | O(n) | O(1) |

In the no-cycle case, `fast` reaches the end after at most `n / 2` iterations. In the cycle case,
`slow` reaches the cycle after at most `n` steps, and once both pointers are inside it, the gap
closes in at most `C ≤ n` more iterations. Either way, the total is O(n) time.

The pointer version does not improve the asymptotic time. It removes the set. The tradeoff is
memory: the hash set remembers every node, while the two pointers exploit the repetition and use
only two references.

## Tests worth keeping

LeetCode builds the test input from a `pos`, but the function only receives `head`. A small helper
makes the cases explicit:

```python
def build(values, pos):
    nodes = [ListNode(v) for v in values]
    for a, b in zip(nodes, nodes[1:]):
        a.next = b
    if pos != -1:
        nodes[-1].next = nodes[pos]
    return nodes[0] if nodes else None
```

```python
assert Solution().hasCycle(build([3, 2, 0, -4], 1)) is True   # LeetCode example 1
assert Solution().hasCycle(build([1, 2], 0)) is True          # LeetCode example 2
assert Solution().hasCycle(build([1], -1)) is False           # LeetCode example 3

assert Solution().hasCycle(build([], -1)) is False            # empty list
assert Solution().hasCycle(build([1], 0)) is True             # self-loop
assert Solution().hasCycle(build([1, 2], -1)) is False        # no cycle
assert Solution().hasCycle(build([1, 2, 3, 4], -1)) is False  # longer acyclic list
assert Solution().hasCycle(build([1, 2, 3, 4], 2)) is True    # tail back to the middle

assert Solution().hasCycle(build([1, 1, 1], -1)) is False     # duplicate values, no cycle
assert Solution().hasCycle(build([1, 1, 1], 0)) is True       # duplicate values, with cycle

# Every cycle length from 1 to 19, odd or even.
for n in range(1, 20):
    assert Solution().hasCycle(build(list(range(n)), 0)) is True
```

The loop over cycle lengths 1–19 makes the odd/even point explicit: every length meets. The
duplicate-value cases are the ones that catch a value-based `seen` set. The single-node self-loop
is the smallest cycle the fast/slow pointers can find.

## What generalizes

- **Floyd's tortoise and hare** is the name for the two-speed pattern. It works for any
  deterministic sequence that eventually repeats, not only linked lists.
- **Relative speed is the invariant.** Slow `+1` and fast `+2` means the gap decreases by one per
  step, so the faster pointer cannot skip over the meeting point. A relative speed greater than one
  can skip it when the cycle length shares a factor with the difference; a difference of one always
  lands on zero.
- **Hash set versus two pointers is a space tradeoff.** Both are O(n) time. The set pays O(n)
  memory to remember visited nodes; the pointers pay nothing extra by exploiting the repetition.
- **Compare identity, not value.** A repeated value is not a cycle. The cycle is about returning to
  the same node.
- **Move first, then compare.** The initial positions are equal by construction, so the first useful
  comparison is after both pointers advance.

## The takeaway

- A hash set detects a cycle by remembering every node; O(n) time and O(n) space.
- Two pointers detect it with O(1) space: `fast` moves two nodes, `slow` moves one, so inside a
  cycle the gap closes by exactly one per step.
- With no cycle, `fast` falls off the end; `while fast and fast.next` is the guard that makes the
  two-step move safe.
- Check after moving, and compare node identity rather than values.
- The pointer version does not beat the hash set on time. It wins on memory.
