# LeetCode

*Pattern-based solutions to the problems I'm working through — one directory per problem. The point isn't the accepted submission; it's naming the invariant or pattern clearly enough to recognize it somewhere else.*

The DSA track is deliberately separate from the topic notes: this is timed practice and pattern recognition, not runtime or architecture depth.

## Problems

| # | Problem | Pattern | Notes |
| --- | --- | --- | --- |
| 20 | [Valid Parentheses](https://leetcode.com/problems/valid-parentheses/) | LIFO matching | [02-valid-parentheses/](./02-valid-parentheses) |
| 150 | [Evaluate Reverse Polish Notation](https://leetcode.com/problems/evaluate-reverse-polish-notation/) | Stack evaluation | [03-evaluate-rpn/](./03-evaluate-rpn) |
| 155 | [Min Stack](https://leetcode.com/problems/min-stack/) | Derived state + history | [01-min-stack/](./01-min-stack) |
| 704 | [Binary Search](https://leetcode.com/problems/binary-search/) | Halve the search space | [04-binary-search/](./04-binary-search) |

## How to add a problem

1. Pick the next number and name the directory `{n}-{slug}`.
2. Add the solution plus a `README.md` covering the key invariant, the complexity tradeoff, and what generalizes.
3. Add a row to the table above.
