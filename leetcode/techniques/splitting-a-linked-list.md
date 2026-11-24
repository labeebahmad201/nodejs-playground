# Splitting a Linked List at the Middle

*A singly linked list has no notion of halves. To get two lists, cut the only link between them: save the node after the middle, then set the middle's `next` to `None`.*

Part of the [`leetcode/`](../) techniques.

> **Revisit later.** ↻

## Why a cut is needed

Half the algorithms that work on linked lists want two independent lists. Reorder wants the second half reversed and merged back; a palindrome wants the second half reversed and compared; merge sort wants each half sorted separately. Until the list is cut, the first half still runs into the second, so a traversal that expects to stop at the middle walks into the wrong nodes instead.

## The two lines

```python
second = slow.next      # hold the start of the second half
slow.next = None        # cut the only link between the halves
```

```text
before   1 → 2 → 3 → 4 → 5 → 6
                    ↑
                   slow

after    1 → 2 → 3 → 4   5 → 6
                    ↑   ↑
                  slow second
```

The first half is now a proper list that ends at `slow`. The second half is still a proper list that ends at the old tail, and `second` is its head. Nothing was copied and no node was moved.

## The order is not optional

Cutting before saving loses the second half:

```python
slow.next = None
second = slow.next      # None: the cut destroyed the only pointer to 5
```

`slow.next` was the only reference to the rest of the list after `slow`. The four nodes of the first half survive because they are still reachable from `head`; the second half has nothing pointing at it. Saving the junction first is the whole trick, and it costs one variable.

## Which node ends the first half

That depends on the loop that found the middle. The right-middle loop from [`fast-slow-pointers`](./fast-slow-pointers.md) leaves the first half one node longer on even lengths; the left-middle loop splits evenly. Both cuts are valid; what changes is the size of each half and therefore which side a later merge runs out of first.

## What the cut changes

The first half now terminates at `slow`, so every traversal of it stops where the split was made. That is what makes a merge predictable: without the cut, the last node of the first half still points into the second half, and advancing through the first half eventually walks into the reversed half. In the reorder merge that produces a cycle or a duplicated suffix rather than a finished list.

The second half is untouched by the cut, which is why reversing it afterwards affects only that half.

## An empty second half

With the right-middle loop, a two-node list puts `slow` on the last node, so `slow.next` is `None` and the second half is empty. With the left-middle loop, only a one-node list gets there. The code after the cut has to tolerate `second = None`; the reorder merge does it naturally, because `while curr1 and curr2` never runs and `curr1 or curr2` attaches the whole first half.

## Rejoining

The junction is still `slow`, so `slow.next = second` puts the list back together, provided the second half still starts at `second` and its internal links have not changed. Most algorithms never restore: they are building a new arrangement from the two halves, so the original list is not wanted.

## Where it appears

Reorder List splits, reverses the second half, and merges. A palindrome check splits, reverses the second half, and compares the two halves inward. Merge sort on a linked list splits at the middle, sorts each half, and merges. The two lines are the same in all three.

## To remember

Save `second` first, then set `slow.next = None`. The cut is what makes the halves independent, and the saved pointer is the only way back into the second one.
