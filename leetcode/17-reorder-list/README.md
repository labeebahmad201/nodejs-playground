# Reorder List

*A singly linked list gives you forward movement only, and the reordering needs both ends at once. The way out is to stop walking the list and index it instead: put the nodes in an array, then merge from the two ends.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻↻

## The shape the problem asks for

The list `L0 → L1 → … → Ln` has to become `L0 → Ln → L1 → Ln-1 → …`, using the same nodes and changing only the links. The order alternates between the two ends, so the construction needs to take one node from the front, then one from the back, then from the front again.

That is the difficulty. A singly linked list lets you move forward cheaply and costs a full walk to reach the last node. Taking the last node once is fine; taking it, then the second-to-last, then the third-to-last means walking to the end over and over, and the total becomes quadratic. There is also no "previous" pointer, so after reaching the end there is no way to step back — the walk has to restart from the head each time.

## Indexing the nodes removes the problem

The simplification is to walk the list once and put every node into an array. The array stores the nodes themselves, not copies, so the nodes remain the ones from the input and rewriting their `next` pointers is still the in-place edit the problem asks for.

Once the nodes are in an array, `nodes[left]` and `nodes[right]` are both constant-time, the two pointers can move toward each other, and the fact that the list only goes forward stops mattering. The price is `O(n)` extra space, which is exactly what the follow-up question asks you to remove later.

## Interleaving with two pointers

The new list is built by linking, the same way any list is assembled: a dummy node holds the head so the first append is not a special case, and a `tail` pointer marks where the next node goes. On each turn the left node is appended and `left` advances; then, if anything is still unplaced on the right, the right node is appended and `right` retreats.

The old `next` pointers do not need to be cleared up front. Appending a node overwrites its `next` with whatever comes after it in the new order, and the very last appended node is given `next = None` after the loop, which terminates the result. The array is only an index into the nodes; the actual reordering happens in the links.

## The check that keeps the middle from being used twice

The guard matters on odd-length lists. After the left node is appended and `left` advances, the two pointers can meet on the same node. That node has not been placed yet, so it should be appended once — as the right node — and after that there is nothing left. The condition `left <= right` asks exactly that question: is there still an unplaced node at `right`?

Without the check, the surviving odd node is appended a second time and its `next` is set to itself. For `1 → 2 → 3`, the walk places 1, then 3, then 2 as the left pick; the right pointer is still at 2, so the unguarded code links 2 to itself and the result is a cycle. Written as a sequence, the correct placements are 1, 3, 2 and then stop, and the guard is what stops it.

This is the check worth remembering, because it is not about array bounds. Both indices stay valid; the problem is that they can describe the same node, and placing one node twice corrupts the chain.

## The line that linked the wrong node

The approach above is the one in the working notes, but the pasted version has one line that breaks it:

```python
tail = nodes[left]
left += 1

if left <= right:
    nodes[left].next = nodes[right]   # wrong node
    nodes[right].next = None
    tail = nodes[right]
```

After `tail = nodes[left]` and `left += 1`, the node that was just appended is `tail`, and the node to append next is `nodes[right]`. The line above instead writes into `nodes[left]`, which is the node after the one just appended — a node that is not in the new chain yet. The link that should connect `tail` to the right node is never made, and `tail.next` is still `None` from the previous iteration's cut.

On `1 → 2 → 3 → 4` the result is a single node:

```text
pick left 0:  tail.next = 1, 1.next = None          chain: 1
pick right 3: nodes[1].next = nodes[3]              2.next = 4
              nodes[3].next = None, tail = 4        but 1.next is still None

next round:   tail.next = nodes[1]                  4.next = 2, but 4 is
                                                     unreachable from 1

return dummy.next                                   [1]
```

The chain from the dummy ends at the first node because that node's `next` was cut and never reassigned. A two-element list is enough to catch it: `1 → 2` should come back unchanged, and this version returns `1`. The fix is one word — the link belongs on `tail`:

```python
tail.next = nodes[right]
```

## The corrected array version

```python
class Solution:
    def reorderList(self, head: ListNode | None) -> None:
        # Index every node; the array holds the original objects.
        nodes: list[ListNode] = []
        curr = head
        while curr:
            nodes.append(curr)
            curr = curr.next

        left, right = 0, len(nodes) - 1

        dummy = ListNode(0)
        tail = dummy

        while left <= right:
            # Take the next node from the front.
            tail.next = nodes[left]
            tail = nodes[left]
            left += 1

            # Take the next node from the back, unless the front just
            # consumed the middle of an odd-length list.
            if left <= right:
                tail.next = nodes[right]
                tail = nodes[right]
                right -= 1

        # The last node still points into the old order.
        tail.next = None
        return dummy.next
```

The per-pick `next = None` writes are gone as well, and they were never needed. The only link that has to be right at any moment is `tail`'s: each placement overwrites it with the node that follows, and the single cut after the loop ends the result. Writing into `nodes[left]` was aiming at the node that had already been placed, which is what made the earlier version cut the chain.

The return value is ignored by LeetCode, because the function is specified to edit the list in place; returning `dummy.next` is convenient for local testing and harmless on the judge.

## How much work it is

Collecting the nodes is one walk, and the interleaving makes one placement per node, so the time is `O(n)`. The array holds every node, so the space is `O(n)` beyond the existing list.

The follow-up asks for `O(1)` extra space, and the version from the notes gets there with the list's own structure instead of an index. It finds the middle with the fast/slow loop, splits the list after it, reverses the second half, and then merges the two halves one node at a time. Reversing is the trick that turns "take from the back" into "take from the front of the reversed half", which a singly linked list can do; the memory trade-off behind that move is worked out in [reversing instead of stacking](../techniques/reverse-instead-of-stack.md).

```python
class Solution:
    def reverseList(self, head: ListNode) -> ListNode:
        curr = head
        prev = None
        while curr:
            new_next = curr.next        # save it before rewiring
            curr.next = prev
            prev = curr
            curr = new_next
        return prev

    def reorderList(self, head: ListNode | None) -> None:
        slow = head
        fast = head.next

        while fast:
            slow = slow.next
            fast = fast.next.next if fast.next else None

        second_half = slow.next
        slow.next = None                # split

        new_list = self.reverseList(second_half)

        curr1, curr2 = head, new_list

        dummy = ListNode(0)
        tail = dummy

        while curr1 and curr2:
            tail.next = curr1
            tail = curr1
            curr1 = curr1.next

            tail.next = curr2
            tail = curr2
            curr2 = curr2.next

        # One half is exhausted; the other is already linked.
        tail.next = curr1 or curr2

        return dummy.next
```

The middle loop is the right-middle variant from [where the slow pointer lands](../techniques/fast-slow-pointers.md), and the two lines that cut the list are [splitting a linked list at the middle](../techniques/splitting-a-linked-list.md). On even lengths it stops one node later than the left-middle loop, so `second_half` is shorter than the first half; for `[1, 2, 3, 4]` it is just `[4]`. That still produces the right sequence. The merge pairs one node from each half until the shorter one runs out, and whatever remains of the first half is the middle run in its original order, which is exactly the tail of the target. On `[1..6]` the halves are `[1, 2, 3, 4]` and `[6, 5]`; after the pairs `1-6` and `2-5`, the leftover `[3, 4]` is appended, giving `1, 6, 2, 5, 3, 4`.

The merge is the dummy/tail construction again, and the last line is the technique from [attaching the remainder](../techniques/merge-remainder.md). Because the first half is strictly longer in this split, only `curr1` can survive the loop; `curr1 or curr2` states the general rule anyway, and the remaining chain is already linked in the order it needs to appear.

`reverseList` is the standard three-pointer rewire, and it is worth being precise about its end state. When the loop exits, `curr` is `None` — that is why the loop stopped — and `prev` is the last node processed, which is the new head. Returning `curr` returns `None`; `prev` is the return value that carries the list.

The left-middle loop is the alternative split. It gives balanced halves on even lengths, which is why the palindrome and merge-style splits prefer it; both splits are correct for reorder, and the difference is only which half carries the leftover nodes.

## Edge cases

A single node is returned unchanged: the loop places it once, the guard is false, and the final cut leaves its `next` as `None`. A two-node list places both nodes and terminates on the final cut, which is the smallest case that exposes a missing link.

Odd lengths exercise the guard, and the middle must end up exactly once in the result. Even lengths never trigger the guard on the last pair, because the right pointer moves below the left one after the final placement.

An empty list never occurs under the problem's constraints, but the array version handles it: `nodes` is empty, the loop does not run, and `dummy.next` is `None`. The `O(1)` version needs its early return for the same case.

## To remember

A singly linked list cannot be walked backwards, so the two-ended construction is done either with an index of the nodes or by reversing one half. The array version is the direct translation: collect, then place from `left` and `right` alternately.

The check to remember is `left <= right` after advancing `left`: it distinguishes "the right pointer still has a node" from "the left pointer just took the middle". Without it the middle of an odd list is placed twice and points at itself. And the final `tail.next = None` is what ends the new chain, since the last node still carries its old link.
