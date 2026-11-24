# Techniques

Patterns that outgrow a single problem. Each note works out one mechanism in detail, so the problem solutions can use it without re-deriving it — and so the edge cases live in one place rather than being copied between solutions.

The first entry is [where the slow pointer lands](./fast-slow-pointers.md). It traces the fast/slow middle loop for odd and even lists, derives the landing index, explains why `fast` starts at `head.next`, and covers the other loop that lands one node earlier.
