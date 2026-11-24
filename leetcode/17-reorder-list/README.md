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

The return value is ignored by LeetCode, because the function is specified to edit the list in place; returning `dummy.next` is convenient for local testing and harmless on the judge.

## How much work it is

Collecting the nodes is one walk, and the interleaving makes one placement per node, so the time is `O(n)`. The array holds every node, so the space is `O(n)` beyond the existing list.

The follow-up asks for `O(1)` extra space, and the standard way is to use the list's own structure instead of an index. Find the middle with a slow pointer and a fast pointer, split the list after the middle, reverse the second half, and then merge the two halves alternately. Reversing is the trick that turns "take from the back" into "take from the front of the reversed half", which a singly linked list can do.

```python
class Solution:
    def reorderList(self, head: ListNode | None) -> None:
        if not head or not head.next:
            return

        # Middle: slow stops at the end of the first half.
        slow = fast = head
        while fast.next and fast.next.next:
            slow = slow.next
            fast = fast.next.next

        second = slow.next
        slow.next = None                 # split

        # Reverse the second half.
        prev = None
        while second:
            nxt = second.next
            second.next = prev
            prev = second
            second = nxt

        # Merge: first half in front, reversed half interleaved.
        first, second = head, prev
        while second:
            first_next, second_next = first.next, second.next
            first.next = second
            second.next = first_next
            first, second = first_next, second_next
```

The merge loop runs while the second half has nodes, because the second half is never longer than the first. For an even-length list the split leaves two equal halves; for an odd-length list the middle stays with the first half, which is exactly where the array version's guard puts it.

## Edge cases

A single node is returned unchanged: the loop places it once, the guard is false, and the final cut leaves its `next` as `None`. A two-node list places both nodes and terminates on the final cut, which is the smallest case that exposes a missing link.

Odd lengths exercise the guard, and the middle must end up exactly once in the result. Even lengths never trigger the guard on the last pair, because the right pointer moves below the left one after the final placement.

An empty list never occurs under the problem's constraints, but the array version handles it: `nodes` is empty, the loop does not run, and `dummy.next` is `None`. The `O(1)` version needs its early return for the same case.

## To remember

A singly linked list cannot be walked backwards, so the two-ended construction is done either with an index of the nodes or by reversing one half. The array version is the direct translation: collect, then place from `left` and `right` alternately.

The check to remember is `left <= right` after advancing `left`: it distinguishes "the right pointer still has a node" from "the left pointer just took the middle". Without it the middle of an odd list is placed twice and points at itself. And the final `tail.next = None` is what ends the new chain, since the last node still carries its old link.
