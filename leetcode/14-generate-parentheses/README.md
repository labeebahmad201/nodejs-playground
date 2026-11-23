# Generate Parentheses

*This is the derivation rather than the summary. It starts from one string in the output, shows why that string has the shape of a path through a tree, and follows the questions that turn that observation into the two conditions in the code.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻↻

## The statement names the set; one output shows how it is built

"Given n, return all well-formed combinations" tells you what to produce and nothing about how. The procedure came from taking a single member of the output, `(()())`, and asking what it is made of. Six characters, each one of two brackets, with only the order changing between answers.

That reframing is the first real step. The answers are not different values; they are different orderings of the same two characters. Once the output is a set of orderings, the question becomes how to enumerate orderings without missing one, which is a different question from how to test one. The move is worth keeping: when a problem asks for a family of structures, take one member apart and ask which decisions produced it.

## A string built left to right makes the prefix the state

The natural way to produce an ordering is to commit to it one character at a time. After k characters, the only thing that can decide the next character is the k characters already written. The future is not known and does not need to be. So the state of the construction is the prefix, and the move is "append one of two characters".

Draw every prefix as a node and every append as an edge to a longer prefix. The result is a binary tree: the root is the empty string, depth k holds every prefix of length k, and a path of length 2n is one candidate string. For `n = 3` the tree has depth 6 and 64 leaves.

This is why the tree is the right model, and it is worth stating precisely. The tree is not an analogy for the search; it is the search written down. Every candidate appears exactly once, and none is missed, because the construction is exhaustive by definition: from each prefix, take each legal next character. Writing the same enumeration as an explicit loop and stack would produce the same traversal; the recursion only makes the prefix visible and gives the undo for free.

The model earns its place because it separates three questions that otherwise blur together. What are the candidates? They are the paths. Which ones are valid? That is a test on a node. How do I stop walking a branch? By returning from it. Without the tree there is no clear place to put any of the three.

## The tree is complete and says nothing about correctness

`)))(((` is a path through it, produced by always taking the closing branch. The tree has no opinion about that path, and the same is true of the other 58 invalid leaves. Completeness is what the tree provides; correctness has to be brought in from outside.

There are two places to apply it. At the leaf, you build all 64 strings and keep the 5 that pass a check, which is correct and pays for 59 strings you throw away. At the edge, you look at a prefix and refuse to extend it when no extension could ever be valid. The second is what backtracking means here: not a separate algorithm, just a depth-first walk that returns early from a node it can prove is doomed.

The second option has a requirement. If the only way to recognise a bad string were to see the whole string, the tree would buy nothing. So the question that decides the rest of the solution is whether badness is visible in a prefix.

## Badness is visible at the character

Look at why `)))(((` cannot be rescued. The final counts are three and three, so counting alone sees nothing wrong. The problem is the first character: a `)` was written when no `(` had been written. Brackets pair left to right, so that `)` needs an `(` before it. The opens that come later arrive after it, and none of them can pair with it — not now, not ever.

That is the observation the solution rests on. A prefix that closes more than it opens is dead, and no suffix can revive it. Badness is not a property of the finished string alone; it is a property of every prefix along the way. Once that is true, a node can be judged at the moment it is created, which is exactly what pruning needs.

The condition follows. With `open` and `close` counting the prefix, a `)` may be written only while `close < open`, or equivalently while the balance `open - close` is positive. At the root the condition reads `0 < 0`, which is false, so the branch that starts with `)` is never created. There is no special case for the first character; the rule that governs every other character governs that one too. A rule that needs no exception is usually the right rule.

## A second condition exists for a different job

The balance rule keeps invalid strings out, but it does not stop the tree from growing forever. `(`, `(`, `(`, `(` never violates `close < open`, and nothing about rejecting closes ever stops the opens. The second condition supplies the bound: write `(` only while `open < n`.

The two conditions do different work, which is why there are two. The balance rule is about correctness, preventing a close that can never be matched. The budget rule is about finiteness, bounding every path at 2n characters and forcing a complete prefix to contain exactly n of each. Remove the balance rule and you generate all 20 arrangements at `n = 3`, invalid ones included. Remove the budget and the tree is infinite. Each condition is doing a job the other cannot.

This is also where the shape of the code was settled. Opening cannot use the balance test, because at the empty string that test is false while opening is the only legal move. The two choices ask different questions. Opening asks whether the n opens have all been spent; closing asks whether there is an open waiting to be closed. Two questions about the same state, so two conditions, not alternatives.

That distinction is why the second branch cannot be an `elif`. At `((`, the state `(2, 0)`, both `2 < 3` and `0 < 2` hold, and both children are part of the answer. An `elif` encodes the assumption that failing the first test implies the second applies, which is false at exactly this node; for `n = 3` it returns `((()))` alone instead of five strings.

## Walking it

Once the two conditions exist, the descent is mechanical:

```text
""        (0,0)   open: 0<3 yes    close: 0<0 no    → must open
"("       (1,0)   open: yes        close: 0<1 yes   → both, try open
"(("      (2,0)   open: yes        close: yes       → both, try open
"((("     (3,0)   open: 3<3 no     close: yes       → must close
"((()"    (3,1)   open: no         close: yes       → must close
"((())"   (3,2)   open: no         close: yes       → must close
"((()))"  (3,3)   open: no         close: 3<3 no    → record, return
```

The interesting part is the way back. The answer is recorded at `(3, 3)` and that frame returns; the three `)` pop as those frames unwind and the path returns to `(((`; then the frame at `(2, 0)` pops its own `(`, leaving `((`. That frame had finished its opening branch, so its second condition finally runs against the state it started with, writes `)`, and opens the `(()` subtree. Nothing was copied and nothing was reset globally: the parent resumed exactly where it left off. That is the whole of backtracking, and the `pop` is the only bookkeeping it needs.

The rest of the tree, with the blocked choice labelled at each node:

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

Twenty-two nodes instead of sixty-four, and every leaf is an answer. The pruning happened on the way down, so there is nothing left to filter at the end.

## The path has to be mutable

The walk needs to add a character on the way down and remove it on the way back. A Python string cannot do the second half: it is immutable, so removing the last character means building a new string from everything but the last. Carrying a string and extending it copies at every level, `1 + 2 + … + 2n` per path, quadratic in the depth and paid again for each answer.

A list supports exactly the two operations the walk needs, `append` and `pop`, both constant time. The string is produced once, with `"".join(path)`, at the leaf. This is not only a speed argument. The path is a stack, and the recursion's return is the pop; a list is the representation that matches the algorithm, while a string forces you to copy the stack at every level.

## The code

```python
class Solution:
    def generateParenthesis(self, n: int) -> list[str]:
        result = []                       # answers land here, at the leaves

        def backtrack(openP: int, closedP: int, path: list[str]) -> None:
            # All n of each have been written. The rules guarantee this is
            # the only state with no legal move, so it is the only terminal.
            if openP == closedP == n:
                result.append("".join(path))   # the only place we pay for a string
                return

            # Opening spends budget. It cannot be `closedP < openP`:
            # at (0, 0) that is false, yet opening is the only legal move.
            if openP < n:
                path.append("(")
                backtrack(openP + 1, closedP, path)
                path.pop()                # undo before the sibling branch

            # Closing spends balance: there must be an unmatched "(".
            # At (0, 0) this is false, which is why ")" cannot start the string.
            if closedP < openP:
                path.append(")")
                backtrack(openP, closedP + 1, path)
                path.pop()

        backtrack(0, 0, [])
        return result
```

`n` is not a parameter because it never changes; the inner function closes over it, and only the changing state travels down the recursion. `openP` and `closedP` need no undo because integers are immutable: `openP + 1` hands the child a new value and leaves the parent's untouched. That makes `path` the only shared object, and therefore the only thing that has to be restored.

The base case is a chained comparison, `openP == closedP == n`, read as "both counters have been spent". There is no other terminal state, because the rules never let `close` pass `open` and never let `open` pass `n`. That also means a mistake in either rule shows up as missing or extra answers rather than as a crash, which is why the counts in the tests are the thing to check.

One detail in the signature is a portability bug. `void` is not a Python type, and up to Python 3.13 annotations are evaluated when the `def` executes, so `-> void` raises `NameError` at definition time. On Python 3.14 and later annotations are deferred, so the same line can run locally and fail on submit. Use `-> None`.

## How many calls, how many answers

The number of answers is the `n`-th Catalan number, `C(n) = C(2n, n) / (n + 1)`, which runs 1, 2, 5, 14, 42, 132, 429, 1430 for `n = 0` through 7. Each answer is joined in `O(n)`, so the time is `O(n · C(n))`, with `O(n)` space for the recursion and the path beyond the output.

The tree is larger than the answer count but the same order. For `n = 3` it makes 22 calls for 5 answers; for `n = 8`, 6,917 calls for 1,430. Generating all `2^(2n)` strings instead would be 64 at `n = 3` and 65,536 at `n = 8`, and generating only arrangements with `n` of each would still be 12,870 at `n = 8`.

One count trips people up. A single root-to-leaf path makes `2n` choices, which is `2n + 1` calls including the one that records the answer. The whole tree calls the function 22 times at `n = 3`, because every prefix is its own call. Both numbers are right; one is depth, the other is tree size.

## The wrong turns

The most tempting one is trying to run the whole solution on a single condition. If "keep the counts legal" feels like one rule, the code collapses to `if`/`elif`, and the tree quietly loses every branch where both choices were available.

The next is closing on `close < n` instead of `close < open`. It looks right because it enforces the totals, and it produces all 20 arrangements at `n = 3`, including `)))(((` and `(()))(`. The counts were never the point; the pairing was. The strings are born invalid because the rule looked at the budget and not at the balance.

Forgetting the `pop` is the mistake that survives testing. The leftmost path never needs to undo anything, so the first answer is correct, and every answer after it carries characters from branches that were abandoned:

```text
["((()))", "((())))())", "((())))()))()", ...]
```

The recursion returns, but the list does not; the `pop` is what makes the return mean something.

Two smaller ones. Generating all strings and filtering them at the end is correct and pays for the whole tree to keep a fraction of it, which is the approach the tree was supposed to replace. And trusting the `return` in the base case to stop the recursion is misplaced: at `(n, n)` both conditions are already false, so the function would stop anyway. The `return` records the answer and skips two comparisons; it is not a safety net for a wrong rule.

## Edge cases

`n = 0` returns `[""]`, one empty string, which LeetCode never asks for because its constraint starts at 1. `n = 1` returns `["()"]` and `n = 2` returns `["(())", "()()"]`, both worth tracing by hand once. At the maximum `n = 8` the recursion is 16 levels deep and returns 1,430 strings.

There are no duplicates, because every root-to-leaf path is a different string, and the order of the results depends only on which condition is tried first. LeetCode accepts any order, so the ordering is a free choice.

## The shape to remember

The output is a set of orderings, so the construction is a sequence of binary choices, so a prefix is a state, so the candidates are the paths of a tree. The tree is complete by construction and correct by nothing, which is why it needs rules, and the rules are only usable because badness shows up in a prefix. Balance protects correctness, the budget protects finiteness, and the two together make every leaf an answer.

The code is that argument written down. Two independent conditions because the two choices ask different questions, a shared list because the path has to be undone, a `pop` after every call because the sibling branch must see the parent's state, and a single `join` at the leaf because the string only exists once the answer is complete.
