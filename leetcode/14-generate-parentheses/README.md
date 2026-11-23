# Generate Parentheses

*Take one output string and read it character by character. Every position was a choice between `(` and `)`. That makes each answer a path through a decision tree — so the problem becomes deciding which paths are worth walking, and when to walk back out of one.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻↻ Six thoughts carry the whole solution. If you can recall them in order, you can rebuild the code.

---

## The reasoning in six lines

1. Each character of an answer is a two-way choice → the search space is a binary tree.
2. The tree contains invalid strings → some branches must not be walked.
3. A `)` must close a `(` that already exists → `close < open`.
4. You own exactly `n` of each → `open < n`.
5. Refusing to descend changes the shape of the walk → that is backtracking.
6. Build the string once, at the leaf → keep a list, join at the end.

Everything below is those six lines with the details that make them work.

## 1. Each output is a path

Take `(()())` for `n = 3` and look at each position:

```text
position:   1  2  3  4  5  6
character:  (  (  )  (  )  )

choice:     (        )        every position had two candidates
```

Six positions, two candidates each: a binary tree with `2^6 = 64` leaves. The five valid ones are the answer.

```text
((()))   (()())   (())()   ()(())   ()()()
```

So a node in the tree is a **prefix**, an edge is **one character**, and an answer is a **root-to-leaf path**.

> The tree is the search space. An answer is one path through it.

## 2. The tree does not know what is valid

`)))(((` is also a path — always pick `)` first. `(()))(` is another. The tree explores *potential* answers, not *valid* ones:

> The decision tree lets us explore the answer space, not necessarily the valid answers.

That is the point where validity has to enter. Two ways:

- **Check at the end.** Build all 64 strings, filter to 5. Correct, and it wastes 59 strings after finishing them.
- **Check on the way down.** If a prefix can never become valid, do not extend it. This is backtracking, and it requires a test that works on a *partial* string.

Everything interesting in this problem is finding that test.

## 3. Rule one: a closing bracket needs an opening one

Brackets pair left to right. A `)` at some position needs an unmatched `(` **before it**. It cannot borrow from a `(` that appears later.

So, with `open` and `close` counting what has been written:

> Take `)` only when `close < open`.

Think of it as pairing, not counting. With three pairs, the third `)` needs the third `(` to exist first. A fourth `)` would mean four closes against at most three opens — one of them has no partner, and no later character can give it one.

The same rule in balance form: `balance = open - close`, and writing `)` is legal only while `balance > 0`.

The first character shows the rule working without a special case:

```text
state (0, 0):   close < open  →  0 < 0  →  false
```

The branch that starts with `)` is not created and then rejected. It is never created.

## 4. Rule two: you only own `n` of each, and that is why the opening rule is different

Write `(` only while `open < n`. That one is obvious. The subtle part is *why* it cannot instead be a comparison between the two counters:

> At the beginning, `open` and `close` are both zero. So the condition for adding `(` cannot be a comparison between them — that comparison is false. The only reason opening is legal is that we are below the `n` threshold.

That is what fixes the two conditions:

| Choice | Question it really asks | Rule |
| --- | --- | --- |
| `(` | Do I still have an opening bracket to spend? | `open < n` |
| `)` | Is there an opening bracket waiting to be closed? | `close < open` |

Mnemonics: **opening spends budget, closing spends balance.**

Also note what kind of thing these rules are. The tree is generic — any problem with two choices at each step has the same shape. The rules are specific to parentheses:

> The conditions are specific to the question we are solving, not universal.

Change the problem and the tree stays; the pruning rules are what change.

## 5. Walking a path, then walking back out

Descend along the leftmost path, checking the two rules at every state:

| Step | Prefix | `(open, close)` | open legal? | close legal? | What happens |
| --- | --- | --- | --- | --- | --- |
| 1 | `""` | `(0, 0)` | `0 < 3` ✓ | `0 < 0` ✗ | only `(` |
| 2 | `"("` | `(1, 0)` | ✓ | `0 < 1` ✓ | both; try `(` first |
| 3 | `"(("` | `(2, 0)` | ✓ | ✓ | both; try `(` first |
| 4 | `"((("` | `(3, 0)` | `3 < 3` ✗ | ✓ | forced to close |
| 5 | `"((()"` | `(3, 1)` | ✗ | ✓ | forced to close |
| 6 | `"((())"` | `(3, 2)` | ✗ | ✓ | forced to close |
| 7 | `"((()))"` | `(3, 3)` | ✗ | `3 < 3` ✗ | record the answer, return |

Now watch the return trip, because this is the part that is easy to hand-wave:

1. At step 7 the answer is recorded and the frame returns.
2. The three `)` pop as their frames unwind: the path goes from `"((()))"` back to `"((("`.
3. The frame at `(2, 0)` then pops **its own** `(`, leaving `"(("`.
4. That frame's opening branch is finished, so its second `if` now runs — with the path restored to exactly the state the frame started with. It writes `)` and starts the `"(()"` subtree.

That is backtracking: not a special algorithm, just *returning with the state restored, then trying the other choice*. The `pop` is what makes the return meaningful.

The rest of the tree, with the blocked choice named at every node:

```text
""  (0,0)
└─ "("  (1,0)
   ├─ "(("  (2,0)
   │  ├─ "((("  (3,0)              open blocked: 3 == n
   │  │  └─ "((()"  (3,1)
   │  │     └─ "((())"  (3,2)
   │  │        └─ "((()))"  (3,3)  ✓
   │  └─ "(()"  (2,1)              ← step 4 above, after coming back
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

Twenty-two nodes instead of sixty-four. The pruning is doing real work, and every leaf is a valid answer — there is nothing left to filter at the end.

## 6. Collect at the leaf, not on the way down

You need a string for each answer. The tempting way is to carry a string and extend it:

```python
backtrack(open + 1, close, path + "(")     # works, but copies
```

Python strings are immutable, so every extension allocates a new string. Along one path the sizes go `1, 2, 3, …, 2n`, and each step copies the whole thing — the cost is quadratic in the depth, repeated for every answer.

Instead, keep **one list** for the current path:

- `path.append(...)` and `path.pop()` are O(1).
- `"".join(path)` runs **once**, when a complete answer is recorded.

For `n = 3`: 22 recursive calls, 5 joins of length 6. For `n = 8`: 6,917 calls, 1,430 joins of length 16. The list is not a micro-optimisation; it is what keeps the per-answer cost at O(n) instead of O(n²).

The string version is still correct — it just needs no `pop`, because it never mutates anything. The list version is the one to default to.

## 7. The code, assembled in the order the pieces were figured out

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

Details that matter:

- **`n` is not a parameter.** It never changes, so the inner function reads it from the enclosing scope. Only the state that changes is passed down.
- **`openP` and `closedP` need no undo.** Integers are immutable: `openP + 1` creates a new value for the child, and the parent's `openP` is untouched when the child returns. `path` is the only shared mutable object, which is exactly why it is the only thing that needs `pop`.
- **`openP == closedP == n` is a chained comparison**, i.e. `openP == closedP and closedP == n`. The first part is guaranteed by the rules at this point; it is there to say "both spent" in one line.
- **The counters and the path stay in sync.** Every recursive call adds exactly one character, so `len(path) == openP + closedP` at every frame. That invariant is what lets the base case be about the counters rather than the length.

## 8. The `pop` is the backtrack

The list is shared by every frame, and the frames run one at a time. The contract is:

```text
append  →  recurse (the child sees the new character)  →  pop (restore)
```

Without the `pop`, the sibling branch inherits the character that belonged to the branch just explored, and so does every later branch. For `n = 3` the output becomes:

```text
["((()))", "((())))())", "((())))()))()", "((())))()))())(())", ...]
```

The first answer is correct, which is why this bug survives a quick test: the first path never needs to undo anything. The recursion *returns*, but the list does not — the `pop` is what makes the return meaningful.

## 9. Two `if`s, not `elif`

At `"(("` — state `(2, 0)` — both choices are legal:

```text
openP < n        →  2 < 3  true
closedP < openP  →  0 < 2  true
```

So that node has two children, `"((("` and `"(()"`. Writing the second branch as `elif` encodes "if I did not open, I must close", which is false here: both can be done, and the tree needs both subtrees.

For `n = 3` an `elif` returns one answer:

```text
["((()))"]
```

The order of the two `if` blocks does not affect correctness — only the order of the results.

## 10. How much work it is

The number of valid strings is the `n`-th Catalan number:

```text
C_n = (1 / (n + 1)) · C(2n, n)
```

| `n` | recursive calls | answers (`C_n`) | all balanced-count arrangements `C(2n, n)` | all binary strings `4^n` |
| --- | --- | --- | --- | --- |
| 1 | 3 | 1 | 2 | 4 |
| 2 | 8 | 2 | 6 | 16 |
| 3 | 22 | 5 | 20 | 64 |
| 4 | 64 | 14 | 70 | 256 |
| 8 | 6,917 | 1,430 | 12,870 | 65,536 |

- **Time:** `O(n · C_n)` — `C_n` answers, each joined once in `O(n)`.
- **Space:** `O(n)` for the recursion and `path`, plus the output itself.

On the call count: a single root-to-leaf path makes `2n` choices, which is `2n + 1` calls including the terminal one — that is the depth. The *whole tree* calls the function 22 times for `n = 3`, because every prefix gets its own call. Both numbers are true; they count different things.

For comparison, generate-and-filter walks all `4^n` strings. At `n = 8` that is 65,536 strings built to keep 1,430, versus 6,917 nodes explored. And if you instead generate only arrangements with `n` opens and `n` closes, that is 12,870 — still nine times the tree.

## 11. Mistakes

### `-> void` on the inner function

```python
def backtrack(openP, closedP, path) -> void:   # NameError on LeetCode
```

`void` is not a Python type. Up to Python 3.13, annotations are evaluated when `def` runs, so this raises `NameError: name 'void' is not defined`. It can pass locally on Python 3.14+, where annotations are deferred (PEP 649) — local green, submit red. Use `-> None`.

### `elif` between the two choices

Returns only `["((()))"]` for `n = 3`, as shown above. Both conditions are independent, not alternatives.

### Closing whenever budget remains

```python
if closedP < n:        # wrong
```

This generates every arrangement of `n` opens and `n` closes — all 20 for `n = 3` — including strings like `")))((("` and `"(()))("`. The counts are right; the pairing is not. Closing needs an **open**, not an allowance.

### Forgetting the `pop`

The first answer looks right and the rest accumulate characters from earlier branches:

```text
["((()))", "((())))())", "((())))()))()", ...]
```

### Relying on the base case to stop the recursion

The `return` after recording is good style, but it is not what prevents overrunning: at `(n, n)` both `if`s are false anyway. The base case is there to record the answer and skip two comparisons. That also means an off-by-one in the rules shows up as missing or extra answers, not as a crash.

### Generating everything and filtering

The honest baseline, and worth writing once to see the difference:

```python
for bits in product("()", repeat=2 * n):
    if is_balanced(bits):
        result.append("".join(bits))
```

It checks validity at the leaf, after paying for the string. The backtracking version moves the same check to the edge, before the cost is paid.

## 12. Edge cases

| Case | What happens |
| --- | --- |
| `n = 0` | `[""]` — one empty string (LeetCode's constraint is `n ≥ 1`) |
| `n = 1` | `["()"]` |
| `n = 2` | `["(())", "()()"]` |
| maximum `n = 8` | 1,430 answers, recursion depth 16 |
| duplicates | none — each root-to-leaf path is a distinct string |
| result order | `(` is tried first, so `((()))` comes first; any order is accepted |
| a state with both choices blocked | only at `(n, n)`, which is the recorded leaf |

## 13. The version to remember

- An answer is a **path** of `2n` binary choices; the tree is the search space, not the answer set.
- A `)` needs an `(` already written → `close < open`; the root `(0, 0)` makes `)` impossible without a special case.
- You own `n` opens → `open < n`; this is why the opening rule is a budget check instead of a counter comparison.
- Both rules can be true at the same node → two `if`s, never `elif`.
- Record at `(n, n)` with `"".join(path)`; keep `path` a list so the walk is O(1) per step.
- `append → recurse → pop`; the `pop` is the backtrack.
- The rules are problem-specific; the tree/backtracking skeleton is not.
