# Search in Rotated Sorted Array: Find the Sorted Half

*Rotation breaks the one assumption binary search depends on: that one comparison tells you which side is impossible. It does not break the array — after any rotation, at least one of the two halves around `mid` is still sorted. Find that half, decide whether the target lives inside it, and the other half is eliminated exactly as before.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻↻↻ This one earns three marks. The code is short but the reasoning has four moving parts — which half is sorted, which boundary to compare against, where the equality goes, and why the update direction inverts between branches. Re-solve it cold more than once.

---

## The problem

Given an integer array `nums` sorted in ascending order with **distinct** values, rotated at some unknown pivot, and a `target`, return the index of `target` or `-1`. The required runtime is **O(log n)**.

```text
nums   = [4, 5, 6, 7, 0, 1, 2]
target = 0   → 4
target = 3   → -1
```

The rotation moves a prefix to the back. In the example, `[4, 5, 6, 7]` moved behind `[0, 1, 2]`.

## Ascending is not non-decreasing

The statement says **ascending order** with **distinct** values. That combination rules out duplicates. `[2, 2, 3]` is non-decreasing, not ascending: it never decreases, but it is not strictly increasing.

This is worth reading carefully because the constraint decides which algorithm is valid. With duplicates, the test "is the left half sorted?" becomes ambiguous — `nums[l] == nums[mid]` could mean a sorted run or a rotation that wrapped onto an equal value — and the clean O(log n) version stops working. LeetCode 81 is the duplicate version and needs a third branch that shrinks the interval by one.

So the constraint is not decoration. `ascending` + `distinct` is what buys the clean branch structure in this solution.

## Why plain binary search fails

Binary search assumes that if `nums[mid] > target`, everything to the right of `mid` is also greater. That assumption comes from global sortedness.

In a rotated array, the right side can fall off a cliff:

```text
nums = [4, 5, 6, 7, 0, 1, 2]
                  mid = 3 → 7
```

`7 > 0`, but the right side holds `0, 1, 2`. So "greater than `mid`" does not mean "to the left". A single comparison with `mid` is no longer enough to discard a side.

What survives the rotation is local: the array is made of **two sorted runs**, one ascending to the pivot, one ascending after it.

```text
[4, 5, 6, 7]  [0, 1, 2]
 ascending      ascending
        ↑ rotation point
```

At any `mid`, one of the two runs is fully contained in `[l, mid]` or in `[mid, r]`. That is the fact the solution uses.

## The sorted half, in one comparison

Compare `nums[l]` with `nums[mid]`:

- `nums[l] <= nums[mid]` → the left run covers `[l, mid]`, so **`[l, mid]` is sorted**.
- `nums[l] > nums[mid]` → the rotation point lies inside `(l, mid]`, so **`[mid, r]` is sorted**.

Why the first implication holds: if the pivot were inside `(l, mid]`, the left run would start high and drop at the pivot, so `nums[l]` would be greater than `nums[mid]`. Since it is not, the drop is after `mid`, and `[l, mid]` is one ascending run.

Now the target can be placed with certainty:

| Branch | Sorted run | Target is clearly outside it | Otherwise |
| --- | --- | --- | --- |
| `nums[l] <= nums[mid]` | `[l, mid]` | `target > nums[mid]` → go right | `target >= nums[l]` → go left; `target < nums[l]` → go right |
| `nums[l] > nums[mid]` | `[mid, r]` | `target < nums[mid]` → go left | `target <= nums[r]` → go right; `target > nums[r]` → go left |

Two branches, each with a boundary comparison, because **the boundary you compare against is the edge of the sorted run**:

- Mid in the left run: the run starts at `l`, so test against `nums[l]`.
- Mid in the right run: the run ends at `r`, so test against `nums[r]`.

That is why one compound comparison with `mid` cannot replace both branches. The half being reasoned about changes with the position of `mid`.

## The code

```python
class Solution:
    def search(self, nums: list[int], target: int) -> int:
        l, r = 0, len(nums) - 1

        while l <= r:
            mid = (l + r) // 2

            if nums[mid] == target:
                return mid

            if nums[l] <= nums[mid]:          # left run [l, mid] is sorted
                if target > nums[mid]:        # above the run's top
                    l = mid + 1
                elif target < nums[mid]:
                    if target < nums[l]:      # below the run's bottom
                        l = mid + 1
                    else:                     # inside [l, mid)
                        r = mid - 1
            else:                             # right run [mid, r] is sorted
                if target < nums[mid]:        # below the run's bottom
                    r = mid - 1
                elif target > nums[mid]:
                    if target > nums[r]:      # above the run's top
                        r = mid - 1
                    else:                     # inside (mid, r]
                        l = mid + 1

        return -1
```

## The two equalities

Both `<=` signs are load-bearing, and both fail on a one-element interval.

**`while l <= r`.** With an inclusive interval `[l, r]`, a single element is still a candidate. `[1]` with `target = 1` runs zero times under `l < r` and returns `-1`. The loop must run while the interval is non-empty, which is `l <= r`.

**`nums[l] <= nums[mid]`.** When the left side has shrunk to one element, `l == mid`, so `nums[l] < nums[mid]` is false. That would send a perfectly sorted left run into the right-run branch, where the reasoning does not hold. Equality is the correct test: one element is trivially sorted.

This is the same lesson as the plain binary search loop: the boundary condition and the interval convention are one decision, not two.

## Where the pointer moves

The direction is easy to invert by accident, so here is the rule stated once:

> To keep the **left** side, move `r`. To keep the **right** side, move `l`.

- Eliminating `[l, mid]` means keeping `[mid + 1, r]` → `l = mid + 1`.
- Eliminating `[mid, r]` means keeping `[l, mid - 1]` → `r = mid - 1`.

In the left branch, "target is above the run" and "target is below the run" both mean the answer is to the right, so both set `l = mid + 1`. That looks like a repeated line; it is two different cases that happen to share a destination. Merging them hides which case is which.

## Why it works

Invariant:

> At the start of each iteration, if `target` is in `nums`, its index lies in `[l, r]`.

The loop starts with the whole array. Each iteration either finds the target or discards a side that provably cannot contain it:

- In the left-run branch, `[l, mid]` is sorted. Above its top or below its bottom, the target is outside; between the bounds, it is inside. The `mid` index itself was already ruled out by the equality check.
- The right-run branch is the mirror: `[mid, r]` is sorted, so the same three positions decide it.

The interval shrinks every iteration because both updates exclude `mid`. When `l > r`, the interval is empty and the invariant says the target is absent.

## Complexity

- **Time: O(log n).** Each iteration halves the interval, exactly like ordinary binary search. The rotation adds a constant number of comparisons, not an extra pass.
- **Space: O(1).** Two indices and a midpoint.

The tempting alternative — scan once to find where the array stops ascending, then binary search the correct run — is O(n) for the scan. It is simple to reason about, but it gives up the complexity the problem asks for.

## The pivot-first approach

A different correct decomposition: find the rotation point in O(log n), then binary search the run that could contain the target, also O(log n).

```text
[4, 5, 6, 7, 0, 1, 2]
          ↑ pivot = 4 (index of the minimum)
```

Then pick the run by comparing `target` with `nums[0]`, and binary search inside it. Total O(log n), two binary searches instead of one.

Both are valid. The single-pass version in this note is fewer moving parts once the "sorted half" fact is understood, and it never needs to special-case the pivot at index `0`. The pivot version is easier to explain and to verify, which makes it a reasonable first draft.

## Tests worth keeping

```python
assert Solution().search([4, 5, 6, 7, 0, 1, 2], 0) == 4
assert Solution().search([4, 5, 6, 7, 0, 1, 2], 3) == -1

# No rotation at all.
assert Solution().search([1, 2, 3], 2) == 1

# Rotation point at the end: the array still descending-looking from l.
assert Solution().search([3, 1], 1) == 1
assert Solution().search([3, 1], 3) == 0

# Single element: the two equality conditions are both about this case.
assert Solution().search([1], 1) == 0
assert Solution().search([1], 0) == -1

# Target at each end of each run.
assert Solution().search([6, 7, 1, 2, 3, 4, 5], 6) == 0
assert Solution().search([6, 7, 1, 2, 3, 4, 5], 5) == 6
assert Solution().search([6, 7, 1, 2, 3, 4, 5], 7) == 1
assert Solution().search([6, 7, 1, 2, 3, 4, 5], 1) == 2
```

Beyond the examples, I checked it against a brute-force `index()` on every rotation of arrays up to length 8, for every target in and out of range, plus 500 random rotations. All agreed. The exhaustive small cases are the useful part: they hit `l == mid`, the rotation at index `0`, and the rotation at the last index without having to think of each one.

## What generalizes

- **Rotation preserves local order.** Global sortedness is lost, but the array is two sorted runs. Binary search still works when you can prove *which* region is ordered.
- **When the predicate depends on position, branch on position first.** Here the first decision is "where is `mid`?", and only then "where is the target?". Getting that order wrong is what makes the code feel arbitrary.
- **The comparison boundary comes from the ordered region.** Left run → compare with `nums[l]`; right run → compare with `nums[r]`. A comparison against `mid` alone cannot express both.
- **Equality in a boundary test is a real decision.** `nums[l] <= nums[mid]` handles the single-element run; `l <= r` handles the single-element interval. Both look like style choices and are not.
- **Duplicates change the algorithm, not just the data.** With equality allowed, the "which half is sorted" test becomes ambiguous and the clean O(log n) branch disappears.
- **Read the constraint words.** "Ascending with distinct values" is a promise the solution depends on.

## Revisit checklist

Re-solve from scratch, then check:

- [ ] Say why ordinary binary search is invalid here, using the `[4,5,6,7,0,1,2]` example.
- [ ] State the fact that guarantees one half is sorted.
- [ ] Explain why `nums[l] <= nums[mid]` uses `<=`, and what `l == mid` does to it.
- [ ] Explain why the left branch compares with `nums[l]` and the right branch with `nums[r]`.
- [ ] Write the pointer rule: keeping left moves `r`; keeping right moves `l`.
- [ ] Trace `[3,1]`, `[1]`, and `[6,7,1,2,3,4,5]` by hand.
- [ ] Explain why `while l <= r` rather than `l < r`.
- [ ] Compare against the pivot-first version and say when you would prefer it.
- [ ] Say what breaks when duplicates are allowed.

## The takeaway

- Rotation leaves two sorted runs; at every `mid`, one of `[l, mid]` or `[mid, r]` is sorted.
- Test the sorted half with `nums[l] <= nums[mid]`, then locate the target relative to that run's boundary.
- Both `<=` signs are correctness, not style: one protects the one-element interval, the other the one-element run.
- Keep the branch structure explicit; the two branches reason about different runs, and merging their conditions hides that.
- O(log n) time, O(1) space, and a constraint — distinct values — that the algorithm depends on.
