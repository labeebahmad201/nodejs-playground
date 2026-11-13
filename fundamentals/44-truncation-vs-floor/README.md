# Truncation Is Not Floor

*Rounding toward zero and rounding toward negative infinity agree on every positive number and disagree on every negative one. `floor(-3.5)` is `-4`; truncating `-3.5` is `-3`. The gap is one unit — enough to shift a time bucket, a grid cell, a page index, or a balance into the wrong slot.*

Part of the language-agnostic [`fundamentals/`](../) track. Examples in Python and JavaScript.

## The two directions

- **Floor** — the greatest integer less than or equal to `x`. It moves toward negative infinity.
- **Ceiling** — the least integer greater than or equal to `x`. It moves toward positive infinity.
- **Truncation** — discard the fractional part. It moves toward zero.

```text
                 -4        -3        -2
floor(-3.5) ──────●
trunc(-3.5) ────────────────●
                  ← floor    trunc →
```

| `x` | `floor(x)` | `ceil(x)` | `trunc(x)` |
| --- | --- | --- | --- |
| `3.7` | `3` | `4` | `3` |
| `3.5` | `3` | `4` | `3` |
| `-3.1` | `-4` | `-3` | `-3` |
| `-3.5` | `-4` | `-3` | `-3` |
| `-3.9` | `-4` | `-3` | `-3` |

The relationships are worth memorizing:

- For `x >= 0`: `trunc(x) == floor(x)`.
- For `x < 0`: `trunc(x) == ceil(x)`.
- `trunc(x)` never moves away from zero: `abs(trunc(x)) <= abs(x)`.
- Floor and truncation differ **only** for negative non-integers. That is exactly why positive-only tests never catch the bug.

## Why the confusion is built in

"Floor" sounds like "strip the decimal part." It doesn't. It means "go down to the integer below," and for `-3.5` the integer below is `-4`. Truncation is what "strip the decimal part" actually describes.

"Round down" is worse, because "down" is ambiguous: down toward zero, or down toward negative infinity? Avoid the phrase. Say **floor** or **truncate**.

The operator names hide the same decision:

- Python's `//` is **floor division**, not truncating division.
- Python's `%` follows the divisor, because it is paired with floor division.
- JavaScript has no integer division operator for `Number`; `Math.trunc` is a function call, not an operator.
- JavaScript's `BigInt` division **truncates**, even though Python's `//` floors.

So "integer division" is not one behavior. The language and the type decide.

## Python

```python
import math

math.floor(3.7)    # 3
math.floor(-3.7)   # -4

math.ceil(3.7)     # 4
math.ceil(-3.7)    # -3

math.trunc(3.7)    # 3
math.trunc(-3.7)   # -3

int(3.7)           # 3
int(-3.7)          # -3
```

`int()` and `math.trunc()` both truncate toward zero for floats. Prefer `math.trunc` when truncation is the intent: `int` is a type conversion that also parses strings, while `math.trunc` says exactly what it does. Both raise `ValueError` for `NaN` and `OverflowError` for infinity.

### Integer division

```python
7 // 2     # 3
-7 // 2    # -4   ← floor, not truncation
7 // -2    # -4
-7 // -2   # 3
```

The result always moves left on the number line. For floats, the result stays a float: `-7.0 // 2.0` is `-4.0`.

You can truncate through a float, but don't:

```python
n = 2**53 + 1

n / 1          # 9007199254740992.0 — the float already lost the +1
int(n / 1)     # 9007199254740992   — off by one
```

`/` produces a float, and floats cannot represent every integer above `2**53`. For exact integer truncation, adjust the floor result:

```python
def trunc_div(a: int, b: int) -> int:
    q = a // b
    if a % b != 0 and (a < 0) != (b < 0):
        q += 1
    return q
```

```python
trunc_div(-7, 2)   # -3
trunc_div(7, -2)   # -3
trunc_div(-7, -2)  # 3
```

### Remainders follow the division

```python
-7 % 2              # 1     sign follows the divisor
math.fmod(-7, 2)    # -1.0  sign follows the dividend
divmod(-7, 2)       # (-4, 1)
```

Python's `%` is the remainder that belongs to floor division. `math.fmod` is the remainder that belongs to truncating division. They are not interchangeable for negative operands.

For exact decimal work, the rounding mode is explicit:

```python
from decimal import Decimal, ROUND_DOWN, ROUND_FLOOR

Decimal("-3.7").to_integral_value(rounding=ROUND_DOWN)   # -3  (toward zero)
Decimal("-3.7").to_integral_value(rounding=ROUND_FLOOR)  # -4  (toward -infinity)
```

`ROUND_DOWN` is truncation. `ROUND_FLOOR` is floor. The names are unambiguous, which is the point.

## JavaScript

```js
Math.floor(3.7);    // 3
Math.floor(-3.7);   // -4

Math.ceil(3.7);     // 4
Math.ceil(-3.7);    // -3

Math.trunc(3.7);    // 3
Math.trunc(-3.7);   // -3
```

`Math.trunc` is ES2015. For older runtimes, the equivalent is `x < 0 ? Math.ceil(x) : Math.floor(x)`.

One edge case: `Math.trunc(-0.5)` returns `-0`. It compares equal to `0` with `===`, but `Object.is(Math.trunc(-0.5), 0)` is `false` — and `1 / -0` is `-Infinity`. Python's `math.trunc(-0.5)` returns the integer `0`, with no negative zero.

### Division

```js
-7 / 2;               // -3.5
Math.trunc(-7 / 2);   // -3
Math.floor(-7 / 2);   // -4
```

There is no integer division operator for `Number`. For `BigInt`, division truncates toward zero:

```js
-7n / 2n;    // -3n
7n / -2n;    // -3n
-7n / -2n;   // 3n
```

The remainder is paired with that choice — JavaScript's `%` takes the sign of the dividend:

```js
-7 % 2;    // -1
7 % -2;    // 1
```

### The bitwise shortcut is a trap

```js
~~-3.7;          // -3
-3.7 | 0;        // -3
```

Both truncate toward zero, so they look like a compact `Math.trunc`. But they first coerce the value to a **32-bit signed integer**:

```js
~~2147483648;    // -2147483648  (wraps)
~~NaN;           // 0
~~Infinity;      // 0
```

Use `Math.trunc` unless you specifically want 32-bit integer semantics (bit flags, hashing, old-school performance tricks).

### Infinity and NaN pass through

```js
Math.trunc(NaN);       // NaN
Math.trunc(Infinity);  // Infinity
```

Python raises instead. If a value can be non-finite, validate it rather than assuming the truncation function will catch it.

### Rounding is a third behavior

Do not use `Math.round` as a synonym for either floor or truncation. Its tie-breaking is its own rule:

```js
Math.round(-3.5);   // -3   ties toward +infinity
Math.round(-3.6);   // -4
Math.round(2.5);    // 3
```

Python rounds ties to even:

```python
round(-3.5)   # -4
round(2.5)    # 2
round(3.5)    # 4
```

Three functions, three behaviors: floor, truncate, and round. Pick the one you mean.

## The remainder travels with the division

This is the part that makes the distinction more than trivia. A quotient and a remainder are a matched pair, and the identity must hold:

```text
a == q * b + r
```

| Convention | Quotient | Remainder | Identity |
| --- | --- | --- | --- |
| Floor (Python `//`, `%`) | toward `-∞` | sign of divisor | `a == (a // b) * b + (a % b)` |
| Truncate (JS `%`, `fmod`) | toward `0` | sign of dividend | `a == trunc(a / b) * b + fmod(a, b)` |

If you switch the division direction but keep the remainder function, the identity breaks on negative operands. The two decisions have to be made together.

## Where the difference bites

**Time buckets around an epoch.** A bucket index computed with floor keeps the two sides of zero separate:

```python
math.floor(-0.9)   # -1
math.floor(0.9)    # 0

math.trunc(-0.9)   # 0
math.trunc(0.9)    # 0   ← the last partial second before the epoch
                       #   is merged with the first one after it
```

**Grid cells and coordinates.** `floor(x / cell)` assigns `-0.5` to cell `-1`; `trunc(x / cell)` assigns it to cell `0`, merging the cell just left of the origin with the one just right of it.

**Negative balances and "full units."** If a balance is `-3.5` days, truncation gives `-3` ("three full days owed") and floor gives `-4`. Which one is correct is a business decision, not a language one. The bug is choosing by accident.

**Any positive-only test suite.** `trunc` and `floor` are identical for non-negative values. A test that only uses positive numbers certifies an implementation that is wrong for half the domain.

## How to keep it straight

- **Name the direction at the call site.** `floor_div`, `trunc_div`, `bucket_floor`, `truncate_toward_zero` — the name should make the negative case obvious.
- **Test negatives explicitly.** Add at least `-0.5`, `-3.5`, and a negative exact integer to the cases.
- **Assert the identity.** For any quotient/remainder pair, check `a == q * b + r`.
- **Avoid float detours for integer division.** `int(a / b)` loses precision above `2**53`.
- **Avoid `~~` and `| 0` for general math.** They truncate to 32 bits, not to an integer.
- **Use explicit rounding modes for money.** Integer minor units or `Decimal` with `ROUND_DOWN`/`ROUND_FLOOR`.
- **Property-test the definition.** For all `x`: `trunc(x) == floor(x)` when `x >= 0`, `trunc(x) == ceil(x)` when `x < 0`, and `abs(trunc(x)) <= abs(x)`.

## Cheat sheet

| Operation | Python | JavaScript |
| --- | --- | --- |
| Floor | `math.floor(x)` | `Math.floor(x)` |
| Ceiling | `math.ceil(x)` | `Math.ceil(x)` |
| Truncate toward zero | `math.trunc(x)` or `int(x)` | `Math.trunc(x)` |
| Integer division | `a // b` (floors) | no `Number` operator; `Math.trunc(a / b)` |
| BigInt division | — | `a / b` (truncates) |
| Remainder | `a % b` (sign of divisor) | `a % b` (sign of dividend) |
| Remainder matching truncation | `math.fmod(a, b)` | `a % b` |
| Exact decimal rounding | `Decimal(...).to_integral_value(rounding=...)` | use a decimal library |
| Non-finite input | raises | propagates `NaN` / `Infinity` |

## One-line summary

**Floor moves toward negative infinity; truncation moves toward zero. They agree on positives and disagree on negatives, and that disagreement propagates into division, remainders, buckets, and indices — so choose the direction explicitly, pair it with the matching remainder, and test with negative inputs.**

## References

- Python documentation — [`math.floor`](https://docs.python.org/3/library/math.html#math.floor),
  [`math.trunc`](https://docs.python.org/3/library/math.html#math.trunc),
  [`math.fmod`](https://docs.python.org/3/library/math.html#math.fmod),
  [floor division](https://docs.python.org/3/reference/expressions.html#binary-arithmetic-operations).
- Python documentation — [`decimal` rounding modes](https://docs.python.org/3/library/decimal.html#rounding-modes).
- MDN — [`Math.floor`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/floor),
  [`Math.trunc`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc),
  [`Math.round`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round),
  [BigInt division](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Division).
- IEEE 754 — the floating-point standard behind `Number` and Python `float`.
- Related: [`14-state`](../14-state) for the difference between a value and its derived representation.
