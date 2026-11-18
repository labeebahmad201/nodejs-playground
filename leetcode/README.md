# LeetCode

*Pattern-based solutions to the problems I'm working through — one directory per problem. The point isn't the accepted submission; it's naming the invariant or pattern clearly enough to recognize it somewhere else.*

The DSA track is deliberately separate from the topic notes: this is timed practice and pattern recognition, not runtime or architecture depth.

## Problems

| # | Problem | Pattern | Notes |
| --- | --- | --- | --- |
| 19 | [Remove Nth Node From End of List](https://leetcode.com/problems/remove-nth-node-from-end-of-list/) | Fixed-gap two pointers | [09-remove-nth-node-from-end/](./09-remove-nth-node-from-end) ↻ |
| 20 | [Valid Parentheses](https://leetcode.com/problems/valid-parentheses/) | LIFO matching | [02-valid-parentheses/](./02-valid-parentheses) |
| 33 | [Search in Rotated Sorted Array](https://leetcode.com/problems/search-in-rotated-sorted-array/) | Find the sorted half | [10-search-in-rotated-sorted-array/](./10-search-in-rotated-sorted-array) ↻↻↻ |
| 74 | [Search a 2D Matrix](https://leetcode.com/problems/search-a-2d-matrix/) | Two-level binary search | [07-search-a-2d-matrix/](./07-search-a-2d-matrix) |
| 141 | [Linked List Cycle](https://leetcode.com/problems/linked-list-cycle/) | Fast/slow pointers | [05-linked-list-cycle/](./05-linked-list-cycle) |
| 150 | [Evaluate Reverse Polish Notation](https://leetcode.com/problems/evaluate-reverse-polish-notation/) | Stack evaluation | [03-evaluate-rpn/](./03-evaluate-rpn) |
| 155 | [Min Stack](https://leetcode.com/problems/min-stack/) | Derived state + history | [01-min-stack/](./01-min-stack) ↻|
| 206 | [Reverse Linked List](https://leetcode.com/problems/reverse-linked-list/) | In-place pointer rewiring | [06-reverse-linked-list/](./06-reverse-linked-list) |
| 380 | [Insert Delete GetRandom O(1)](https://leetcode.com/problems/insert-delete-getrandom-o1/) | List + index map | [08-insert-delete-getrandom-o1/](./08-insert-delete-getrandom-o1) |
| 704 | [Binary Search](https://leetcode.com/problems/binary-search/) | Halve the search space | [04-binary-search/](./04-binary-search) |

`↻` in the Notes column marks a problem I want to re-solve later. `↻↻↻` marks one that needs repeated revision — more marks, more often.

## How to add a problem

1. Pick the next number and name the directory `{n}-{slug}`.
2. Add the solution plus a `README.md` covering the key invariant, the complexity tradeoff, and what generalizes.
3. Add a row to the table above.
