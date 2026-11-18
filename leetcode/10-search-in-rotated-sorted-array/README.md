# Search in Rotated Sorted Array

*The array was sorted and then cut and rejoined. Normal binary search stops working because the second half can be smaller than the first. The fix is to check, at each step, which side is still in order, and search that side only if the target can be there.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻↻↻ Worth solving more than once.

---

## The problem

You get an array that was sorted, then rotated at some point, and a target. Return the target's index, or `-1`.

```text
nums   = [4, 5, 6, 7, 0, 1, 2]
target = 0   → 4
target = 3   → -1
```

The rotation moved `[4, 5, 6, 7]` to the back. The values are distinct, which matters later.

## Why normal binary search breaks

Normal binary search says: if the middle is bigger than the target, the target must be on the left. That works because the whole array is sorted.

Here:

```text
nums = [4, 5, 6, 7, 0, 1, 2]
                  ↑
                 mid = 7
```

`7 > 0`, so the rule says "go left". But `0` is on the right. The rule is false here.

The array is not one sorted list. It is two:

```text
[4, 5, 6, 7]   [0, 1, 2]
   sorted          sorted
```

## The idea

At any middle position, one of the two sides is fully sorted. Either `[l ... mid]` is in order, or `[mid ... r]` is in order.

So each step becomes:

1. Work out which side is sorted.
2. Check whether the target can be inside that sorted side.
3. If it can, search there. If it can't, search the other side.

## Why the two halves change the rules

The rotation gives us two sorted pieces:

```text
[4, 5, 6, 7]   [0, 1, 2]
   first          second
```

`mid` always sits inside one of them. Which one matters, because the break lies between the pieces: every value in the first piece is larger than every value in the second.

**If `mid` is in the first piece**, everything from `l` to `mid` is sorted. A value smaller than `nums[mid]` could be just to its left — or it could be in the second piece, because every value there is smaller than the first piece's values.

| Compare | Where the target can be |
| --- | --- |
| `target < nums[mid]` | left of `mid`, or in the second piece |
| `target > nums[mid]` | only to the right, inside the first piece |

**If `mid` is in the second piece**, it is the mirror image. Now `mid`'s own piece is sorted to its right, and the first piece is far to the left.

| Compare | Where the target can be |
| --- | --- |
| `target < nums[mid]` | only to the left, inside the second piece |
| `target > nums[mid]` | right of `mid`, or far left in the first piece |

Read the two tables together. A target smaller than `mid` means "keep looking left" in one case and "it might be in the other piece" in the other. A target bigger than `mid` flips which comparison is the ambiguous one. The action depends on which piece `mid` landed in, so the code needs a separate branch for each piece, and each branch needs its own extra check against that piece's outer edge — `nums[l]` for the first, `nums[r]` for the second.

That is the whole reason for the `if nums[l] <= nums[mid]: ... else: ...`. The two branches are not two ways of writing the same rule. They are two different rules.

## How to tell which side is sorted

Compare the first value with the middle value:

```text
nums[l] <= nums[mid]  →  the left side [l ... mid] is sorted
nums[l] >  nums[mid]  →  the right side [mid ... r] is sorted
```

The reason is simple. The only place where the order breaks is the join between the two pieces. If that join were between `l` and `mid`, then `nums[l]` would be a big number and `nums[mid]` a small one, so `nums[l]` would be greater than `nums[mid]`. If it is not greater, the join is somewhere else, and the left side is still in order.

## Walking through an example

`nums = [4, 5, 6, 7, 0, 1, 2]`, `target = 0`

| Step | `l` | `r` | `mid` | `nums[mid]` | What we see | Next |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 | 6 | 3 | `7` | `4 <= 7`, so the left side `[4,5,6,7]` is sorted. Target `0` is smaller than the smallest value `4`, so it can't be there. | go right: `l = 4` |
| 2 | 4 | 6 | 5 | `1` | `0 <= 1`, so the left side `[0,1]` is sorted. Target `0` is inside it. | go left: `r = 4` |
| 3 | 4 | 4 | 4 | `0` | Found it. | return `4` |

Two things to notice:

- In step 1 we compared the target with `nums[l]`, the **smallest** value of the sorted left side.
- In step 2 the sorted side was still the left one, and we compared against its smallest value again.

When the sorted side is the right one, you compare against `nums[r]`, its **largest** value. That is the only real difference between the two branches.

## The code

```python
class Solution:
    def search(self, nums: list[int], target: int) -> int:
        l, r = 0, len(nums) - 1

        # `<=`, not `<`: when l == r there is still one candidate left to check.
        while l <= r:
            mid = (l + r) // 2

            if nums[mid] == target:
                return mid

            # `<=`, not `<`: when l == mid the left side is a single element,
            # and a single element is always sorted.
            if nums[l] <= nums[mid]:
                # Left side is sorted, so its smallest value is nums[l].
                if target > nums[mid]:
                    # Bigger than the largest of the left side: go right.
                    l = mid + 1
                elif target < nums[mid]:
                    if target < nums[l]:
                        # Smaller than the smallest of the left side: go right.
                        l = mid + 1
                    else:
                        # Inside the left side.
                        r = mid - 1
            else:
                # Right side [mid ... r] is sorted.
                if target < nums[mid]:
                    # Smaller than the smallest of the right side: go left.
                    r = mid - 1
                elif target > nums[mid]:
                    if target > nums[r]:
                        # Bigger than the largest of the right side: go left.
                        r = mid - 1
                    else:
                        # Inside the right side.
                        l = mid + 1

        return -1
```

## The two `<=` signs

Both of them look like style choices. Both are needed.

**`while l <= r`.** With one element left, `l == r`. The loop still has a candidate to check, so it must run. With `l < r` it would skip it:

```text
nums = [1], target = 1
l = r = 0

while l < r    → loop never runs → return -1   (wrong)
while l <= r   → runs once, finds 1 → return 0 (right)
```

**`nums[l] <= nums[mid]`.** When the left side has one element, `l == mid`, so `nums[l] == nums[mid]`. With `<` the test fails, and the code takes the "right side is sorted" branch, which is wrong. One element is always sorted, so equality has to count.

## A target that isn't there

`target = 3`, same array:

| Step | `l` | `r` | `mid` | `nums[mid]` | What we see | Next |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 | 6 | 3 | `7` | Left side `[4..7]` sorted. `3 < 4`, so it's not there. | `l = 4` |
| 2 | 4 | 6 | 5 | `1` | Left side `[0,1]` sorted. `3 > 1`, so it's not there. | `l = 6` |
| 3 | 6 | 6 | 6 | `2` | Left side is just `[2]`. `3 > 2`, so go right. | `l = 7` |

Now `l = 7` and `r = 6`, so the loop ends and the answer is `-1`.

## Speed

Each step throws away half of what is left, same as normal binary search.

- **Time:** O(log n)
- **Space:** O(1)

You could find the rotation point first and then binary search the correct half. That is also O(log n), just two searches instead of one. Either is fine; the single-pass version above is shorter once the "which side is sorted" idea clicks.

## Mistakes to avoid

- Using `<` instead of `<=` in `nums[l] <= nums[mid]`. This breaks when `l == mid`.
- Using `l < r` in the loop. This breaks on a one-element array.
- Comparing `nums[l]` in the right-sorted branch, or `nums[r]` in the left-sorted branch. Compare against the sorted side's own edge.
- Forgetting which way the pointers move: **to keep the left side, move `r`; to keep the right side, move `l`.**

## Revision checklist

- [ ] Explain why `7 > 0` does not mean "go left" in this array.
- [ ] Say how you know which side is sorted.
- [ ] Trace `[4,5,6,7,0,1,2]` for target `0` and target `3`.
- [ ] Explain both `<=` signs.
- [ ] Run `[3,1]` and `[1]` by hand.
- [ ] Say what changes if duplicates are allowed (LeetCode 81).

## The short version

- The array is two sorted pieces.
- `mid` lands in one piece or the other, and the two pieces need different rules. In one, `target < mid` is the ambiguous case; in the other, `target > mid` is.
- At every `mid`, one side is sorted. Find it with `nums[l] <= nums[mid]`.
- If the target falls inside that sorted side, go there. Otherwise go to the other side.
- Compare against the sorted side's edge: `nums[l]` on the left, `nums[r]` on the right.
