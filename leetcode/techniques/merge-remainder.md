# Attaching the Remainder After a Merge

*A pairwise merge ends with one list exhausted and the other still holding a chain. That chain is already linked, so finishing the merge is one assignment: `tail.next = curr1 or curr2`.*

Part of the [`leetcode/`](../) techniques.

> **Revisit later.** ↻

## The skeleton

```python
dummy = tail = ListNode(0)

while curr1 and curr2:
    # take the smaller node, attach it, advance that side
    ...

tail.next = curr1 or curr2

return dummy.next
```

## One assignment is enough

The remainder is a chain, not a collection: every node already points to its successor. Attaching its head attaches everything behind it, in constant time, with no traversal and no copying.

The loop only stops when one side is empty, so there is nothing left to compare. Whatever remains on the other side belongs at the end, in the order it already has.

## Why `or` works

Python's `or` returns the first operand that is truthy. A node is truthy and `None` is falsy, so `curr1 or curr2` evaluates to whichever list still has nodes, and to `None` if both are empty. It is an if/else that returns a value instead of running a statement.

## How much can be left

The loop runs only while both lists are non-empty, and each iteration advances exactly one of them, so the other is untouched. When the loop ends, at most one side is non-empty; with non-empty inputs, exactly one. Both are empty only if both inputs started empty, and then `tail.next = None` is the correct empty result.

## In a value merge

When one list runs out, the rest of the other is already sorted, and every node in it is at least as large as the last node appended. Attaching the whole chain is therefore the same as merging the rest one node at a time. This is the short version of the merge in [`12-merge-two-sorted-lists`](../12-merge-two-sorted-lists).

## In the reorder join

The split is uneven when it uses the right-middle loop, so the remainder can be more than one node. Those nodes are the middle run of the original list, in order, and that run is exactly the end of the target sequence. On `[1..6]` the merge pairs `1-6` and `2-5`, then attaches the leftover `3-4` to produce `1, 6, 2, 5, 3, 4`.

## When it is not safe

If the remaining nodes still have to be interleaved with the other side, attaching them is wrong: the loop has to continue. The idiom claims "everything left belongs at the end, in order", and it assumes the loop stopped because one side ran out rather than because of an early `break` or a cap on the number of iterations.

It also has to be a node, not a value. `or` on numbers treats `0` as empty and would skip a real element.

## The same idiom at the base case

A recursive merge can open with `if not a or not b: return a or b`. The question is identical — which list still has nodes? — asked before the loop instead of after it.

## Pitfalls

`and` is the wrong operator here: it returns the second list when both are truthy, which is not the remainder, and it returns `None` as soon as either side is empty.

`tail = curr1 or curr2` moves the cursor without attaching anything; the link is made by `tail.next = ...`.

Reading a value instead of the node, as in `curr1.val or curr2.val`, can drop a legitimate zero and cannot be attached at all.

## To remember

The loop consumes pairs; whatever is left is one pre-linked chain; `or` picks it because `None` is falsy. One line, no branches.
