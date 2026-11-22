# Generate Parentheses

*The output has to be well-formed, and "well-formed" is a property of every prefix, not just the finished string. That single fact is what turns a generate-everything-and-filter problem into a tree you can prune while you build.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻↻ This is the cleanest example of the backtracking template: a state, two choices, constraints checked *before* descending, and an undo step. Get this one automatic and the harder search problems are variations.

---

## The problem

Given `n` pairs of parentheses, return every well-formed combination.

```text
n = 3  →  ["((()))", "(()())", "(())()", "()(())", "()()()"]
```

Every result has exactly `2n` characters: `n` opening and `n` closing. The order is what varies, and most orders are invalid.

## The output is a path of decisions

Look at `(()())` one character at a time. At each position you chose `(` or `)`. So the whole search space is a binary tree of depth `2n`:

```text
""  →  "(" or ")"
        then "(" or ")"
        ...
```

For `n = 3` that is `2^6 = 64` paths. Only 5 of them are valid. Generating all 64 and filtering works, but it throws away 59 paths at the end — after building them.

The alternative is to never build an invalid prefix in the first place. That requires a rule you can check *at every step*, not just at the end.

## The invariant: the balance never goes negative

Walk the string left to right and keep `balance = opens - closes`.

```text
( ( ) ( ) )
1 2 1 2 1 0     valid: balance is never negative, ends at 0
```

```text
( ) ) ( ( )
1 0 -1 ...      invalid: once it goes negative, no suffix can repair it
```

That last point is the whole justification for pruning: **a prefix with negative balance is dead, no matter what follows.** You do not need to see the rest of the string to reject it.

The same idea in terms of counters at a partial state `(openP, closedP)`:

| Choice | Allowed when | Why |
| --- | --- | --- |
| add `(` | `openP < n` | you only have `n` to spend |
| add `)` | `closedP < openP` | there must be an unmatched `(` for it to close |

`closedP < openP` is exactly "the balance is positive", i.e. the next character can be a closing one. And because `openP ≤ n` is enforced separately, the tree can never grow past `2n`.

Two consequences worth stating plainly:

- **The first character can only be `(`.** At `(0, 0)`, `closedP < openP` is `0 < 0`, false. No special case needed; the constraint handles it.
- **Every non-finished state has at least one legal move.** If `openP == closedP < n`, open is allowed. If `closedP < openP`, close is allowed. So pruning never creates a dead end — every branch that is explored reaches a valid leaf.

## The tree for n = 3

Each node is a prefix `(openP, closedP)`. The five leaves are the five answers.

```text
""  (0,0)
└─ "("  (1,0)
   ├─ "(("  (2,0)
   │  ├─ "((("  (3,0)              open blocked: open == n
   │  │  └─ "((()"  (3,1)
   │  │     └─ "((())"  (3,2)
   │  │        └─ "((()))"  (3,3)  ✓
   │  └─ "(()"  (2,1)
   │     ├─ "(()("  (3,1)
   │     │  └─ "(()()"  (3,2)
   │     │     └─ "(()())"  (3,3)  ✓
   │     └─ "(())"  (2,2)          close blocked: closed == open
   │        └─ "(())("  (3,2)
   │           └─ "(())()"  (3,3)  ✓
   └─ "()"  (1,1)                  close blocked: closed == open
      ├─ "()("  (2,1)
      │  ├─ "()(("  (3,1)
      │  │  └─ "()(()"  (3,2)
      │  │     └─ "()(())"  (3,3)  ✓
      │  └─ "()()"  (2,2)
      │     └─ "()()("  (3,2)
      │        └─ "()()()"  (3,3)  ✓
```

Read the blocked annotations: at `""` the closing branch does not exist; at `"()"` and `"(())"` the balance is zero, so no `)` can follow; at any `(3, ·)` node the opening allowance is spent.

The tree has 22 nodes, not 64. That is the pruning paying for itself.

## The code

```python
class Solution:
    def generateParenthesis(self, n: int) -> list[str]:
        result = []

        # State: how many of each we have used, plus the prefix we are building.
        def backtrack(openP: int, closedP: int, path: list[str]) -> None:
            # A state only reaches this point by legal moves, so a full
            # state is a valid answer. No filtering needed.
            if openP == closedP == n:
                result.append("".join(path))
                return

            # Choice 1: add "(" while we still have some of the n allowance.
            if openP < n:
                path.append("(")
                backtrack(openP + 1, closedP, path)
                path.pop()          # undo before trying the other choice

            # Choice 2: add ")" only if something is open to close.
            # A separate `if`, not `elif`: both choices can be legal here.
            if closedP < openP:
                path.append(")")
                backtrack(openP, closedP + 1, path)
                path.pop()

        backtrack(0, 0, [])
        return result
```

`n` is read from the enclosing scope, so it is not a parameter. `openP` and `closedP` are plain ints, so passing `openP + 1` needs no undo — the caller's value is untouched. `path` is the only shared mutable object, which is why it is the only thing that needs the `pop()`.

The base case equality `openP == closedP == n` is a chained comparison: `openP == closedP and closedP == n`.

## The two conditions must stay separate

From `"(("` — `(openP=2, closedP=0), n=3` — both choices are legal:

```text
openP < n        →  2 < 3   true
closedP < openP  →  0 < 2   true
```

So this node has two children, `"((("` and `"(()"`. Writing the second branch as `elif` silently drops the `"(()"` subtree:

```python
if openP < n: ...
elif closedP < openP: ...        # wrong
```

For `n = 3` that returns exactly one answer, `["((()))"]`, instead of five. The `elif` assumption — "if I didn't open, I must close" — does not match the problem; the choices are independent.

## Why `path.pop()` is not optional

`path` is mutated in place and shared by every frame. The pattern is:

```text
append  →  recurse (the child sees the new prefix)  →  pop (restore)
```

Without the `pop`, each result inherits every character ever appended anywhere in the tree. For `n = 3` you get:

```text
["((()))", "((())))())", "((())))()))()", "((())))()))())(())", ...]
```

The first entry looks right, which is exactly why this bug survives a casual test. The recursion *returns* to the parent, but the list does not — `pop` is what makes the return meaningful.

## Why a list instead of a string

Building `path` as a string would copy it on every append:

```python
backtrack(openP + 1, closedP, path + "(")   # copies O(len) each level
```

Across one root-to-leaf path that is `O(n²)` copying, and there are `C_n` leaves. The list version does `O(1)` appends and pops during the search, then one `O(n)` join per finished answer.

| Operation | String | List |
| --- | --- | --- |
| extend the prefix | copy the whole string | `append`, amortised O(1) |
| undo | nothing to undo (immutable) | `pop`, O(1) |
| produce the answer | already a string | `"".join`, O(n) once |

The list version is the one to internalise; the string version is fine for small `n` and simpler if you dislike the undo step.

## How many calls is it, really

The *depth* of the recursion is `2n` — one level per character. The *number of calls* is the number of nodes in the tree, which is larger:

| n | calls | results |
| --- | --- | --- |
| 1 | 3 | 1 |
| 2 | 8 | 2 |
| 3 | 22 | 5 |
| 4 | 64 | 14 |
| 8 | 6917 | 1430 |

So "the search makes `2n` calls" describes a single path, not the tree. A finished answer costs `2n` appends and one join; the search as a whole visits every prefix in the table.

## Counting the answers: Catalan numbers

The number of well-formed strings with `n` pairs is the `n`-th Catalan number:

```text
C_n = (1 / (n + 1)) · C(2n, n)

n:      0   1   2   3    4    5     6      7      8
C_n:    1   1   2   5   14   42   132    429   1430
```

Why: take any arrangement of `n` opens and `n` closes (`C(2n, n)` of them) and exactly `1/(n+1)` of them never go negative. That factor is the Catalan correction.

- **Time:** `O(n · C_n)` — `C_n` answers, each costing `O(n)` to join and copy.
- **Space:** `O(n)` auxiliary for the recursion and `path`, plus the output itself.

For comparison, generate-all-and-filter walks `2^(2n)` strings: for `n = 8` that is 65,536 strings (12,870 if you only generate balanced counts) filtered down to 1,430. The pruned search visits 6,917 nodes and returns exactly the 1,430 that survive.

## Mistakes

### 1. `-> void` on the inner function

```python
def backtrack(openP, closedP, path) -> void:   # NameError on LeetCode
```

`void` is not a Python type. On Python 3.13 and earlier, annotations are evaluated when the `def` runs, so submitting this raises `NameError: name 'void' is not defined`.

It can pass locally on Python 3.14+, where annotations are deferred (PEP 649) and never evaluated unless something reads `__annotations__` — which is the worst kind of portability bug: works on your machine, fails on submit. Use `-> None`.

### 2. `elif` between the two choices

Covered above: from `"(("` both branches are legal, and `elif` returns 1 answer instead of 5 for `n = 3`.

### 3. Closing whenever there is allowance left

```python
if closedP < n:        # wrong: allows ")" before any "(" exists
```

This generates *all* arrangements of `n` opens and `n` closes. For `n = 3` that is the full 20 (`C(6,3)`), including:

```text
")((())", "())(()", "(()))(", ")))((("
```

The output is 20 strings where 5 were asked for, and nothing in the loop rejects them — the damage happened at generation time.

The correct test is `closedP < openP`: a closing bracket needs an **open** bracket, not merely budget.

### 4. Forgetting the `pop`

Covered above: the first result still looks correct, the rest accumulate junk. It is the classic shared-state bug in backtracking.

### 5. Trusting the base case to clean up

`return` after recording the answer is good style, but it is not what stops the recursion from overrunning: at `(n, n)` both `openP < n` and `closedP < openP` are false, so the function would fall through anyway. The base case is there to *record* and to skip the two checks. Nothing else is needed — which is also why an off-by-one in the constraints shows up as missing or extra answers, not as a crash.

### 6. Generating everything, then filtering

Correct, and the clearest way to state the problem:

```python
for bits in product("()", repeat=2 * n):
    if valid(bits):
        result.append("".join(bits))
```

But it checks validity at the leaf instead of enforcing it along the way. The backtracking version is the same idea moved earlier, where it costs nothing.

## Edge cases

| Case | Result |
| --- | --- |
| `n = 0` | `[""]` — one empty string (LeetCode's constraint is `n ≥ 1`) |
| `n = 1` | `["()"]` |
| `n = 2` | `["(())", "()()"]` |
| maximum `n = 8` | 1,430 strings, recursion depth 16 |
| duplicates? | none — each root-to-leaf path is a distinct string |
| order of results | `"("` is explored first, so `"((()))"` comes first; LeetCode accepts any order |

## What generalizes

This is the backtracking template in its smallest form:

```text
state          →  (openP, closedP, path)
choices        →  "(" and ")"
constraints    →  openP < n, closedP < openP
record         →  at the completed state only
undo           →  path.pop()
```

The transferable habit is deciding *where* validity is checked. If the problem's validity is prefix-closed — a bad prefix can never become good — check it before descending and never build the bad branch. If it is not prefix-closed (a partial answer can still be repaired), pruning needs a different argument, or none is available.

The same skeleton becomes subsets, permutations, and combination-sum: mutate a shared path, recurse, undo, and let problem-specific constraints cut the tree.

## Revision checklist

- [ ] State the invariant in one line: `closes ≤ opens` at every prefix, `opens ≤ n`.
- [ ] Explain why a negative balance can never be repaired.
- [ ] Say why `)` at the root is impossible without a special case.
- [ ] Say why the two branches are two `if`s, not `if/elif`.
- [ ] Explain what breaks without `path.pop()`.
- [ ] Give the Catalan count and the `O(n · C_n)` time.
- [ ] Contrast with generating `2^(2n)` strings and filtering.
- [ ] Recite the template: state, choices, constraints, record, undo.

## The short version

- A prefix is valid while `closes ≤ opens`; enforce that as you build, so invalid strings are never created.
- Add `(` if `open < n`; add `)` if `close < open`; record when both reach `n`.
- Two independent `if`s, a shared `path`, and a `pop` after each recursive call.
- Every leaf is a valid answer, the leaves number `C_n`, and the work is `O(n · C_n)`.
