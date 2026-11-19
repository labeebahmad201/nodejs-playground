# Merge Two Sorted Lists

*Two sorted lists go in, one sorted list comes out. A dummy node removes the "which node is the head?" special case, and a tail pointer keeps track of where the next node gets attached. The two classic bugs are returning the tail instead of the dummy, and forgetting to move the tail at all.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻ Short code, two pointer bugs. Worth re-solving until the dummy/tail split is automatic.

---

## The problem

You get the heads of two sorted linked lists. Splice their nodes into one sorted list and return its head.

```text
list1 = 1 → 2 → 4
list2 = 1 → 3 → 4

result = 1 → 1 → 2 → 3 → 4 → 4
```

The values can repeat, so the order is non-decreasing, not strictly increasing. The nodes are reused, not copied, which is what keeps the extra space at O(1).

## The shape of the solution

Walk both lists with two pointers. At each step, take the smaller node, attach it to the end of the result, and move that list's pointer forward. When one list runs out, attach whatever is left of the other.

The result list needs two references:

```text
dummy → 1 → 1 → 2 → 3 → 4 → 4 → None
  ↑                             ↑
start of the result          tail, where the next node goes
```

- `dummy` never moves. It exists only so that the first append is not a special case, and it gives a fixed place to return from: `dummy.next`.
- `tail` always points at the last node of the merged list. Attaching is `tail.next = node`, then `tail = tail.next`.

That second line is the one people forget. Without it, the next append overwrites the previous link.

## Step by step

`list1 = [1, 2, 4]`, `list2 = [1, 3, 4]`

| Step | `curr1` | `curr2` | Take | Merged so far | `tail` |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | 1 | `curr2` (tie) | `1` | 1 |
| 2 | 1 | 3 | `curr1` | `1 → 1` | 1 |
| 3 | 2 | 3 | `curr1` | `1 → 1 → 2` | 2 |
| 4 | 4 | 3 | `curr2` | `1 → 1 → 2 → 3` | 3 |
| 5 | 4 | 4 | `curr2` (tie) | `1 → 1 → 2 → 3 → 4` | 4 |
| 6 | 4 | — | `curr1` | `1 → 1 → 2 → 3 → 4 → 4` | 4 |

Then return `dummy.next`.

On a tie, either node works. This version takes from `list2` when the values are equal, which is why step 1 and step 5 pick `curr2`.

## The code

```python
class Solution:
    def mergeTwoLists(
        self, list1: ListNode | None, list2: ListNode | None
    ) -> ListNode | None:
        curr1, curr2 = list1, list2

        # Dummy head: every append has a previous node to attach to.
        dummy = ListNode(0)
        tail = dummy

        # `or`, not `and`: keep going while either list still has nodes.
        while curr1 or curr2:
            if curr1 and curr2:
                # Take the smaller one. On a tie, either is fine.
                if curr1.val < curr2.val:
                    tail.next = curr1
                    curr1 = curr1.next
                else:
                    tail.next = curr2
                    curr2 = curr2.next
            elif curr1:                 # list2 is finished
                tail.next = curr1
                curr1 = curr1.next
            else:                       # list1 is finished
                tail.next = curr2
                curr2 = curr2.next

            # Move the tail onto the node just attached.
            tail = tail.next

        # `dummy.next`, never `tail`: tail is the end of the list now.
        return dummy.next
```

`tail` is never `None` inside the loop, because every branch attaches a real node before `tail = tail.next`. That is why the `if tail:` guard is unnecessary.

## Why the dummy node

Without it, the first append has no previous node:

```python
if head is None:
    head = node            # first node: special case
else:
    tail.next = node       # every other node
tail = node
```

The dummy removes the branch by acting as the "previous node" for the very first append. It also gives a uniform return: `dummy.next` is the head whether the result has zero, one, or twenty nodes.

The dummy's value is never used. `ListNode(0)` is fine.

## The two pointer mistakes

### 1. Returning `tail` instead of `dummy.next`

`tail` walks to the end. By the end of the loop it points at the last node, so returning it returns a one-node list (or a suffix).

```text
[1, 2] merged with [3]  →  1 → 2 → 3
                              ↑
                           tail here

return dummy.next  → [1, 2, 3]   correct
return tail        → [3]         wrong
return tail.next   → []          wrong
```

The same mistake on the bigger example (`[1,2,4]` and `[1,3,4]`) returns `[4]`.

The rule: **`dummy` is the anchor, `tail` is the cursor.** Return the anchor, move the cursor.

### 2. Forgetting `tail = tail.next`

Attaching without advancing means the next append overwrites the previous link:

```text
tail.next = 1        dummy → 1
# no advance
tail.next = 2        dummy → 2      ← 1 is gone

then attach the rest (3):

dummy → 3
```

That is why `[1,2]` and `[3]` produces `[3]` when the advance is missing: both `1` and `2` were overwritten at `dummy.next`.

Every attach must come with a move. The pair is one operation:

```python
tail.next = node
tail = tail.next
```

## Other things worth knowing

**The loop condition is `or`, not `and`.** With `and`, the loop stops as soon as one list empties and the rest of the other list is never attached.

**`curr1 = curr1.next` protects the variable, not the nodes.** The input lists are still rewired: the merged result is built from the original nodes, so the caller's lists are consumed. Copying nodes would keep the inputs intact and cost O(m + n) space, which the problem does not ask for.

**Do not call `.next` on a possibly-`None` pointer.** The three branches above only touch a pointer in the branch where it is known to be non-`None`. Folding them into one comparison without that check is how `AttributeError: 'NoneType' object has no attribute 'next'` happens.

## A shorter version of the same loop

The three-branch loop above does one append per node, so it runs `m + n` times. A two-branch loop stops when the shorter list runs out, then attaches the remainder in one step:

```python
dummy = tail = ListNode(0)

while list1 and list2:
    if list1.val <= list2.val:
        tail.next = list1
        list1 = list1.next
    else:
        tail.next = list2
        list2 = list2.next
    tail = tail.next

# One list is empty; the other is already sorted.
tail.next = list1 or list2

return dummy.next
```

It is shorter, does fewer iterations, and needs no "one list is finished" branches. The dummy/tail idea is identical. I kept the longer version here because it shows the case analysis explicitly.

## Ties and stability

`<` takes from `list2` on a tie; `<=` takes from `list1`. Both produce a sorted list. If the relative order of equal nodes matters, use `<=` so the first list's nodes come first — that is the stable choice.

## Recursive version

Same idea, expressed as "pick the smaller head and merge the rest":

```python
def mergeTwoLists(self, a, b):
    if not a or not b:
        return a or b
    if a.val <= b.val:
        a.next = self.mergeTwoLists(a.next, b)
        return a
    b.next = self.mergeTwoLists(a, b.next)
    return b
```

It is three lines and easy to remember, but it uses O(m + n) stack space. The iterative version is the one to write in an interview unless the recursion is asked for.

## Speed

- **Time:** O(m + n) — every node is visited once.
- **Space:** O(1) extra for the iterative version; the dummy plus two pointers. The recursive version is O(m + n) on the call stack.

## Edge cases

| Case | Result |
| --- | --- |
| `[]` and `[]` | `None` |
| `[]` and `[0]` | `[0]` |
| `[1]` and `[2]` | `[1, 2]` |
| `[5]` and `[1,2,3]` | `[1, 2, 3, 5]` |
| `[1,1,1]` and `[1,1]` | five `1`s |
| One list much longer | the long list is attached at the end |

## Revision checklist

- [ ] Draw `dummy` and `tail` on paper and say which one moves.
- [ ] Explain why the return is `dummy.next` and what `tail` points at by then.
- [ ] Show what happens if `tail = tail.next` is removed.
- [ ] Explain why the loop condition is `or`.
- [ ] Say why the first node needs no special case.
- [ ] Write the two-branch version from memory.
- [ ] Say whether the input lists are modified, and why that is fine here.

## The short version

- Make a dummy head and a `tail` that starts on it.
- While both lists have nodes, attach the smaller one and advance that list.
- Attach the rest with `tail.next = list1 or list2`.
- Advance `tail` after every attach.
- Return `dummy.next` — the anchor, not the cursor.
