# Search a 2D Matrix: Find the Row, Then the Column

*The matrix is two-dimensional only in layout. The guarantees make it one sorted sequence cut into rows, so two binary searches — one over row intervals, one inside the chosen row — are enough.*

Part of the [`leetcode/`](../) section. The inner helper is the binary search from
[`04-binary-search`](../04-binary-search), applied to a single row.

---

## The problem

Given an `m × n` matrix and a `target`, return `true` if the target is in the matrix.

The input comes with two guarantees:

1. Each row is sorted in non-decreasing order.
2. The first integer of each row is greater than the last integer of the previous row.

```text
matrix = [
  [ 1,  3,  5,  7],
  [10, 11, 16, 20],
  [23, 30, 34, 60],
]

target = 3   → true
target = 13  → false
```

The required complexity is **O(log(m · n))**.

## The guarantee that matters

The second guarantee is the one that makes binary search possible. It means every element of row
`i` is greater than every element of row `i - 1`:

```text
row 0: [ 1,  3,  5,  7]   range [1, 7]
row 1: [10, 11, 16, 20]   range [10, 20]
row 2: [23, 30, 34, 60]   range [23, 60]
```

The row ranges are disjoint and increasing. The matrix is a sorted sequence that has been cut into
rows. The first column is also sorted (`1, 10, 23`), but the stronger fact is that the ranges do not
overlap. That is what lets a binary search decide which row can contain the target without looking
at the others.

## The outer search: which row?

At the midpoint row, compare the target with the row's first and last values:

| Condition | Meaning | Action |
| --- | --- | --- |
| `target < first` | target is in an earlier row | `right = mid_row - 1` |
| `target > last` | target is in a later row | `left = mid_row + 1` |
| `first <= target <= last` | target can only be in this row | binary search the row |

The range check is the row-selection predicate. Because the ranges are disjoint, there is at most
one row where `first <= target <= last`. When that row is found, returning the inner search's
result is safe even if the inner search fails: the outer check has already proved that no other row
can contain the target.

At every step, the rows outside `[left, right]` are known not to contain the target. If
`target < first`, every row from `mid_row` onward starts at a value greater than the target, so
none of them can contain it. If `target > last`, every row up to `mid_row` ends at a value less
than the target, so none of them can contain it. The range case leaves exactly one candidate row.
When the loop ends, no candidate row remains.

The explicit `first == target` check is a shortcut for column `0`. The range check would also catch
it, but the shortcut avoids the inner call.

Searching the first column first is the same idea: it is sorted, so you can locate the row whose
first element is the largest one less than or equal to the target (if such a row exists). But that
row is only a candidate until you check that the target is less than or equal to its last element.
The code combines those checks: the range test selects the row directly, and the outer binary
search uses both endpoints.

## The inner search: which column?

Once the row is chosen, it is a normal sorted one-dimensional array. The helper is exactly the
binary search from [`04-binary-search`](../04-binary-search):

```python
# target is captured from the enclosing searchMatrix.
def binary_search(row):
    left = 0
    right = len(row) - 1

    while left <= right:
        mid = (left + right) // 2
        if row[mid] == target:
            return True
        elif target < row[mid]:
            right = mid - 1
        else:
            left = mid + 1

    return False
```

Same inclusive `right`, same `left <= right` loop condition, and same `//` midpoint. The only
difference is the input: one row instead of the whole array.

## The code

```python
class Solution:
    def searchMatrix(self, matrix: list[list[int]], target: int) -> bool:
        def binary_search(row: list[int]) -> bool:
            left = 0
            right = len(row) - 1

            while left <= right:
                mid = (left + right) // 2
                if row[mid] == target:
                    return True
                elif target < row[mid]:
                    right = mid - 1
                else:
                    left = mid + 1

            return False

        left = 0
        right = len(matrix) - 1
        last_col = len(matrix[0]) - 1

        while left <= right:
            mid_row = (left + right) // 2
            first = matrix[mid_row][0]
            last = matrix[mid_row][last_col]

            if first == target:
                return True
            elif first <= target <= last:
                return binary_search(matrix[mid_row])
            elif target < first:
                right = mid_row - 1
            else:
                left = mid_row + 1

        return False
```

The constraints guarantee at least one row and at least one column, so `matrix[0]` and
`len(matrix[0]) - 1` are safe. No empty-matrix guard is needed for this problem.

The final `return False` is essential. If the outer loop exhausts the rows without finding a range
that contains the target, the target is absent. A miss inside the chosen row is also conclusive,
because the row ranges are disjoint.

## Edge cases

- **Target outside the matrix.** The outer search moves past the first or last row and returns
  `false`.
- **Single row.** The outer loop selects row `0`; the range check either searches it or rules it
  out.
- **Single column.** `last_col` is `0`, so the range check is just an equality check. The inner
  binary search then runs on a one-element row.
- **Duplicates within a row.** The row is still non-decreasing, so binary search works. The outer
  ranges remain disjoint because the cross-row guarantee is strict.

## Complexity

Let `m` be the number of rows and `n` the number of columns.

- **Outer binary search:** O(log m) iterations, O(1) work per iteration.
- **Inner binary search:** O(log n), called at most once.
- **Total time:** O(log m + log n) = **O(log(m · n))**.
- **Space:** O(1) extra.

The inner search runs at most once, after the outer loop has found the row; it is not repeated for
each outer iteration. If it were, the cost would be O(log m · log n). Here the phases are
sequential, so the costs add.

If no row contains the target, only the outer search runs, so the cost is O(log m), which is still
within O(log(m · n)).

`log(m · n) = log m + log n`, which is why the two searches together meet the required bound.

For comparison:

| Approach | Time |
| --- | --- |
| Scan every row, binary search each | O(m log n) |
| Binary search rows, linear scan the chosen row | O(log m + n) |
| Binary search rows, binary search the chosen row | O(log m + log n) = O(log(m · n)) |
| Flatten the matrix and binary search | O(log(m · n)) |

Space is O(1) because the helper is iterative and the matrix is not copied. A recursive binary
search would use O(log n) stack space, but this one does not.

## The same search, flattened

Because the matrix is sorted in row-major order, it can be treated as a single sorted array of
length `m · n`:

```python
class Solution:
    def searchMatrix(self, matrix: list[list[int]], target: int) -> bool:
        m, n = len(matrix), len(matrix[0])
        left = 0
        right = m * n - 1

        while left <= right:
            mid = (left + right) // 2
            row, col = divmod(mid, n)
            value = matrix[row][col]

            if value == target:
                return True
            elif value < target:
                left = mid + 1
            else:
                right = mid - 1

        return False
```

`divmod(mid, n)` converts the flat index into `(row, col)`. This is the same O(log(m · n)) search
with one loop instead of two. The two-level version makes the row/column structure explicit; the
flattened version makes the global order explicit. Both rely on the same guarantee.

## Tests worth keeping

```python
matrix = [
    [1, 3, 5, 7],
    [10, 11, 16, 20],
    [23, 30, 34, 60],
]

assert Solution().searchMatrix(matrix, 3) is True
assert Solution().searchMatrix(matrix, 13) is False
assert Solution().searchMatrix(matrix, 1) is True
assert Solution().searchMatrix(matrix, 60) is True
assert Solution().searchMatrix(matrix, 0) is False
assert Solution().searchMatrix(matrix, 61) is False

# Row boundaries.
assert Solution().searchMatrix(matrix, 7) is True    # last of row 0
assert Solution().searchMatrix(matrix, 10) is True   # first of row 1
assert Solution().searchMatrix(matrix, 23) is True   # first of row 2
```

```python
# Single row, single column, and a 1 × 1 matrix.
assert Solution().searchMatrix([[1, 3, 5]], 3) is True
assert Solution().searchMatrix([[1, 3, 5]], 4) is False
assert Solution().searchMatrix([[1], [3], [5]], 3) is True
assert Solution().searchMatrix([[1], [3], [5]], 4) is False
assert Solution().searchMatrix([[5]], 5) is True
assert Solution().searchMatrix([[5]], 3) is False

# Duplicates within a row are allowed; row ranges still cannot overlap.
assert Solution().searchMatrix([[1, 1, 3], [4, 4, 5]], 1) is True
assert Solution().searchMatrix([[1, 1, 3], [4, 4, 5]], 2) is False
```

The row-boundary cases are the ones that catch an outer search that compares only the first column
and forgets that a target greater than the first element can still belong to the same row. The
single-column cases catch the opposite mistake: assuming there is always more than one column.

I also compared both versions against a brute-force scan on random valid matrices.

## What generalizes

- **Read the guarantees before choosing the algorithm.** The second guarantee is what makes the
  matrix globally sorted. Without it, row ranges can overlap and the outer search can skip the row
  that contains the target.
- **Binary search over intervals, not just values.** The outer search compares the target with both
  endpoints of each row. The same pattern works for any ordered collection of disjoint ranges.
- **Sequential logarithmic phases add.** O(log m + log n) = O(log(m · n)). If the inner search were
  inside the outer loop, the cost would multiply instead.
- **Flattening is a change of coordinates.** A row-major sorted matrix is a sorted array;
  `mid // n` and `mid % n` convert the index. This is useful when the two-dimensional shape is only
  a layout detail.
- **Weaker guarantees need a different algorithm.** If rows and columns are sorted but row ranges
  may overlap, the global binary search is wrong; the staircase walk from a corner is O(m + n)
  instead (LeetCode 240).

## The takeaway

- The cross-row guarantee turns the matrix into one sorted sequence in row-major order.
- Binary search the row intervals to find the only row that can contain the target.
- Binary search that row for the column.
- O(log m + log n) = O(log(m · n)) time, O(1) space.
- A miss inside the chosen row is conclusive because the row ranges are disjoint.
- Flattening the matrix is the same search with one loop.
