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

The idea is the one everyone states: fast covers two nodes per step, slow covers one, so when fast runs off the end, slow has covered half the distance. The part that needs checking is what "half" rounds to, and what happens at the last step when there is only one node left to cover. The frames below mark `s` for `slow` and `f` for `fast`, one frame per iteration, so the gap between the markers is the thing to watch.

## Five nodes, frame by frame

```text
1 → 2 → 3 → 4 → 5
↑   ↑
s   f
```

```text
1 → 2 → 3 → 4 → 5
    ↑       ↑
    s       f
```

```text
1 → 2 → 3 → 4 → 5
        ↑
        s
```

In the first frame the two markers are neighbours. Each iteration moves `f` two nodes and `s` one, so the gap widens by one node per step, and in the third frame `f` has stepped off the end while `s` sits on the middle node. Two nodes are on each side of it.

## Six nodes, frame by frame

```text
1 → 2 → 3 → 4 → 5 → 6
↑   ↑
s   f
```

```text
1 → 2 → 3 → 4 → 5 → 6
    ↑       ↑
    s       f
```

```text
1 → 2 → 3 → 4 → 5 → 6
        ↑           ↑
        s           f
```

```text
1 → 2 → 3 → 4 → 5 → 6
            ↑
            s
```

Same widening gap, one more iteration. This time `s` stops on node 4. Nodes 1, 2 and 3 are behind it and nodes 5 and 6 are ahead, so the list is not split evenly: the first half is one node longer. That is the right-hand middle.

## The landing rule

For every length this loop stops `slow` at index `floor(n / 2)`, which is node `floor(n / 2) + 1` counting from one. On odd lengths that is the exact middle, the node with the same number of nodes on either side. On even lengths it is the right-hand one of the two candidates.

```text
odd:   1 → 2 → 3 → 4 → 5
                ↑
          same on both sides

even:  1 → 2 → 3 → 4 → 5 → 6
            ↑
      one of two candidates
```

Which candidate is decided by the loop, not by the list, and that is the subject of the rest of the note.

## Why `fast` starts at `head.next`

The loop condition is `while fast`, not `while fast and fast.next`, and the body advances `slow` before checking whether `fast` can take its second step. That makes the number of iterations depend on where `fast` begins.

With the head start, at the top of iteration `k` the fast pointer is at index `1 + 2k`, and the loop continues while that index is below `n`. The number of iterations is the smallest `k` with `1 + 2k >= n`, which is `ceil((n - 1) / 2)`, equal to `floor(n / 2)`. Since `slow` starts at index 0 and advances once per iteration, it ends at `floor(n / 2)`.

Remove the head start and the count becomes `ceil(n / 2)`. That is the same as `floor(n / 2)` for even `n` but one larger for odd `n`, and the frames show exactly where the extra step goes:

```text
1 → 2 → 3 → 4 → 5
↑
s,f
```

```text
1 → 2 → 3 → 4 → 5
    ↑   ↑
    s   f
```

```text
1 → 2 → 3 → 4 → 5
        ↑       ↑
        s       f
```

```text
1 → 2 → 3 → 4 → 5
            ↑
            s
```

The gap closes differently here because both markers start on the same node. Three iterations instead of two, and `s` walks past the middle to node 4. On a single-node list the same mistake is worse: `fast` is the only node, so the loop still enters once, `s` advances to `None`, and the middle becomes nothing at all.

```text
1
↑
s,f          the loop enters once and s leaves the list
```

So `fast = head.next` is the offset that pays for the body advancing `slow` on the iteration where `fast` is the last node. It is a parity correction, not a style choice.

## Why the conditional on `fast.next`

The loop can enter with `fast` pointing at the last node, where there is no second step to take. The conditional turns that into `None` and ends the loop; without it, the expression dereferences a null `next`.

The detail worth knowing is exactly when this happens. On odd lengths the last entered `fast` is the second-to-last node, so `fast.next.next` is a valid (null) expression and the guard never fires. On every even length the last entered `fast` is the final node, and the guard is what handles it.

```text
1 → 2 → 3 → 4
        ↑   ↑
        s   f
```

Here `f` sits on the last node, so `f.next` is `None` and there is no second node to step through. Without the guard, the next line asks `None.next` and the call dies with `AttributeError`. The guard is not defensive coding for a rare case; it is required for half of all input lengths.

## The other middle

The loop that uses the other condition lands one node earlier on even lengths:

```python
slow = fast = head
while fast.next and fast.next.next:
    slow = slow.next
    fast = fast.next.next
```

Its landing is `floor((n - 1) / 2)`, which is the exact middle for odd `n` and the left middle for even `n`. On the same six-node list the two loops finish like this:

```text
1 → 2 → 3 → 4 → 5 → 6
        ↑   ↑
      left  right
```

The left arrow is where `while fast.next and fast.next.next` stops; the right arrow is where the loop at the top of this note stops. The two loops perform the same traversal, with the second using the `fast.next` half of its condition to stop before the step that the first pays for with its head start.

## Which middle a solution wants

For a problem that returns the middle node, the definition decides. LeetCode 876 defines the middle as the second of the two for even lengths, so the right-middle loop is the right tool.

For a problem that splits the list into two halves, the left middle usually is, because splitting at `slow.next` then gives halves of size `ceil(n / 2)` and `floor(n / 2)`; the cut itself is [splitting a linked list at the middle](./splitting-a-linked-list.md). With the right-middle loop on even `n`, `slow.next` begins the second half one node late, and the sizes become `n / 2 + 1` and `n / 2 - 1`. That is why the constant-space reorder solution in [`17-reorder-list`](../17-reorder-list) can use either split and lets the merge absorb the leftover, while a palindrome check uses the balanced one.

## Edge cases

An empty list breaks the initialiser before the loop is reached, because `head.next` dereferences `None`; a guard at the top is required if the input can be empty. A single node never enters the loop with the head start, so `slow` stays at the head, which is correct.

```text
n = 1    1
         ↑
         s        f never enters the loop

n = 2    1 → 2
             ↑
             s    one iteration, f off the end
```

Two nodes is the smallest case where the two loops disagree, and the cheapest one to test.

## Mistakes

Starting `fast` at `head` while keeping `while fast` produces the overshoot traced above: one node past the middle on odd lengths, and `None` on a single node. The fix is either the head start or the stronger loop condition, and mixing half of one with half of the other is what creates the bug.

Dropping the `fast.next` guard raises `AttributeError` on every even-length list, at the final iteration, which makes it look like an intermittent failure when the tests mix lengths.

Expecting the left middle from the right-middle loop shifts every even-length split by one, and the symptom appears later: an unbalanced half, a reversed section that starts on the wrong node, or a merge that leaves one node out.

## To remember

Fast moves twice as fast as slow, so slow covers half the distance; the head start and the loop condition decide whether that half rounds to the left node or the right one. In this variant, `fast = head.next` with `while fast` lands on `floor(n / 2)`, the exact middle for odd lists and the right middle for even ones, and the `fast.next` conditional is what keeps every even list from raising at its last step.

The number to carry is the landing index, not the loop. The rest of the solution follows from whether it needs that node, the node before it, or the node after it.
