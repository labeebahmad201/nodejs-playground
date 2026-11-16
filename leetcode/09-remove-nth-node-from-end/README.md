# Remove Nth Node From End: Keep a Gap of N

*A singly linked list has no backward pointer, so "nth from the end" looks like it requires the length first. It doesn't: keep two pointers exactly `n` edges apart, walk until the fast one falls off, and the slow one is the target. A dummy node gives the head a predecessor.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** This one is worth re-solving cold. The list of edge cases is short, but the pointer roles are easy to mix up.

---

## The problem

Given the head of a singly linked list, remove the `n`th node from the end and return the head.

```text
1 → 2 → 3 → 4 → 5, n = 2
1 → 2 → 3 → 5
```

The follow-up asks for one pass. A two-pass solution is easy to write: count the length, then walk to `length - n`. The two-pointer solution avoids the first pass by carrying the distance from the end as it walks.

## The real obstacle

To remove a node from a singly linked list, you need the node **before** it:

```python
prev.next = target.next
```

The target node cannot remove itself, because it cannot update its predecessor's `next` pointer. So the problem has two requirements:

1. Find the target.
2. Keep a reference to its predecessor.

The second requirement is why removing the head is special: the head has no predecessor. The dummy node from the code is there to remove that special case.

## The gap idea

Start both pointers at `head`. Advance `fast` exactly `n` times. Now `fast` is `n` edges ahead of `slow`.

For `1 → 2 → 3 → 4 → 5` and `n = 2`:

```text
dummy → 1 → 2 → 3 → 4 → 5 → None
          ↑        ↑
        slow     fast
```

The gap is two edges: `slow → 2 → fast`. Move both pointers one step at a time. The gap stays exactly two edges, because both move by one. When `fast` becomes `None`, it is one step past the last node, so `slow` is two steps before `None` — the second node from the end.

| Step | `slow` | `fast` | `prev` |
| --- | --- | --- | --- |
| start | `1` | `1` | `dummy` |
| advance `n = 2` | `1` | `3` | `dummy` |
| move 1 | `2` | `4` | `1` |
| move 2 | `3` | `5` | `2` |
| move 3 | `4` | `None` | `3` |

At the end:

```text
dummy → 1 → 2 → 3 → 4 → 5 → None
                    ↑    ↑
                  prev  slow        fast = None
```

`slow` is the node to remove, and `prev` is the node before it. That is the invariant. The deletion is then one assignment:

```python
prev.next = slow.next
```

The edge count is deliberately `n`, not `n - 1` or `n + 1`:

- Advance `n - 1`: `slow` stops one node too late.
- Advance `n + 1`: `slow` stops one node too early.
- Advance `n`: `slow` lands exactly on the node that is `n` from the end.

## Name the pointer roles

The original notes sometimes say the slow pointer stops **before** the node to remove, and sometimes say it stops **on** the node to remove. Both are true of different variants. The code in this article is the second one:

- After the loop, `slow` is the target.
- `prev` is the target's predecessor.
- `fast` is `None`.

The "slow stops before the target" description belongs to the common variant where `slow` is the predecessor:

```python
dummy = ListNode(0, head)
slow = fast = dummy

for _ in range(n):
    fast = fast.next

while fast.next:
    slow = slow.next
    fast = fast.next

slow.next = slow.next.next
return dummy.next
```

Here `slow` is the predecessor and `fast` ends on the last node, so the loop condition is `while fast.next`. There is no separate `prev`, because `slow` already plays that role.

Both variants are correct. The mistake is mixing their invariants:

- `while fast` + `prev.next = slow.next` → `slow` is the target.
- `while fast.next` + `slow.next = slow.next.next` → `slow` is the predecessor.

If you use `while fast.next` but write `prev.next = slow.next` as if `slow` were the target, you remove the wrong node. Pick one invariant and trace it before coding.

## Why the dummy node

`dummy` is a fake node whose `next` points at the real head:

```python
dummy = ListNode(0, head)
```

Its value is irrelevant. Its job is to be the predecessor of every possible target, including the head.

When the target is the head, `fast` becomes `None` during the initial advance, so the `while` loop never runs. `prev` is still `dummy`, and:

```python
prev.next = slow.next
```

becomes:

```python
dummy.next = head.next
```

The old head is unlinked and `dummy.next` is the new head. Without the dummy, this case would need a separate `if target is head: return head.next` branch, and `prev` would start as `None`.

The dummy also gives a uniform return value:

```python
return dummy.next
```

If the head was removed, `dummy.next` is the new head. If it wasn't, `dummy.next` is still the original head.

The dummy is not part of the gap. `slow` and `fast` start at `head`; the dummy only sits before the chain as `prev` and as the anchor for the return value.

## The clean version

```python
class Solution:
    def removeNthFromEnd(self, head: ListNode | None, n: int) -> ListNode | None:
        dummy = ListNode(0, head)
        slow = head
        fast = head
        prev = dummy

        for _ in range(n):
            fast = fast.next

        while fast:
            prev = slow
            slow = slow.next
            fast = fast.next

        prev.next = slow.next
        return dummy.next
```

`fast` can become `None` on the final advance — specifically when `n == length`, where the target is the head. That is safe: the loop ends immediately, so no later iteration tries to read `.next` from `None`. For valid `n`, `fast` is a real node at the start of every iteration, including the one that moves it to `None`.

The order inside the loop matters. `prev = slow` runs **before** `slow` moves. At the end of the iteration, `prev` is the node that `slow` just left. If you update `prev` after moving `slow`, `prev` becomes the target itself, and `prev.next = slow.next` does nothing useful.

`prev = dummy` before the loop is what makes the head-removal case work when the loop has zero iterations. It is not a placeholder; it is the real predecessor of the head.

## The guarded version from the original solution

The original solution advances with a guard because `n` might be larger than the number of nodes:

```python
class Solution:
    def removeNthFromEnd(self, head: ListNode | None, n: int) -> ListNode | None:
        dummy = ListNode(0)
        dummy.next = head
        slow = head
        fast = head

        for _ in range(0, n):
            # Keep fast as None instead of trying to read None.next.
            fast = fast.next if fast else None

        prev = dummy
        while fast:
            prev = slow
            slow = slow.next
            fast = fast.next

        prev.next = slow.next
        return dummy.next
```

The reasoning is sound at the level of "do not dereference `None`": if `n` is 10 and the list has only 2 nodes, the counted loop needs to keep advancing `fast` without calling `.next` on `None`. The conditional expression does that.

For valid input (`1 <= n <= length`), the guard is never false at the start of an iteration, so this is identical to the simpler `fast = fast.next`. In particular, when `n == length`, `fast` becomes `None` only on the final advance, and the loop then ends.

But the guard only prevents the exception. It does not report that `n` was too large. Once `fast` is `None` early, the `while fast` loop is skipped, `prev` stays at `dummy`, and the code removes the head. That is a wrong answer, not a robust handling of the invalid input. For a general-purpose API, the guard should exit immediately:

```python
for _ in range(n):
    if fast is None:
        raise ValueError("n is larger than the list")
    fast = fast.next
```

or return the original `head` unchanged, depending on the contract. The key is that the guard must decide what invalid input means, not just replace a crash with a different operation.

LeetCode guarantees `1 <= n <= length`, so both versions produce the same result for every valid input. I keep both here because the guarded version shows the robustness instinct and the boundary it does not cover. See [`fundamentals/45-guard-clauses`](../../fundamentals/45-guard-clauses) for the distinction between a guard that reports an invalid state and one that silently changes the operation.

The empty-list case is excluded by the constraints too. If `head` were `None`, `slow.next` would fail. A defensive version would need an explicit `if not head: return None` at the top.

## Edge cases

All of the boundary cases fit in a small table. The list is `1 → 2 → 3 → 4 → 5` unless noted.

| Case | `n` | After the advance | Loop iterations | `prev` | `slow` | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Remove the last node | `1` | `fast = 2` | `4` | `4` | `5` | `1 → 2 → 3 → 4` |
| Remove a middle node | `2` | `fast = 3` | `3` | `3` | `4` | `1 → 2 → 3 → 5` |
| Remove the head | `5` | `fast = None` | `0` | `dummy` | `1` | `2 → 3 → 4 → 5` |
| Single node | `1` | `fast = None` | `0` | `dummy` | `1` | `None` |

The last two rows are the reason `prev` starts at `dummy` and the function returns `dummy.next`. When the loop does not run, there is still a valid predecessor, and the head may have changed.

## Complexity

- **Time: O(L)**, where `L` is the list length. The first loop does `n` steps, the second does `L - n` steps, so the total is `L` steps.
- **Space: O(1)**. The dummy and three pointers are constant extra space.

This is one pass over the list. Counting the length first and then walking to `L - n` is also O(L) time, but it traverses the list twice.

| Approach | Passes | Extra space |
| --- | --- | --- |
| Count length, then remove | 2 | O(1) |
| Fixed-gap two pointers | 1 | O(1) |

## What generalizes

- **A fixed gap carries distance without counting.** The fast pointer does not know the length; it just stays `n` edges ahead. When it reaches the end, the gap has measured the distance for you.
- **Singly linked deletion is predecessor surgery.** You rarely remove the node you are pointing at; you remove `prev.next`. Keep the predecessor, not just the target.
- **Dummy nodes turn head operations into middle operations.** Any operation that may change the head can use a sentinel before it, so every real node has a predecessor and the return value is uniform.
- **Two pointers can encode a sliding window.** The same fixed-gap idea finds the last `k` nodes, the middle of a list, or the start of a window that must end at the tail.
- **Name the variant.** `while fast` with `prev.next = slow.next` and `while fast.next` with `slow.next = slow.next.next` are both valid, but their invariants are different. Do not mix them.
- **One pass is enough when the front pointer carries the information the back pointer will need.** The gap is that information.

The two-pointer vocabulary is the same one used in [`05-linked-list-cycle`](../05-linked-list-cycle), but the purpose is different: there the gap shrinks until the pointers meet; here the gap stays fixed until the fast pointer leaves the list. [`06-reverse-linked-list`](../06-reverse-linked-list) is the other side of linked-list pointer surgery: save the link before you overwrite it.

## Revisit

Re-solve this one without looking, then check:

- [ ] Remove the last node (`n = 1`).
- [ ] Remove the head (`n = length`).
- [ ] Remove the only node in the list.
- [ ] Remove a middle node.
- [ ] State the invariant after the loop: `slow` is the target, `prev` is its predecessor, `fast` is `None`.
- [ ] Explain what `prev = dummy` protects when the loop does not run.
- [ ] Explain why `while fast` pairs with `prev.next = slow.next`.
- [ ] Write the `while fast.next` variant and say which pointer is the predecessor.
- [ ] Decide what should happen if `n` is larger than the list, and whether the current code actually does it.

If any of these feels fuzzy, re-trace the five-node list and the single-node list before writing code.

## The takeaway

- Advance `fast` exactly `n` steps, then move both pointers until `fast` is `None`.
- `slow` is then the node to remove; `prev` is its predecessor.
- A dummy before the head gives the head a predecessor and makes `return dummy.next` work for every case.
- The algorithm is one pass, O(L) time, and O(1) space.
- `while fast` and `while fast.next` are two different invariants. Name the one you are using.
- The original solution's defensive `if fast else None` prevents a crash but does not make an invalid `n` correct; a robust guard must return or raise.
