# Contains Duplicate

*The problem is a straight trade between time and memory. Sorting brings equal values together and needs almost no extra space; a set remembers what has been seen and gives up memory for a linear pass. Both are correct, and the interesting part is choosing which cost to pay.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻

## The question

Return `True` if any value appears at least twice in the array, `False` otherwise. There is no requirement about where the duplicate is or how many times it occurs; the first repeat is enough to answer.

## Sorting: bring the duplicates together

Sorting groups equal values, so any value that appears twice ends up as an adjacent pair somewhere in the result. One scan comparing each element with its neighbour is then sufficient, because a repeat can only hide by not being adjacent, and sorted order does not allow that.

```python
nums.sort()

for i in range(len(nums) - 1):
    if nums[i] == nums[i + 1]:
        return True

return False
```

The sort is `O(n log n)` in the worst case and the scan is `O(n)`, so the time is dominated by the sort. The early return from the scan saves very little, since the sort has already done its work by then.

Python's sort is Timsort, which is adaptive: an already sorted array is detected as one run and sorted in `O(n)`, and partially ordered inputs are faster than the worst case. That does not change the bound, but it means the sort version is cheaper than the bound suggests on data that is nearly ordered.

Two side effects are worth naming. The sort mutates `nums`, so the caller's array arrives back in a different order; and although `list.sort()` is described as in-place, it is not strictly `O(1)` auxiliary memory — Timsort can allocate up to `O(n)` temporary pointers while merging runs. "Less extra memory than the set" is accurate; "no extra memory at all" is an approximation.

## The set: remember what has been seen

The other approach walks the array once, keeping every value seen so far in a set. The value is checked before it is added, so finding it in the set means a previous copy already exists.

```python
seen = set()

for num in nums:
    if num in seen:
        return True
    seen.add(num)

return False
```

Set membership is `O(1)` on average, so the pass is `O(n)` expected time and `O(n)` space. Unlike the sort, this version stops at the first duplicate, which makes it faster on average and much faster on inputs where the duplicate is early.

The order of the two lines inside the loop is the whole algorithm. Adding first and checking after makes the condition true on the first iteration, because the value is already in the set by the time it is checked.

## The trade

The set buys a factor of `log n` in time with a linear amount of memory; the sort buys the memory back with the `log n` factor and with mutation. For the problem's bounds either is fast enough, so the choice is about the surrounding code: if the array is large and memory is tight, sort; if the array must not be reordered, the set; if the caller needs the original order but memory is still acceptable, `sorted(nums)` copies instead of mutating and costs the same `O(n)` as the set.

The one-liner `len(set(nums)) != len(nums)` is also correct, and it is the shortest way to write it. It always builds the complete set, so it loses the early exit and is the slowest of the three on inputs with an early duplicate.

## Edge cases

An array of length zero or one has no duplicate: the loop body never produces a pair. Two equal values are caught by either version. Negative numbers are fine in both, because sorting and hashing do not depend on the sign.

An already sorted input is where the sort version is at its best, since Timsort recognises the single run and the scan finds the duplicate immediately if there is one. An input with all values equal is where the set version is at its best: the duplicate is found on the second element.

## Mistakes

`nums = nums.sort()` assigns `None`, because `list.sort()` sorts in place and returns nothing. The array is sorted, but the name now points at `None`, and the next line fails.

Adding before checking makes the membership test always true on the first iteration, so the function returns `True` for every non-empty array.

Iterating with `range(len(nums))` and reading `nums[i + 1]` walks off the end; the loop bound has to be `len(nums) - 1`.

The mirror form `for i in range(len(nums)): if nums[i] == nums[i - 1]` looks safe because the negative index wraps to the last element, and for two or more elements the wrapped comparison is still between two real positions. It breaks on a single element, where the first element is compared with itself and a duplicate is reported. Starting the range at 1 avoids the wraparound entirely.

Returning `False` inside the loop ends the search at the first non-matching pair rather than after the scan. The `False` belongs after the loop.

Using a list instead of a set for the seen values turns membership into `O(n)` and the whole solution into `O(n²)`.

## To remember

Sort and compare neighbours when memory matters, accepting `O(n log n)` and mutation; keep a set when time matters, accepting `O(n)` space. In both versions the comparison is with a neighbour or a remembered value, and the answer is decided by the first repeat — one at the start of the array for the set, one adjacent pair somewhere in sorted order for the sort.
