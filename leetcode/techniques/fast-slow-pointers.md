# Where the Slow Pointer Lands

*Two pointers moving at different speeds find the middle, but "the middle" is two different nodes when the list has even length. Which one you get is decided by where `fast` starts and what the loop condition allows, and those two choices are worth understanding separately from any one problem.*

Part of the [`leetcode/`](../) techniques.

> **Revisit later.** ↻↻

## The loop from the notes

```python
slow = head
fast = head.next

while fast:
    slow = slow.next
    fast = fast.next.next if fast.next else None
```

The idea is the one everyone states: fast covers two nodes per step, slow covers one, so when fast runs off the end, slow has covered half the distance. The part that needs checking is what "half" rounds to, and what happens at the last step when there is only one node left to cover.

## Five nodes, traced

```text
list:  1 → 2 → 3 → 4 → 5

init   slow = 1, fast = 2
step 1 slow = 2, fast = 4          fast: 2 → 4
step 2 slow = 3, fast = None       fast: 4 → 5 → off the end
stop   slow = 3
```

```text
1 → 2 → 3 → 4 → 5
        ↑
      slow
```

On an odd-length list the landing is the exact middle: two nodes before it, two after it.

## Six nodes, traced

```text
list:  1 → 2 → 3 → 4 → 5 → 6

init   slow = 1, fast = 2
step 1 slow = 2, fast = 4
step 2 slow = 3, fast = 6
step 3 slow = 4, fast = None       fast: 6 → off the end
stop   slow = 4
```

```text
1 → 2 → 3 → 4 → 5 → 6
            ↑
          slow
```

With an even number of nodes there is no single middle. The loop lands on the **right** middle, node 4, not node 3. That is not a rounding accident; it is the consequence of the starting offset and the loop condition, and it is the thing to remember when a later step expects the other middle.

## The landing rule

Across lengths, this variant always stops at index `floor(n / 2)` counting from zero, which is node `floor(n / 2) + 1` counting from one.

```text
n            1  2  3  4  5  6  7  8  9 10
slow node    1  2  2  3  3  4  4  5  5  6
              ↑     ↑     ↑     ↑     ↑
            odd   even  odd   even  odd
```

For odd `n` that is the exact middle. For even `n` it is the right-hand middle. The first half, if you split the list at `slow`, is one node longer than the second on even lengths.

## Why `fast` starts at `head.next`

The loop condition is `while fast`, not `while fast and fast.next`, and the body advances `slow` before checking whether `fast` can take its second step. That makes the number of iterations depend on where `fast` begins.

With the head start, at the top of iteration `k` the fast pointer is at index `1 + 2k`, and the loop continues while that index is below `n`. The number of iterations is the smallest `k` with `1 + 2k >= n`, which is `ceil((n - 1) / 2)`, equal to `floor(n / 2)`. Since `slow` starts at index 0 and advances once per iteration, it ends at `floor(n / 2)`.

Remove the head start and the count becomes `ceil(n / 2)`. That is the same as `floor(n / 2)` for even `n` but one larger for odd `n`, and the trace shows exactly where the extra step goes:

```text
list:  1 → 2 → 3 → 4 → 5,  fast starts at head

init   slow = 1, fast = 1
step 1 slow = 2, fast = 3
step 2 slow = 3, fast = 5
step 3 slow = 4, fast = None      one step too far
stop   slow = 4                   the middle was 3
```

On a single-node list the same mistake is worse: `slow` advances to `None`, and the middle becomes nothing at all. So `fast = head.next` is the offset that pays for the body advancing `slow` on the iteration where `fast` is the last node. It is a parity correction, not a style choice.

## Why the conditional on `fast.next`

The loop can enter with `fast` pointing at the last node, where there is no second step to take. The conditional turns that into `None` and ends the loop; without it, the expression dereferences a null `next`.

The detail worth knowing is exactly when this happens. On odd lengths the last entered `fast` is the second-to-last node, so `fast.next.next` is a valid (null) expression and the guard never fires. On every even length the last entered `fast` is the final node, and the guard is what handles it.

```text
n = 4, without the guard

init   slow = 1, fast = 2
step 1 slow = 2, fast = 4
step 2 slow = 3, fast = 4.next.next  →  4.next is None  →  AttributeError
```

So the guard is not defensive coding for an unlikely case. It is required for half of all input lengths.

## The other middle

The loop that uses the other condition lands one node earlier on even lengths:

```python
slow = fast = head
while fast.next and fast.next.next:
    slow = slow.next
    fast = fast.next.next
```

Its landing is `floor((n - 1) / 2)`, which is the exact middle for odd `n` and the **left** middle for even `n`.

```text
n            1  2  3  4  5  6  7  8  9 10
right middle 1  2  2  3  3  4  4  5  5  6     (the first loop)
left middle  1  1  2  2  3  3  4  4  5  5     (this loop)
```

The two loops perform the same traversal; the second uses the `fast.next` half of its condition to stop before the step that the first pays for with its head start. Knowing that they differ by one node on even input is more useful than memorising either one, because the choice changes the split.

## Which middle a solution wants

For a problem that returns the middle node, the definition decides. LeetCode 876 defines the middle as the second of the two for even lengths, so the first loop is the right tool.

For a problem that splits the list into two halves, the left middle usually is, because splitting at `slow.next` then gives halves of size `ceil(n / 2)` and `floor(n / 2)`. With the right-middle loop on even `n`, `slow.next` begins the second half one node late, and the sizes become `n / 2 + 1` and `n / 2 - 1`. That is why the constant-space reorder solution in [`17-reorder-list`](../17-reorder-list) uses the left-middle loop even though the array version never needs a middle at all.

For a palindrome check the same split applies, with the extra detail that on odd lengths the exact middle must not be included in the reversed half; `slow.next` handles that automatically.

## Edge cases

An empty list breaks the initialiser before the loop is reached, because `head.next` dereferences `None`; a guard at the top is required if the input can be empty. A single node never enters the loop with the head start, so `slow` stays at the head, which is correct.

A two-node list runs exactly one iteration and lands on the second node, the right middle. That is the smallest case where the two loops disagree, and the cheapest one to test.

## Mistakes

Starting `fast` at `head` while keeping `while fast` produces the overshoot traced above: one node past the middle on odd lengths, and `None` on a single node. The fix is either the head start or the stronger loop condition, and mixing half of one with half of the other is what creates the bug.

Dropping the `fast.next` guard raises `AttributeError` on every even-length list, at the final iteration, which makes it look like an intermittent failure when the tests mix lengths.

Expecting the left middle from the right-middle loop shifts every even-length split by one, and the symptom appears later: an unbalanced half, a reversed section that starts on the wrong node, or a merge that leaves one node out.

## To remember

Fast moves twice as fast as slow, so slow covers half the distance; the head start and the loop condition decide whether that half rounds to the left node or the right one. In this variant, `fast = head.next` with `while fast` lands on `floor(n / 2)`, the exact middle for odd lists and the right middle for even ones, and the `fast.next` conditional is what keeps every even list from raising at its last step.

The number to carry is the landing index, not the loop. The rest of the solution follows from whether it needs that node, the node before it, or the node after it.
