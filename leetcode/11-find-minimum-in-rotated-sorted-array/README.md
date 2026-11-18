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
| `nums[mid] <= nums[r]` | From `mid` to `r` the values only go up, so the minimum is at `mid` or to the left. | `r = mid - 1` |

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

| Step | `l` | `r` | `mid` | `nums[mid]` | `nums[r]` | Decision | `minimum` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 | 4 | 2 | `5` | `2` | `5 > 2`, go right: `l = 3` | `3` |
| 2 | 3 | 4 | 3 | `1` | `2` | `1 <= 2`, go left: `r = 2` | `1` |
| 3 | 3 | 2 | — | — | — | `l > r`, stop | `1` |

Answer: `1`.

And the case that broke the first idea, `nums = [4, 5, 6, 7, 0, 1, 2]`:

| Step | `l` | `r` | `mid` | `nums[mid]` | `nums[r]` | Decision | `minimum` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 | 6 | 3 | `7` | `2` | `7 > 2`, go right: `l = 4` | `4` |
| 2 | 4 | 6 | 5 | `1` | `2` | `1 <= 2`, go left: `r = 4` | `1` |
| 3 | 4 | 4 | 4 | `0` | `0` | `0 <= 0`, go left: `r = 3` | `0` |
| 4 | 4 | 3 | — | — | — | stop | `0` |

Here `mid` lands on the minimum in step 3, so it gets recorded before the range goes past it.

## The code

```python
class Solution:
    def findMin(self, nums: list[int]) -> int:
        l, r = 0, len(nums) - 1

        # Covers the unrotated case and the first candidate.
        minimum = nums[0]

        while l <= r:
            mid = (l + r) // 2

            # Record before discarding: mid may be the minimum itself.
            minimum = min(minimum, nums[mid])

            if nums[mid] > nums[r]:
                # The drop is to the right of mid, so the minimum is too.
                l = mid + 1
            else:
                # nums[mid] <= nums[r]: this part only goes up,
                # so the minimum is at mid or somewhere to its left.
                r = mid - 1

        return minimum
```

`r = mid - 1` looks dangerous because it throws away `mid`. It is safe because `mid` was recorded one line earlier. If `mid` was the minimum, `minimum` already holds it.

## Why `nums[mid] > nums[r]` is the right test

The rotated array has exactly one place where a bigger value is followed by a smaller one. That place is the minimum.

- If `nums[mid] > nums[r]`, that drop must be somewhere after `mid`. Everything from `l` to `mid` is above the drop, so the answer is to the right.
- If `nums[mid] <= nums[r]`, then `mid` is at or past the drop. The values from `mid` to `r` are in order, so the smallest value in that stretch is at `mid`. The global minimum is therefore `mid` or to its left.

The first test, `nums[l] <= nums[mid]`, only says "this stretch is sorted". Both pieces are sorted, so it stays true inside the right piece and cannot decide anything.

## Two ways to finish

The code above carries a `minimum` variable. A shorter version lets the range collapse onto the answer:

```python
l, r = 0, len(nums) - 1
while l < r:
    mid = (l + r) // 2
    if nums[mid] > nums[r]:
        l = mid + 1
    else:
        r = mid
return nums[l]
```

| | Track `minimum` | Shrink to one index |
| --- | --- | --- |
| Loop | `while l <= r` | `while l < r` |
| Update | `r = mid - 1` | `r = mid` |
| Answer | the `minimum` variable | `nums[l]` |

Both are correct. The shorter one is easier to type; the longer one is easier to explain, because every candidate is recorded the moment it is seen.

## If there are duplicates

With distinct values, `nums[mid]` is either bigger or smaller than `nums[r]`, so the test always decides. With duplicates, `nums[mid] == nums[r]` can mean either side. The fix is to shrink the right end by one and try again:

```python
elif nums[mid] == nums[r]:
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
- Moving `r = mid - 1` before recording `nums[mid]`. Then the minimum gets discarded.
- Writing `nums[mid] < nums[r]` instead of `>`. The comparison direction *is* the rule; check it against a picture.
- Forgetting the array may not be rotated at all. `[1, 2, 3]` should return `1`.

## Revision checklist

- [ ] Say why `nums[l] <= nums[mid]` cannot answer "where is the minimum?".
- [ ] Trace `[4,5,6,7,0,1,2]` with the wrong test and show it returns `1`.
- [ ] Trace the same array with the right test and show it returns `0`.
- [ ] Explain why `nums[mid] > nums[r]` means "go right".
- [ ] Explain why `r = mid - 1` does not lose the answer.
- [ ] Write the shorter `while l < r` version.
- [ ] Say what changes with duplicates.

## The short version

- Compare `nums[mid]` with `nums[r]`, not with `nums[l]`.
- `nums[mid] > nums[r]` → the minimum is to the right → `l = mid + 1`.
- Otherwise → the minimum is at `mid` or to the left → record it, then `r = mid - 1`.
- Record `mid` before moving, because `mid` may be the answer.
