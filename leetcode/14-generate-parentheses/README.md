# Generate Parentheses

*Read one answer character by character and the problem changes shape: every position was a choice between `(` and `)`, so each answer is a path through a decision tree. What is left is deciding which paths to stop walking, and how to walk back out of one.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻↻

## Reading one answer as a path

Take `(()())` for `n = 3` and look at it one position at a time. At the first character you could have written either bracket, at the second either again, and so on for six positions. The string is one route through a binary tree six levels deep, and that tree has `2^6 = 64` leaves. Five of them are the answer.

```text
position:   1  2  3  4  5  6
wrote:      (  (  )  (  )  )
could have: (  )  (  )  (  )
```

A node in that tree is a prefix, an edge is one character, and a leaf is a finished string. Saying "generate every combination" and saying "walk the tree" describe the same act. The picture to keep is that the tree is the search space and each answer is one path through it — not a thing you look up, but a route you take.

## The tree contains strings that can never work

`)))(((` is a route too, taken by always choosing the closing branch. The tree does not know it is wrong; it explores potential answers, and validity is something you bring to it.

There are two places to apply that knowledge. At the leaf, you build all 64 strings and filter them down to 5, which is correct and pays for 59 strings you throw away. At the edge, you refuse to extend a prefix that can never grow into a valid string. The second is backtracking, and it needs a test that works on a partial string. Finding that test is the only hard part of the problem.

## A close needs an open

Brackets pair from left to right, so a `)` needs an unmatched `(` before it. It cannot borrow from a `(` that appears later. Counting what has been written so far as `open` and `close`, the rule is: write `)` only while `close < open`.

That is a pairing rule, not a counting rule. With `n = 3`, the third `)` needs the third `(` to already exist. A fourth `)` would leave four closes against at most three opens, so one of them has no partner, and no later character can give it one. The same idea in balance form is that `balance = open - close` must stay positive before a closing bracket.

The first character shows why no special case is needed. At `(0, 0)`, `close < open` reads `0 < 0` and is false, so the branch that starts with `)` is never created. It is not created and then rejected; it does not exist in this search at all.

The mistake here is closing whenever there is budget left, `if close < n`. That generates every arrangement of `n` opens and `n` closes — all 20 for `n = 3` — including `)))(((` and `(()))(`. The counts are right and the pairing is wrong, and the invalid strings are born at the moment of generation, where no later check can tell you which choice caused them.

## You own n of each

Write `(` only while `open < n`. That part is obvious. What is not obvious is why this rule cannot be a comparison between the two counters, and the answer is the state at the very beginning. Both counters are zero there, so `close < open` is false, yet writing `(` is exactly what has to happen. The only reason opening is legal is that none of the `n` opens have been spent yet.

That is what fixes the shape of the code: opening is a budget check and closing is a balance check. The two choices are asking different questions — "do I still have an opening bracket to spend?" and "is there an opening bracket waiting to be closed?" — and either can be true while the other is false.

The rules are also specific to this problem in a way worth naming. The tree is generic: any problem with two choices at each step has the same shape. The pruning rules are not generic; they encode what well-formed parentheses mean. A different bracket problem keeps the tree and replaces the rules.

## Walking down, then walking back up

Descending along the leftmost path, the two conditions decide everything:

```text
""        (0,0)   open: 0<3 yes    close: 0<0 no    → must open
"("       (1,0)   open: yes        close: 0<1 yes   → both, try open
"(("      (2,0)   open: yes        close: yes       → both, try open
"((("     (3,0)   open: 3<3 no     close: yes       → must close
"((()"    (3,1)   open: no         close: yes       → must close
"((())"   (3,2)   open: no         close: yes       → must close
"((()))"  (3,3)   open: no         close: 3<3 no    → record, return
```

The return trip is the part that is easy to wave at. The answer is recorded and the frame returns; the three `)` pop as those frames unwind, bringing the path back to `(((`; then the frame at `(2, 0)` pops its own `(`, leaving `((`. That frame has finished its opening branch, so its second condition now runs against the restored state, writes `)`, and starts the `(()` subtree. Nothing global was reset and no state was copied — the parent simply resumed with the state it had before descending. That is the whole of backtracking.

The rest of the tree, with the blocked choice labelled at every node:

```text
""  (0,0)
└─ "("  (1,0)
   ├─ "(("  (2,0)
   │  ├─ "((("  (3,0)              open blocked: 3 == n
   │  │  └─ "((()"  (3,1)
   │  │     └─ "((())"  (3,2)
   │  │        └─ "((()))"  (3,3)  ✓
   │  └─ "(()"  (2,1)
   │     ├─ "(()("  (3,1)
   │     │  └─ "(()()"  (3,2)
   │     │     └─ "(()())"  (3,3)  ✓
   │     └─ "(())"  (2,2)          close blocked: close == open
   │        └─ "(())("  (3,2)
   │           └─ "(())()"  (3,3)  ✓
   └─ "()"  (1,1)                  close blocked: close == open
      ├─ "()("  (2,1)
      │  ├─ "()(("  (3,1)
      │  │  └─ "()(()"  (3,2)
      │  │     └─ "()(())"  (3,3)  ✓
      │  └─ "()()"  (2,2)
      │     └─ "()()("  (3,2)
      │        └─ "()()()"  (3,3)  ✓
```

Twenty-two nodes instead of sixty-four, and every leaf in that tree is a valid answer. Because the pruning happened on the way down, there is nothing left to filter at the end.

## Building the string at the leaf

An answer has to become a string eventually. The tempting approach carries a string and extends it at each step, which copies the whole thing every level because Python strings are immutable. Along one path the lengths run `1, 2, 3, …, 2n`, so the copying is quadratic in the depth, and it is paid again for every separate answer.

Keeping one shared list and appending to it avoids that. `append` and `pop` are constant time, and `"".join(path)` runs once, at the moment a finished answer is recorded. For `n = 3` that is 22 calls and five joins of length 6; for `n = 8` it is 6,917 calls and 1,430 joins of length 16. The difference is not a micro-optimisation; it is the difference between `O(n)` and `O(n²)` per answer.

The string version is still correct, and it has one advantage: since nothing is mutated, it needs no undo step. Both designs are legitimate. The list is the one to default to, because the undo habit is what the harder search problems require.

## The code

```python
class Solution:
    def generateParenthesis(self, n: int) -> list[str]:
        result = []                       # answers land here, at the leaves

        def backtrack(openP: int, closedP: int, path: list[str]) -> None:
            # 1. Stopping condition: all n of each have been written.
            #    The rules guarantee closedP can never pass openP, and
            #    openP can never pass n, so this is the only terminal state.
            if openP == closedP == n:
                result.append("".join(path))   # the only place we pay for a string
                return

            # 2. Opening spends budget: openP < n.
            #    It cannot be `closedP < openP` — at (0, 0) that is false,
            #    yet opening is exactly what we must do.
            if openP < n:
                path.append("(")
                backtrack(openP + 1, closedP, path)
                path.pop()                # undo before the sibling branch

            # 3. Closing spends balance: there must be an unmatched "(".
            #    At (0, 0) this is false, which is why ")" can never start
            #    the string. After an "(" it can become true.
            if closedP < openP:
                path.append(")")
                backtrack(openP, closedP + 1, path)
                path.pop()

        backtrack(0, 0, [])
        return result
```

A few things in there are load-bearing. `n` is not a parameter because it never changes, so the inner function closes over it and only the changing state is passed down. `openP` and `closedP` need no undo because integers are immutable: `openP + 1` hands the child a new value and leaves the parent's untouched. That makes `path` the only shared object, and therefore the only thing that needs restoring.

The base case is a chained comparison, `openP == closedP == n`, which reads as "both counters have been spent." No other terminal state exists, because the rules never let `close` pass `open` and never let `open` pass `n`. That also means an off-by-one in either rule shows up as missing or extra answers rather than as a crash, which is why the counts in the tests matter.

The counters and the path stay in sync as well: every recursive call writes exactly one character, so `len(path) == openP + closedP` in every frame. That invariant is what lets the base case talk about counters instead of the length of the string.

One detail in the signature is a portability bug. `void` is not a Python type, and up to Python 3.13 annotations are evaluated when the `def` executes, so `-> void` raises `NameError` at definition time. On Python 3.14 and later annotations are deferred, so the same line can run locally and fail on submit. Use `-> None`.

## Why both conditions can fire at once

At `(2, 0)`, the state after `((`, both conditions hold: `2 < 3` and `0 < 2`. That node has two children, `(((` and `(()`, and both subtrees are part of the answer. Writing the second branch as `elif` encodes the assumption that if you did not open, you must close, which is false at exactly this state. For `n = 3` the `elif` version returns one string, `((()))`, instead of five.

The order of the two blocks does not matter for correctness. Swapping them changes the order the answers come out in, nothing else.

## What the pop is actually doing

Every frame shares the same list, and only one frame runs at a time. The contract is append, recurse, pop: the child sees the new character, and the sibling branch must not. Omitting the pop leaves the character in place for every branch that follows, and the output becomes

```text
["((()))", "((())))())", "((())))()))()", ...]
```

The first answer is correct, which is why the bug survives a quick look: the leftmost path never has to undo anything, so only the later answers show the damage. The recursion returns, but the list does not; the pop is what makes the return mean something.

## How much work it is

The number of valid strings is the `n`-th Catalan number, `C(n) = C(2n, n) / (n + 1)`, which runs 1, 2, 5, 14, 42, 132, 429, 1430 for `n = 0` through 7. The search produces `C(n)` answers and joins each one in `O(n)`, so the time is `O(n · C(n))`, with `O(n)` space for the recursion and the current path beyond the output.

The tree is larger than the answer count but the same order. For `n = 3` it makes 22 calls for 5 answers; for `n = 8`, 6,917 calls for 1,430. Generating all `2^(2n)` strings instead would be 64 at `n = 3` and 65,536 at `n = 8`, and generating only arrangements with `n` of each would still be 12,870 at `n = 8`.

One count trips people up. A single root-to-leaf path makes `2n` choices, which is `2n + 1` calls including the one that records the answer. The whole tree calls the function 22 times at `n = 3`, because every prefix is its own call. Both numbers are right; one is depth, the other is tree size.

## The mistakes, in one place

`-> void` fails on LeetCode's Python and passes on 3.14+ locally. `elif` between the two choices returns one answer instead of five. Closing on `close < n` instead of `close < open` generates all 20 arrangements at `n = 3`, invalid ones included. Dropping the `pop` leaves every answer after the first full of characters from abandoned branches. Generating every string before checking it is correct but pays for the whole tree to keep a small fraction of it.

The subtler one is trusting the `return` in the base case to stop the recursion. At `(n, n)` both conditions are already false, so the function would stop anyway; the `return` records the answer and skips two comparisons. That is fine as long as you do not rely on it to cover a mistake in the rules.

## Edge cases

`n = 0` returns `[""]`, one empty string, which LeetCode never asks for because its constraint starts at 1. `n = 1` returns `["()"]` and `n = 2` returns `["(())", "()()"]`, both worth tracing by hand once. At the maximum `n = 8` the recursion is 16 levels deep and returns 1,430 strings.

There are no duplicates, because every root-to-leaf path is a different string, and the order of the results depends only on which condition is tried first. LeetCode accepts any order, so the ordering is a free choice.

## The version to remember

Every answer is a path of `2n` binary choices, and the tree is the search space rather than the answer set. A `)` needs an `(` that already exists, so `close < open`; the root state makes that false, which is why no closing branch exists at the start. Opening is a budget check, `open < n`, and that is a different question from the balance check, which is why both conditions are tested at every node and never chained with `elif`.

Record the answer at `(n, n)` by joining a list, keep the list shared so append and pop are constant time, and pop after every recursive call so the sibling branch sees the state its parent had. The rules belong to the problem; the tree, the constraints checked before descending, and the undo belong to backtracking.
