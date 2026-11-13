# Evaluate RPN: The First Pop Is the Right Operand

*Postfix notation removes parentheses by fixing the order of operations. Evaluation is almost mechanical — push operands, and when an operator appears, combine the top two. The two details that break implementations are the order of the pops and the direction of integer division.*

Part of the [`leetcode/`](../) section. The division half is the concrete case behind
[`fundamentals/44-truncation-vs-floor`](../../fundamentals/44-truncation-vs-floor).

## The problem

Evaluate an expression written in **Reverse Polish Notation** (postfix). The input is an array of
tokens; operands are integers, and operators are `+`, `-`, `*`, `/`. Division truncates toward zero.
The expression is always valid and never divides by zero.

```text
["2", "1", "+", "3", "*"]   =  (2 + 1) * 3  =  9
["4", "13", "5", "/", "+"]  =  4 + (13 / 5) =  6
```

The infix versions on the right are only for reading. The algorithm never needs to find
parentheses or precedence — postfix already encodes both.

## Why a stack: the example that forces it

Start with the smallest interesting expression:

```text
2 3 +
```

A left-to-right scan handles it. Read `2`, read `3`, see `+`, compute `5`. It is tempting to conclude
that an accumulator — or a pair of variables for the last two values — is enough. For one operator,
it is.

Add one operand and one operator:

```text
2 3 4 + *
```

The `+` does not apply to the first two values. It applies to the **last two**:

```text
3 + 4 = 7
2 * 7 = 14
```

While `3` and `4` are being combined, `2` has to wait. It arrived first, but its operator (the `*`)
arrives last. That is the problem. A single accumulator has nowhere to keep `2` while it moves on to
`3` and `4`; by the time the `*` appears, the `2` is gone. Two variables (`left`, `right`) work for
one pending operator, but the expression can have arbitrarily many pending operands:

```text
1 2 3 4 + + +
```

So the number of values that must wait is not fixed at two. What you need is a place to park every
operand whose operator has not arrived yet, and to get them back in the reverse of the order they
were parked. That is a stack. The problem is not asking you to use one; it is leaving you no smaller
structure that works.

| Token | Action | Stack (bottom → top) |
| --- | --- | --- |
| `2` | push | `[2]` |
| `3` | push | `[2, 3]` |
| `4` | push | `[2, 3, 4]` |
| `+` | pop `4`, pop `3`, push `3 + 4` | `[2, 7]` |
| `*` | pop `7`, pop `2`, push `2 * 7` | `[14]` |

The stack is not a technique applied to postfix. It is the shape the data already has: operands
wait, and the most recent ones are resolved first.

Once that is clear, the algorithm is forced:

- An operand is a value whose operator has not arrived yet → push it.
- An operator applies to the most recent two waiting values → pop two, combine, push the result.
- A valid expression ends with one completed value → return the only element left.

The invariant:

> After processing a prefix of the expression, the stack holds the values of the completed
> subexpressions, in left-to-right order, with the most recent on top.

An operator pops the top two, combines them, and pushes the result. The result is now itself a
completed subexpression, waiting for the next operator. A valid expression ends with exactly one
value on the stack.

## Trap 1: the first pop is the right operand

This is the mistake that survives review because it works for `+` and `*`.

Trace `["5", "3", "-"]`:

```text
push 5        stack: [5]
push 3        stack: [5, 3]
"-"           pop -> 3     ← the RIGHT operand
              pop -> 5     ← the LEFT operand
              5 - 3 = 2
```

The **first** value popped is the **second** operand. The second value popped is the first operand.

Why: RPN lists operands in the order they would appear in infix. The left operand was pushed first,
so it sits deeper in the stack. The right operand was pushed last, so it is on top. Popping the stack
therefore gives you the operands in reverse order.

```python
right = stack.pop()
left = stack.pop()
```

Name the variables by **role**, not by pop order. `first_operand` sounds like the left side, but the
first value popped is the right side — and that naming is exactly how the bug gets in.

| Expression | Correct | If you swap the pops |
| --- | --- | --- |
| `5 3 -` | `5 - 3 = 2` | `3 - 5 = -2` |
| `7 2 /` | `7 / 2 = 3` | `2 / 7 = 0` |
| `5 3 +` | `5 + 3 = 8` | `3 + 5 = 8` (hides the bug) |
| `5 3 *` | `5 * 3 = 15` | `3 * 5 = 15` (hides the bug) |

Addition and multiplication are commutative, so the reversed order produces the same answer.
Subtraction and division are not. That is why a test suite of only `+` and `*` expressions can be
green while the evaluator is fundamentally wrong.

## Trap 2: division truncates toward zero

The problem says division truncates toward zero. Python's `/` returns a float, and `//` floors —
which is not the same thing for negative numbers.

```python
-7 / 2     # -3.5
-7 // 2    # -4    ← floor: toward negative infinity
int(-7 / 2)  # -3  ← truncation: toward zero
```

For `["-7", "2", "/"]`, the required answer is `-3`, not `-4`. `int()` on a float truncates toward
zero; `//` does not. This is the same distinction as
[`fundamentals/44-truncation-vs-floor`](../../fundamentals/44-truncation-vs-floor): floor moves
left on the number line, truncation moves toward zero.

`int()` is doing truncation here, not rounding. `round(-3.5)` is `-4`, `math.floor(-3.5)` is `-4`,
and `math.trunc(-3.5)` is `-3`. Only the last one is the required behavior.

```python
int(-7 / 2)      # -3
int(7 / -2)      # -3
int(-7 / -2)     # 3
```

### The float detour

`int(left / right)` goes through a float. That is safe for this problem's 32-bit values, but it is
not safe for arbitrary-precision integers: above `2**53`, the float can no longer represent every
integer, so the truncation can be off by one before `int()` even runs.

If the values can be large, use an exact truncating division:

```python
def trunc_div(a: int, b: int) -> int:
    q = a // b
    if a % b != 0 and (a < 0) != (b < 0):
        q += 1
    return q
```

```python
trunc_div(-7, 2)    # -3
trunc_div(7, -2)    # -3
trunc_div(-7, -2)   # 3
```

For LeetCode, `int(left / right)` is correct and simpler. The helper is what you reach for when the
inputs are not bounded.

## The implementation

```python
class Solution:
    def evalRPN(self, tokens: list[str]) -> int:
        stack = []

        operators = ["+", "-", "*", "/"]

        for token in tokens:
            if token in operators:
                second_operand = stack.pop()
                first_operand = stack.pop()

                if token == "+":
                    ans = first_operand + second_operand
                elif token == "-":
                    ans = first_operand - second_operand
                elif token == "*":
                    ans = first_operand * second_operand
                elif token == "/":
                    ans = int(first_operand / second_operand)

                stack.append(ans)
            else:
                stack.append(int(token))

        return stack[-1]
```

The important lines are the two pops. `second_operand` is popped first because it is the top of the
stack; `first_operand` is popped second because it was pushed first. The rest is arithmetic.

## A cleanup: one definition of "operator"

The implementation declares the operator set twice: once in `operators`, and again in the
`if/elif` chain. Those are two copies of the same fact, and they can drift — the same issue as
[`fundamentals/43-single-source-of-truth`](../../fundamentals/43-single-source-of-truth).

Add `"%"` to the list and forget a branch, and `ans` is unbound. Replace the final branch with
`else` and an unknown operator silently becomes division. Neither failure is caught by the
language, because the relationship between the set and the chain is implicit.

A lookup table makes the operator set the single source:

```python
class Solution:
    def evalRPN(self, tokens: list[str]) -> int:
        operations = {
            "+": lambda a, b: a + b,
            "-": lambda a, b: a - b,
            "*": lambda a, b: a * b,
            "/": lambda a, b: int(a / b),
        }

        stack: list[int] = []

        for token in tokens:
            if token not in operations:
                stack.append(int(token))
                continue

            right = stack.pop()
            left = stack.pop()
            stack.append(operations[token](left, right))

        return stack[-1]
```

One declaration now controls both membership and behavior. If exact division matters, swap the
lambda for `trunc_div` — the shape stays the same.

The `right`/`left` names are also doing documentation work: they make the pop order impossible to
misread. That is cheaper than a comment.

## Why it works

The invariant from earlier gives the proof:

- **Operand:** pushed. It is a completed subexpression waiting for an operator.
- **Operator:** the top two stack entries are the two most recent completed subexpressions, and in
  postfix they are exactly the operator's right and left operands. Popping right then left, applying
  the operator, and pushing the result produces a new completed subexpression.
- **End:** a valid expression has consumed every operator, so exactly one completed value remains.

The stack never needs to know about precedence or parentheses. Postfix has already resolved both
into the token order.

## Complexity

- **Time: O(n).** Each token is processed once. Each value is pushed and popped at most once.
- **Space: O(n).** The stack can hold every operand before the first operator that consumes them.

## Tests worth keeping

```python
assert Solution().evalRPN(["2", "1", "+", "3", "*"]) == 9
assert Solution().evalRPN(["4", "13", "5", "/", "+"]) == 6
assert Solution().evalRPN(
    ["10", "6", "9", "3", "+", "-11", "*", "/", "*", "17", "+", "5", "+"]
) == 22

# Operand order: non-commutative operators expose a swapped pop.
assert Solution().evalRPN(["5", "3", "-"]) == 2
assert Solution().evalRPN(["7", "2", "/"]) == 3

# Truncation toward zero, not floor.
assert Solution().evalRPN(["-7", "2", "/"]) == -3
assert Solution().evalRPN(["7", "-2", "/"]) == -3
assert Solution().evalRPN(["-7", "-2", "/"]) == 3

# A single operand is already a valid expression.
assert Solution().evalRPN(["3"]) == 3
```

The first three examples come from the problem, and between them they happen to catch both bugs. The
rest are focused regression cases: a subtraction and a division with unequal operands to isolate pop
order, and four sign combinations to isolate truncation.

A randomized check of the division step is also cheap:

```python
import random

for _ in range(100_000):
    a = random.randint(-10**6, 10**6)
    b = random.choice([i for i in range(-100, 101) if i])
    assert int(a / b) == trunc_div(a, b)
```

For the bounded inputs in this problem, `int(a / b)` and the exact helper agree. The test documents
*why* the shortcut is safe here, instead of leaving it as an assumption.

## What generalizes

- **Postfix evaluation is expression-tree evaluation.** The stack is doing a post-order traversal of
  the tree without building it. Compilers and calculators use the same shape.
- **Operand order is a recurring bug for non-commutative operations.** Matrix multiplication,
  function composition, string concatenation, and subtraction all care which side is which. Naming
  values by role — `left`/`right`, `dividend`/`divisor` — prevents the class of mistake.
- **Division is language-specific.** Python floors with `//`, JavaScript's `BigInt` truncates, and
  floats have their own rules. The operation you write is not necessarily the operation you mean.
- **This is the third stack pattern in this section.** Min Stack used a stack as **history**,
  Valid Parentheses as **unmet obligations**, and RPN as **deferred evaluation**. Same container,
  three different jobs. The common question is always: what is the most recent thing that still
  needs to be resolved?

## The takeaway

Two independent traps sit in this problem, and both are hidden by friendly test data:

1. **Order:** the first pop is the right operand, because the right operand was pushed last.
2. **Rounding:** division must truncate toward zero, not toward negative infinity.

Commutative operators hide the first. Positive operands hide the second. Write tests with
subtraction, division, and negative numbers, and name the pops by their role.

The stack is easy. The semantics are the problem.
