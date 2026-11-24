# LeetCode

*Pattern-based solutions to the problems I'm working through — one directory per problem, plus a `techniques/` folder for mechanisms that span several. The point isn't the accepted submission; it's naming the invariant or pattern clearly enough to recognize it somewhere else.*

The DSA track is deliberately separate from the topic notes: this is timed practice and pattern recognition, not runtime or architecture depth.

## Problems

| # | Problem | Pattern | Notes |
| --- | --- | --- | --- |
| 19 | [Remove Nth Node From End of List](https://leetcode.com/problems/remove-nth-node-from-end-of-list/) | Fixed-gap two pointers | [09-remove-nth-node-from-end/](./09-remove-nth-node-from-end) ↻ |
| 20 | [Valid Parentheses](https://leetcode.com/problems/valid-parentheses/) | LIFO matching | [02-valid-parentheses/](./02-valid-parentheses) |
| 21 | [Merge Two Sorted Lists](https://leetcode.com/problems/merge-two-sorted-lists/) | Dummy node + tail pointer | [12-merge-two-sorted-lists/](./12-merge-two-sorted-lists) ↻ |
| 22 | [Generate Parentheses](https://leetcode.com/problems/generate-parentheses/) | Backtracking: choose, recurse, undo | [14-generate-parentheses/](./14-generate-parentheses) ↻↻ |
| 23 | [Merge k Sorted Lists](https://leetcode.com/problems/merge-k-sorted-lists/) | Min-heap of the k current heads | [18-merge-k-sorted-lists/](./18-merge-k-sorted-lists) ↻↻ |
| 33 | [Search in Rotated Sorted Array](https://leetcode.com/problems/search-in-rotated-sorted-array/) | Find the sorted half | [10-search-in-rotated-sorted-array/](./10-search-in-rotated-sorted-array) ↻↻↻ |
| 74 | [Search a 2D Matrix](https://leetcode.com/problems/search-a-2d-matrix/) | Two-level binary search | [07-search-a-2d-matrix/](./07-search-a-2d-matrix) |
| 138 | [Copy List with Random Pointer](https://leetcode.com/problems/copy-list-with-random-pointer/) | Two passes + identity map | [13-copy-list-with-random-pointer/](./13-copy-list-with-random-pointer) ↻ |
| 141 | [Linked List Cycle](https://leetcode.com/problems/linked-list-cycle/) | Fast/slow pointers | [05-linked-list-cycle/](./05-linked-list-cycle) |
| 143 | [Reorder List](https://leetcode.com/problems/reorder-list/) | Index the nodes, then merge from both ends | [17-reorder-list/](./17-reorder-list) ↻↻ |
| 150 | [Evaluate Reverse Polish Notation](https://leetcode.com/problems/evaluate-reverse-polish-notation/) | Stack evaluation | [03-evaluate-rpn/](./03-evaluate-rpn) |
| 153 | [Find Minimum in Rotated Sorted Array](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/) | Compare mid to the right end | [11-find-minimum-in-rotated-sorted-array/](./11-find-minimum-in-rotated-sorted-array) ↻↻↻ |
| 155 | [Min Stack](https://leetcode.com/problems/min-stack/) | Derived state + history | [01-min-stack/](./01-min-stack) ↻|
| 206 | [Reverse Linked List](https://leetcode.com/problems/reverse-linked-list/) | In-place pointer rewiring | [06-reverse-linked-list/](./06-reverse-linked-list) |
| 380 | [Insert Delete GetRandom O(1)](https://leetcode.com/problems/insert-delete-getrandom-o1/) | List + index map | [08-insert-delete-getrandom-o1/](./08-insert-delete-getrandom-o1) |
| 704 | [Binary Search](https://leetcode.com/problems/binary-search/) | Halve the search space | [04-binary-search/](./04-binary-search) |
| 739 | [Daily Temperatures](https://leetcode.com/problems/daily-temperatures/) | Monotonic decreasing stack | [15-daily-temperatures/](./15-daily-temperatures) ↻↻ |
| 853 | [Car Fleet](https://leetcode.com/problems/car-fleet/) | Sort by position, compare arrival times | [19-car-fleet/](./19-car-fleet) ↻↻ |
| 901 | [Online Stock Span](https://leetcode.com/problems/online-stock-span/) | Stack of absorbed spans | [16-online-stock-span/](./16-online-stock-span) ↻↻ |

`↻` in the Notes column marks a problem I want to re-solve later. `↻↻↻` marks one that needs repeated revision — more marks, more often.

## Techniques

Some mechanisms are bigger than the problem that first needed them. Those live in [`techniques/`](./techniques), worked out once and linked from the solutions that depend on them.

Five notes so far. [Where the slow pointer lands](./techniques/fast-slow-pointers.md) works out the fast/slow middle loop, both middles for even lists, the `head.next` offset, and the guard inside the loop. [Splitting a linked list at the middle](./techniques/splitting-a-linked-list.md) covers the cut that turns one list into two. [Reversing instead of stacking](./techniques/reverse-instead-of-stack.md) compares the memory a stack costs with the mutation an in-place reverse costs. [Attaching the remainder after a merge](./techniques/merge-remainder.md) explains the `curr1 or curr2` line that finishes a merge. [Heap tuples](./techniques/heap-tuples.md) covers the priority, tiebreaker, payload entry that keeps a heap from comparing the payload.

## How to add a problem

1. Pick the next number and name the directory `{n}-{slug}`.
2. Add the solution plus a `README.md` covering the key invariant, the complexity tradeoff, and what generalizes.
3. Add a row to the table above.
