# Reverse Linked List: Save the Next Before You Break It

*Reversing a singly linked list is not about moving nodes. It is about rewiring one `next` at a time — and the link you are about to overwrite is also your only way forward.*

Part of the [`leetcode/`](../) section.

---

## The problem

Given the head of a singly linked list, reverse the list and return the new head.

```text
before:  1 → 2 → 3 → 4 → 5 → None
after:   None ← 1 ← 2 ← 3 ← 4 ← 5
```

The nodes do not move. The arrows change direction. The old head becomes the new tail, so its
`next` becomes `None`; the old tail becomes the new head.

An empty list stays empty, and a single node is already its own reverse.

## The trap: the way forward is also the thing you overwrite

To reverse the link at the current node, you set:

```python
curr.next = prev
```

But before that assignment, `curr.next` is the only reference to the rest of the list. Overwrite it
first, and the suffix is gone — there is no way to reach the next node. After the assignment,
`curr.next` points backward, so using it to advance would walk into the already-reversed part — or
into `None` — rather than the next unprocessed node.

So the order is not optional:

1. Save the next node: `next_node = curr.next`.
2. Reverse the link: `curr.next = prev`.
3. Advance: `prev = curr`, then `curr = next_node`.

That is the entire algorithm. Everything else is naming the invariant and getting the initial
values right.

## The loop in slow motion

Take the three-node list `A → B → C`. Start with `prev = None` and `curr = A`.

| Iteration | `next_node` | `curr.next` becomes | `prev` after | `curr` after |
| --- | --- | --- | --- | --- |
| start | — | — | `None` | `A` |
| 1 | `B` | `None` | `A` | `B` |
| 2 | `C` | `A` | `B` | `C` |
| 3 | `None` | `B` | `C` | `None` |

After the third iteration, the state is:

```text
None ← A ← B ← C
               ↑
               prev
```

`curr` is `None`, so the loop stops. `prev` points at `C`, the old tail and the new head. Returning
`prev` is therefore returning the reversed list.

## The code

```python
# ListNode is provided by LeetCode.
class Solution:
    def reverseList(self, head: ListNode | None) -> ListNode | None:
        prev = None
        curr = head

        while curr:
            next_node = curr.next   # save the way forward
            curr.next = prev        # reverse the link
            prev = curr             # advance prev
            curr = next_node        # advance curr using the saved link

        return prev
```

## Why `prev` starts as `None`

The first node has no predecessor in the original list, and after reversal it has no successor. On
the first iteration, `curr` is the old head and `prev` is `None`, so:

```python
curr.next = None
```

That is exactly right: the old head becomes the new tail.

`prev = None` is not a placeholder waiting to be replaced. It is the real value of "nothing before
the new tail." In other linked-list problems, a dummy node often stands before the head; here the
missing predecessor is the sentinel, and `None` is the correct initial value.

At the end, the same variable points at the old tail, which is the new head. One variable, two
boundary roles, and the loop moves it from one end to the other.

## The invariant

At the start of each iteration:

- `prev` is the head of the already-reversed prefix, or `None` if the prefix is empty.
- `curr` is the head of the not-yet-reversed suffix, or `None` if the suffix is empty.
- Every node before `curr` has its `next` pointing backward.
- Every node from `curr` onward still points forward in the original order.

```text
None ← ... ← prev    curr → ... → None
              ↑       ↑
         reversed    not yet reversed
```

Each iteration takes exactly one node from the suffix and makes it the new head of the prefix. The
loop ends when the suffix is empty, at which point `prev` is the head of the fully reversed list.

## Why the loop condition is `while curr`

Every node needs to be processed, including the last one. If the loop were `while curr.next`, the
final node would never have its `next` rewired. The loop would stop with `prev` at the
second-to-last node, and the old tail would still point at `None`, leaving it out of the returned
list.

`while curr` processes the last node, points it at its predecessor, and then advances `curr` to
`None`. That is the iteration that links the new head to the list.

## Complexity

- **Time: O(n).** Each node is visited once, and each iteration does constant work.
- **Space: O(1).** Only `prev`, `curr`, and `next_node` are used. The list is rewired in place; no
  new nodes are allocated.

The recursive version reverses the rest of the list first and then points the next node back at the
current one. It is elegant, but it uses O(n) stack space, so the iterative version is the one that
satisfies the O(1)-space follow-up.

Why the iterative version is worth preferring when a solution needs to read a list from the back,
rather than pushing the nodes onto a stack, is in
[reversing instead of stacking](../techniques/reverse-instead-of-stack.md).

## Tests worth keeping

```python
def build(values):
    dummy = ListNode()
    tail = dummy
    for value in values:
        tail.next = ListNode(value)
        tail = tail.next
    return dummy.next


def to_list(head):
    values = []
    while head:
        values.append(head.val)
        head = head.next
    return values
```

```python
assert to_list(Solution().reverseList(build([1, 2, 3, 4, 5]))) == [5, 4, 3, 2, 1]
assert to_list(Solution().reverseList(build([1, 2]))) == [2, 1]
assert to_list(Solution().reverseList(build([1]))) == [1]
assert to_list(Solution().reverseList(build([]))) == []
assert to_list(Solution().reverseList(build([1, 1, 2]))) == [2, 1, 1]
```

A few structural checks are worth more than another value assertion:

```python
original = build([1, 2, 3])
new_head = Solution().reverseList(original)

assert to_list(new_head) == [3, 2, 1]
assert new_head.next.next.next is None   # the new tail ends the list
assert original.next is None             # the old head is now the tail
```

The last assertion is the direct test of `prev = None`: if the old head still pointed anywhere, the
new tail would not be a tail.

I also compared the function against `values[::-1]` on random lists. That catches pointer mistakes
that the hand-picked cases can miss.

## What generalizes

- **Save the link before you break it.** Any in-place mutation of a linked structure has this shape:
  keep a temporary reference to whatever you still need before overwriting the field that reaches
  it.
- **`prev` / `curr` / `next` is the standard reversal boundary.** The same three-pointer dance
  reverses a sublist, reverses nodes in k-groups, and prepares a list for palindrome or reorder
  checks.
- **`prev = None` is the sentinel for the new tail.** The old head's missing predecessor becomes its
  new successor. That is why the initial value is `None`, not a dummy node.
- **Loop over nodes, not links.** `while curr` includes the last node; `while curr.next` stops one
  node too early for a full reversal.
- **Recursion is the same rewiring from the other end.** It reverses the tail first, then connects
  the current node to its successor, at the cost of stack space.

## The takeaway

- Reversal changes `next` pointers, not node positions.
- Save `curr.next` before overwriting it, or the rest of the list is unreachable.
- `prev` starts as `None` because the old head becomes the new tail.
- Each iteration moves one node; return `prev`, which becomes the new head.
- O(n) time, O(1) space, and the loop must process every node.
