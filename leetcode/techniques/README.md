# Techniques

Patterns that outgrow a single problem. Each note works out one mechanism in detail, so the problem solutions can use it without re-deriving it — and so the edge cases live in one place rather than being copied between solutions.

[Where the slow pointer lands](./fast-slow-pointers.md) traces the fast/slow middle loop for odd and even lists, derives the landing index, explains why `fast` starts at `head.next`, and covers the loop that lands one node earlier. [Splitting a linked list at the middle](./splitting-a-linked-list.md) is the two-line cut that turns one list into two, and the order the two lines have to be written in. [Reversing instead of stacking](./reverse-instead-of-stack.md) explains why a backwards traversal is a choice between `O(n)` memory and mutation. [Attaching the remainder after a merge](./merge-remainder.md) covers the `curr1 or curr2` line that finishes a two-list merge.
