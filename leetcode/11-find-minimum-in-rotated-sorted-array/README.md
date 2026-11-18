# Find Minimum in Rotated Sorted Array

*The test that tells you which half is sorted does not tell you which half holds the minimum. That is the trap in this problem. The question to ask instead is: is the drop to the right of `mid`? Compare `mid` with the last value, and the answer is immediate.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻ The first condition looks correct and fails only on larger arrays.

---

## The problem

A sorted array was rotated some number of times. Return its smallest value.

```text
[3, 4, 5, 1, 2]  → 1
[1, 2, 3]        → 1   (rotated n times, so back to the start)
```

The answer is the value at the rotation point — the one place where the array goes down instead of up. The array can also be unrotated, in which case the answer is the first value.

## The first idea, and why it quietly fails

The natural move is to reuse the trick from "Search in Rotated Sorted Array": check `nums[l] <= nums[mid]`, and if it is true, say "`mid` is in the left piece, so throw the left side away".

That works at the top level. It stops working once the search space is already inside the right piece.

Take `[4, 5, 6, 7, 0, 1, 2]`:

```text
l = 0, r = 6, mid = 3
nums[l] = 4, nums[mid] = 7  →  4 <= 7 is true
```

So the code throws away `[0 .. 3]` and moves to `l = 4`. But index 4 holds `0`, the actual minimum. It was never `mid`, and it was never checked. The code then keeps going and eventually returns `1`.

The reason is simple once you see it. Inside the right piece the values are also sorted. So `nums[l] <= nums[mid]` is true there too. The test answers "is this stretch sorted?", and the answer is often yes on both sides. It does not answer "is the minimum here?".

## A small example that hides the bug

Run the same wrong logic on `[3, 4, 5, 1, 2]` and it returns `1`, which is correct. The minimum happens to be visited as `mid` before it gets discarded.

```text
l = 0, r = 4, mid = 2 → 5   → drop left, l = 3
l = 3, r = 4, mid = 3 → 1   → minimum recorded here, by luck
```

That is why the bug is easy to miss: short arrays pass. It shows up when the minimum sits just past a boundary that the code jumps over, as in `[4, 5, 6, 7, 0, 1, 2]`.

## The question that works

Ask: **is the minimum to the right of `mid`?**

Compare `nums[mid]` with `nums[r]`, the last value in the current range:

| Comparison | What it means | Move |
| --- | --- | --- |
| `nums[mid] > nums[r]` | The array drops somewhere after `mid`, so the minimum is to the right. | `l = mid + 1` |
| `nums[mid] <= nums[r]` | From `mid` to `r` the values only go up, so the minimum is at `mid` or to the left. | `r = mid` |

Why `nums[r]` answers it: the last position always belongs to the part after the drop. If `mid`'s value is bigger than the value at the end, the drop is still ahead. If it is smaller or equal, `mid` has already passed the drop's low point, or it is sitting on it.

```text
[4, 5, 6, 7, 0, 1, 2]
             ↑
          the drop

mid at 3 (7): 7 > 2  → the drop is to the right → go right
mid at 5 (1): 1 <= 2 → the drop is at or left → go left
```

## Walking through the code

`nums = [3, 4, 5, 1, 2]`

| Step | `l` | `r` | `mid` | `nums[mid]` | `nums[r]` | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 | 4 | 2 | `5` | `2` | `5 > 2`, go right: `l = 3` |
| 2 | 3 | 4 | 3 | `1` | `2` | `1 <= 2`, keep `mid`: `r = 3` |
| 3 | 3 | 3 | — | — | — | `l == r`, stop |

Answer: `nums[3] = 1`.

And the case that broke the first idea, `nums = [4, 5, 6, 7, 0, 1, 2]`:

| Step | `l` | `r` | `mid` | `nums[mid]` | `nums[r]` | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 | 6 | 3 | `7` | `2` | `7 > 2`, go right: `l = 4` |
| 2 | 4 | 6 | 5 | `1` | `2` | `1 <= 2`, keep `mid`: `r = 5` |
| 3 | 4 | 5 | 4 | `0` | `1` | `0 <= 1`, keep `mid`: `r = 4` |
| 4 | 4 | 4 | — | — | — | `l == r`, stop |

Answer: `nums[4] = 0`.

Step 3 is the one that matters. `mid` is sitting on the minimum, and the range keeps it — `r = mid`, not `mid - 1` — so the loop ends with `l == r == 4` and `nums[l]` is `0`.

## The optimized version (no `minimum` variable)

```python
class Solution:
    def findMin(self, nums: list[int]) -> int:
        # Candidate range, inclusive on both ends.
        l, r = 0, len(nums) - 1

        # Stop at one candidate. `l <= r` would never terminate here:
        # at l == r, mid == r, so the else branch sets r = mid and nothing moves.
        while l < r:
            mid = (l + r) // 2   # floor division: always a valid index

            # Compare with the end of the current range. If mid is bigger,
            # the drop is somewhere to its right.
            if nums[mid] > nums[r]:
                # mid cannot be the minimum: nums[r] is already smaller.
                l = mid + 1
            else:
                # nums[mid] <= nums[r]: the minimum is at mid or to the left.
                # `r = mid`, not `mid - 1`: mid itself may be the answer.
                r = mid

        # l == r: the only candidate left has never been ruled out.
        return nums[l]
```

This is the version without a `minimum` variable. It keeps the answer in the range and returns it at the end.

The two moves are deliberately different. One throws `mid` away; the other keeps it. That difference is what makes the loop condition `l < r` instead of `l <= r`.

## Why `l < r`

`[l, r]` is the range of indices that could still hold the minimum. Every iteration removes values that cannot be it:

- `l = mid + 1` removes `[l, mid]`, because `nums[mid] > nums[r]` proves the minimum is past `mid`.
- `r = mid` removes `(mid, r]`, because the minimum is at `mid` or before it. `mid` stays.

When `l == r`, exactly one index is left. It has never been ruled out, so it is the minimum, and the function returns `nums[l]`.

`l <= r` would break this, because at `l == r` the update does nothing:

```text
l = r = 2, mid = 2
nums[2] > nums[2]  → false
r = mid = 2        → the range did not change → infinite loop
```

That is why `l < r` is not a style choice. It is part of the same decision as `r = mid`.

## Why `r = mid`, and not `r = mid - 1`

In the `else` branch, `nums[mid] <= nums[r]`, so `mid` may itself be the minimum. This version has no `minimum` variable to remember it, so the range has to keep it.

`[4, 5, 0, 1, 2]` shows the difference:

```text
r = mid                        r = mid - 1
l=0 r=4 mid=2 → 0              l=0 r=4 mid=2 → 0
0 <= 2 → r = 2                 0 <= 2 → r = 1        ← index 2 dropped
l=0 r=2 mid=1 → 5              l=0 r=1 mid=0 → 4
5 > 0 → l = 2                  4 <= 5 → r = -1
l == r == 2 → return 0         return nums[0] = 4   ← wrong
```

`mid` landed on the minimum, and `mid - 1` threw it away. The answer was in the one index the update discarded.

`l = mid + 1` is safe for the opposite reason. When `nums[mid] > nums[r]`, a smaller value (at least `nums[r]`) exists, so `mid` is definitely not the minimum.

## The alternative: record the minimum

Both versions use the same comparison. The optimized version above keeps the answer in the range; this one records it in a variable, which lets it drop `mid` every iteration.

```python
l, r = 0, len(nums) - 1

# Covers the unrotated array: the first value is already the minimum.
minimum = nums[0]

# `<=` because a one-element range still holds a candidate.
while l <= r:
    mid = (l + r) // 2

    # Record before moving: mid may be the minimum itself.
    minimum = min(minimum, nums[mid])

    if nums[mid] > nums[r]:
        # The drop is to the right, so mid is not the answer.
        l = mid + 1
    else:
        # Safe to drop mid only because it was recorded one line above.
        r = mid - 1

return minimum
```

The two designs are consistent inside themselves, and each one fixes the other's variables:

| | Record the candidate | Keep the candidate |
| --- | --- | --- |
| Loop | `while l <= r` | `while l < r` |
| Drop `mid` | `r = mid - 1` (already recorded) | never — `r = mid` |
| Answer | the `minimum` variable | `nums[l]` |

Mixing them breaks in both directions:

- `l <= r` with `r = mid` → nothing changes at `l == r` → infinite loop.
- `l < r` with `r = mid - 1` → the minimum can be dropped → `[4,5,0,1,2]` returns `4`.

Pick one design: either record the candidate and discard it, or keep the candidate and return it at the end.

## Why `nums[mid] > nums[r]` is the right test

The rotated array has exactly one place where a bigger value is followed by a smaller one. That place is the minimum.

- If `nums[mid] > nums[r]`, that drop must be somewhere after `mid`. Everything from `l` to `mid` is above the drop, so the answer is to the right.
- If `nums[mid] <= nums[r]`, then `mid` is at or past the drop. The values from `mid` to `r` are in order, so the smallest value in that stretch is at `mid`. The global minimum is therefore `mid` or to its left.

The first test, `nums[l] <= nums[mid]`, only says "this stretch is sorted". Both pieces are sorted, so it stays true inside the right piece and cannot decide anything.

## If there are duplicates

With distinct values, `nums[mid]` is either bigger or smaller than `nums[r]`, so the test always decides. With duplicates, `nums[mid] == nums[r]` can mean either side. The fix is to shrink the right end by one and try again:

```python
elif nums[mid] == nums[r]:
    # Equal values hide which side the minimum is on, so discard one index
    # and try again. This is the step that costs the O(log n) guarantee.
    r -= 1
```

That is LeetCode 154, and it can no longer promise O(log n) in the worst case.

## Speed

Each step throws away half of the remaining values.

- **Time:** O(log n)
- **Space:** O(1)

A single scan tracking the smallest value is O(n). That is the thing the problem is asking you to beat.

## Mistakes to avoid

- Using `nums[l] <= nums[mid]` to decide which side holds the minimum. It tells you which side is sorted, and both sides can be sorted.
- Pairing `l <= r` with `r = mid`. At `l == r` the update changes nothing, and the loop never ends.
- Pairing `l < r` with `r = mid - 1`. That discards `mid` while it may be the minimum; `[4,5,0,1,2]` returns `4` instead of `0`.
- Writing `nums[mid] < nums[r]` instead of `>`. The comparison direction *is* the rule; check it against a picture.
- Forgetting the array may not be rotated at all. `[1, 2, 3]` should return `1`.

## Revision checklist

- [ ] Say why `nums[l] <= nums[mid]` cannot answer "where is the minimum?".
- [ ] Trace `[4,5,6,7,0,1,2]` with the wrong test and show it returns `1`.
- [ ] Trace the same array with the right test and show it returns `0`.
- [ ] Explain why `nums[mid] > nums[r]` means "go right".
- [ ] Explain why the loop stops at `l == r` and why the answer is `nums[l]`.
- [ ] Explain what goes wrong with `l <= r` when the update is `r = mid`.
- [ ] Explain why `r = mid` keeps the answer, using `[4,5,0,1,2]`.
- [ ] Say what changes with duplicates.

## The short version

- Compare `nums[mid]` with `nums[r]`, not with `nums[l]`.
- `nums[mid] > nums[r]` → the minimum is to the right → `l = mid + 1`; `mid` cannot be it.
- Otherwise → the minimum is at `mid` or to the left → `r = mid`; keep `mid` in range.
- Stop when `l == r`. One candidate is left, so return `nums[l]`.
- Keep the two decisions together: `l < r` goes with `r = mid`; `l <= r` goes with `r = mid - 1` and a recorded minimum.
