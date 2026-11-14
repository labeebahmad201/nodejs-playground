# Binary Search: Eliminate Half, Not One

*Checking an end for equality rules out one value. Checking the middle rules out an entire side — but only because the array is sorted. The idea is simple; the loop condition and the midpoint are where it goes wrong.*

Part of the [`leetcode/`](../) section. The midpoint's `//` is the same floor-division operator discussed in [`fundamentals/44-truncation-vs-floor`](../../fundamentals/44-truncation-vs-floor).

---

## The problem

Given an array `nums` sorted in ascending order and a `target`, return the index of `target`, or
`-1` if it is not present. The required runtime is **O(log n)**.

```text
nums   = [-1, 0, 3, 5, 9, 12]
target = 9   → 4
target = 2   → -1
```

The values are unique, so there is at most one correct index.

## The idea: one comparison, half the array

The first instinct is to check elements one at a time. Check the left end: if it is not the target,
you have eliminated exactly one index. Check the next: one more. That is a linear scan, and it is
the thing O(log n) forbids.

The middle is different. If `nums[mid] > target`, then every index to the right of `mid` holds a
value at least as large as `nums[mid]`, so every one of them is also greater than `target`. One
comparison eliminates the middle **and the entire right side**.

```text
nums      = [-1, 0, 3, 5, 9, 12]
mid       = 2 → nums[2] = 3 > 2
remaining = [-1, 0]
```

The array had six candidates. After one comparison, two remain. That is the entire trick: each step
divides the search space instead of decrementing it.

Sortedness is the permission slip. If the array were unsorted, `nums[mid] > target` would say
nothing about the elements to its right, and no side could be discarded.

## The algorithm

```python
class Solution:
    def search(self, nums: list[int], target: int) -> int:
        left = 0
        right = len(nums) - 1

        while left <= right:
            mid = (left + right) // 2

            if nums[mid] == target:
                return mid
            elif nums[mid] > target:
                right = mid - 1
            else:
                left = mid + 1

        return -1
```

`[left, right]` is the part of the array that can still contain `target`. Initially it is the whole
array. `mid` splits it in two. Then one of three things is true:

- `nums[mid] == target` — done.
- `nums[mid] > target` — target can only be to the left, so `right = mid - 1`.
- `nums[mid] < target` — target can only be to the right, so `left = mid + 1`.

The `- 1` and `+ 1` matter: they exclude `mid` itself, which has just been ruled out. That is also
what guarantees the interval shrinks on every iteration.

The final `else` is safe because the three comparisons are exhaustive. An explicit
`elif nums[mid] < target` can read better as documentation; it is not a correctness difference here.

## The common mistake: `left < right` skips the last candidate

This was my first loop condition. It looks reasonable — "keep going while there is more than one
element" — but it is wrong for this interval convention.

`right = len(nums) - 1` makes the interval **inclusive**: `[left, right]`. That interval still
contains one candidate when `left == right`. The loop must run in that case, because the single
remaining index might be the target. It is empty only when `left > right`.

```text
nums = [5], target = 5
left = right = 0

while left < right:   → 0 < 0 is false → loop never runs → return -1   (wrong)
while left <= right:  → runs once, mid = 0, nums[0] == 5 → return 0    (correct)
```

With `nums = [5], target = 3`, the correct loop runs once, sees `5 > 3`, sets `right = -1`, and
exits with `-1`. The wrong loop skips the check and returns `-1` too — so that test passes for the
wrong reason. The **found** single-element case is the one that catches the bug.

The loop condition and the interval convention are one decision:

| `right` starts at | Interval | Runs while |
| --- | --- | --- |
| `len(nums) - 1` (inclusive) | `[left, right]` | `left <= right` |
| `len(nums)` (exclusive) | `[left, right)` | `left < right` |

Mixing them is the classic off-by-one. If `right` is inclusive, use `<=`.

## The midpoint: `//` is floor division

`mid` is an index, so it must be an integer. `/` would produce a float, and `nums[2.0]` is a
`TypeError`.

Python's `//` is called **floor division**. It rounds toward negative infinity. For an even-length
interval it returns the lower of the two middle indices.

That is the same floor-versus-truncation distinction as
[`fundamentals/44`](../../fundamentals/44-truncation-vs-floor). `-7 // 2` is `-4`, while
`int(-7 / 2)` is `-3`. Array indices are never negative, so both agree here — but the name matters,
and `//` is the operator that expresses "integer index" directly.

The lower middle is safe **in this code** because both updates exclude `mid` (`mid - 1`,
`mid + 1`), so the interval always shrinks. If you ever change an update to `left = mid` or
`right = mid`, you need the upper middle instead:

```python
mid = (left + right + 1) // 2   # upper middle, for variants that keep mid
```

With the lower middle and `left = mid`, the interval `[0, 1]` computes `mid = 0`; if
`nums[0] < target`, `left` stays `0` and the loop never makes progress.

One portability note: in Java or C++, `left + right` can overflow a 32-bit `int`. The safe form is
`left + (right - left) // 2`. Python integers do not overflow, so the direct form is fine here, but
the rewrite costs nothing.

## Why it works

The invariant:

> At the start of each iteration, if `target` is in `nums`, its index lies in `[left, right]`.

It starts true because the interval is the whole array. Each comparison preserves it:

- Equal: return immediately.
- `nums[mid] > target`: sortedness means every index from `mid` onward is greater than `target`, so
  none of them can be the answer. `right = mid - 1` keeps exactly the indices that can.
- `nums[mid] < target`: every index up to `mid` is smaller than `target`, so `left = mid + 1` keeps
  exactly the indices that can.

When `left > right`, the interval is empty. If the invariant still holds, `target` cannot be in
`nums`, so `-1` is correct.

## Why O(log n)

Each iteration discards `mid` and one side, so at most half of the remaining candidates survive:

```text
n → n/2 → n/4 → ... → 1
```

After `k` iterations, at most `n / 2^k` candidates remain. The search stops when that is below one:

```text
n / 2^k < 1  →  2^k > n  →  k > log₂ n
```

So the number of iterations is `O(log n)`, and each iteration does O(1) work. Space is O(1): three
integer variables. For a million elements, that is about twenty comparisons instead of a million.

The halving is only guaranteed because the updates exclude `mid`. If an update leaves `mid` in the
interval, the range can fail to shrink, and the loop can run forever.

## Tests worth keeping

```python
assert Solution().search([-1, 0, 3, 5, 9, 12], 9) == 4
assert Solution().search([-1, 0, 3, 5, 9, 12], 2) == -1

# The `left < right` bug: one candidate left, and it is the target.
assert Solution().search([5], 5) == 0
assert Solution().search([5], 3) == -1

# Boundaries: target at the first and last index.
assert Solution().search([1, 3], 1) == 0
assert Solution().search([1, 3], 3) == 1
assert Solution().search([1, 3, 5], 1) == 0
assert Solution().search([1, 3, 5], 5) == 2
```

The first two are the problem's examples. The single-element **found** case is the regression test
for the loop condition; the boundary cases catch an off-by-one in how `mid` is excluded.

I also compared the function against Python's `list.index` on 20,000 random sorted arrays. It agreed
on every one. The random test is reassuring, but the hand-picked boundaries are what explain *why*
the code is correct.

## What generalizes

- **Binary search is "discard half the answer space," not "search an array."** The same shape finds
  the first index where a monotonic predicate becomes true (lower bound) or the last where it holds
  (upper bound). A sorted array is the simplest case.
- **The loop condition belongs to the interval convention.** Inclusive `right` means
  `left <= right`; exclusive `right` means `left < right`. Decide both together.
- **Write the invariant before the code.** The five lines are easy; the bugs live at the boundaries.
- **With duplicates, returning on the first match is not enough.** It finds *a* matching index, not
  necessarily the first or last. Those variants keep narrowing after a match instead of returning.

## The takeaway

- The middle comparison eliminates half because sortedness makes the other side impossible.
- `left <= right` because a one-element interval still holds a candidate. `left < right` skips it —
  that was the bug in my first attempt.
- `//` is floor division; it gives an integer index, and the lower middle is safe as long as both
  updates exclude `mid`.
- Every step must strictly shrink the interval. That is what makes it O(log n) instead of an
  infinite loop.
