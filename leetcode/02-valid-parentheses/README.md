# Valid Parentheses: A Map Knows the Pair, a Stack Knows the Order

*Counting brackets tells you how many, not whether they nest. A hash map tells you which opening bracket matches a closing one, but not which occurrence is currently owed. Validity is a property of order — and order is what a stack preserves.*

---

## The problem

Given a string containing only the characters `(`, `)`, `{`, `}`, `[`, `]`, decide whether it is valid.

A string is valid when:

1. Every closing bracket has a matching opening bracket of the same type.
2. Brackets close in the correct order.
3. Every opening bracket is eventually closed.

```text
"()[]{}"   → true
"([{}])"   → true
"(]"       → false
"([)]"     → false
"(()"      → false
```

The first two rules sound like they might be the same rule. They aren't, and the gap between them is the whole problem.

## Counting is necessary, not sufficient

The first instinct is to count. If the number of opening brackets equals the number of closing brackets, the string is balanced — right?

That checks a **global** property. Validity is a **local, ordered** property: it depends on what is open at the exact moment each closing bracket arrives.

| `s` | opens | closes | equal? | valid? | why |
| --- | --- | --- | --- | --- | --- |
| `()[]{}` | 3 | 3 | yes | yes | properly nested |
| `")("` | 1 | 1 | yes | no | a close arrives before its open |
| `"([)]"` | 2 | 2 | yes | no | the pairs cross |
| `"(]"` | 1 | 1 | yes | no | right count, wrong type |
| `"(()"` | 2 | 1 | no | no | an open is never closed |
| `"())"` | 1 | 2 | no | no | a close has nothing to close |

The interesting failures are the first three. `")("` and `"([)]"` have exactly the right number of brackets and still fail.

Counting per type doesn't rescue it either. `"([)]"` has one `(`, one `[`, one `)`, and one `]` — each type appears exactly as often in opening form as in closing form. The problem is not how many of each type exist. It's **where they are**.

A count is a statistic over the whole string. It throws away position, and position is the entire question.

## A hash map knows the pair, not the position

The natural next tool is a lookup table:

```python
close_to_open = {
    ")": "(",
    "}": "{",
    "]": "[",
}
```

This is necessary. It answers: **"What type of opening bracket does this closing bracket require?"**

But it cannot answer: **"Is that type the one currently available?"**

On `"([)]"`, when the `)` arrives:

- the map says `)` requires `(`;
- there is a `(` in the string, so a membership check passes;
- but that `(` is underneath a `[`. The `[` was opened more recently and must close first.

```text
(   [   )   ]
        ↑
        ) requires ( — but the most recent open is [
        reaching the older ( would mean crossing [
```

That is the distinction that matters: the map resolves **type**, but the string's validity depends on **occurrence**. There may be many `(` characters in the string; the `)` is only allowed to close one of them, and specifically the most recent one that is still open.

A dictionary is keyed by symbol. It has no memory of which symbols appeared, in what order, or which of them are still unresolved. Python's `dict` does preserve insertion order — but that is the insertion order of the **keys** (`)`, `}`, `]`), not the order of brackets in the input. It tells you nothing about the string.

## What a closing bracket is really asking

When you scan left to right, the most recent unmatched opening bracket is the only one a closing bracket can legally match. That is the LIFO rule, and it is forced by the geometry of nesting.

Brackets cannot cross. If `a` opens before `b`, then `b` must close before `a`. The alternative would look like:

```text
a  b  close(a)  close(b)
```

which is exactly `"([)]"`. The only non-crossing arrangement is:

```text
a  b  close(b)  close(a)
```

So when a closing bracket appears, it must close the **innermost** opening bracket that is still open. If that bracket is the wrong type, the string is already invalid — no future character can repair a crossing.

This is the same discipline as a call stack. The most recent function call returns before its caller. The most recent `{` closes before the `{` around it.

## The stack is the list of unmet obligations

Scan the string and keep the unmatched opening brackets in a stack:

- **Open bracket** → push it. It is a new obligation, and the newest one.
- **Close bracket** → it must match the top. If it does, pop; the obligation is met. If it doesn't, return `False`.
- **End of string** → valid only if the stack is empty. Any leftover opening bracket was never closed.

The stack's top is always the most recent unresolved opening bracket, which is exactly the one the next close must satisfy. That is the justification for the data structure — not "parentheses problems use stacks," but "the rule is most-recent-first, so the structure must be most-recent-first."

### The implementation

```python
class Solution:
    def isValid(self, s: str) -> bool:
        stack = []

        closeToOpen = {
            ")": "(",
            "}": "{",
            "]": "[",
        }

        for c in s:
            if c == '(' or c == '{' or c == '[':
                stack.append(c)
            else:
                if stack and stack[-1] == closeToOpen[c]:
                    stack.pop()
                else:
                    return False

        return len(stack) == 0
```

The `stack and ...` guard is doing real work. If the stack is empty and a closing bracket arrives, there is no obligation to satisfy, so `")"` and `"()}"` return `False` immediately instead of raising `IndexError`.

## Why it works

The invariant is:

> After processing the prefix `s[:i]`, the stack contains exactly the opening brackets in that prefix that have not yet been matched, in the order they appeared, with the most recent on top.

It holds inductively:

- **Open bracket:** it has not been matched, and it is newer than everything on the stack, so pushing it preserves the invariant.
- **Close bracket:** by the non-crossing rule, it may only match the most recent unmatched open — the top. If the top matches, both are now matched, so popping preserves the invariant. If it doesn't, no valid matching exists, and returning `False` is correct.
- **End:** the stack is empty exactly when every opening bracket found a closing bracket.

Notice that the `False` return on a mismatch is not a heuristic. It is final. The offending close has already crossed an opening bracket that should have closed first. Future characters only add more obligations; they cannot uncross the ones already in the stack.

## Complexity

- **Time: O(n).** Each character is pushed at most once and popped at most once. The total work is linear even though the stack can grow and shrink.
- **Space: O(n).** In the worst case the string is all opening brackets, so the stack holds all `n` of them.

A valid string must have even length, so `if len(s) % 2: return False` is a free O(1) rejection. It is optional, but it makes the common odd-length case cheap.

One practical advantage of the explicit stack over a recursive parser: the depth is stored on the heap, not on the call stack. A string of 100,000 nested brackets is fine here; the recursive equivalent may overflow.

## Edge cases worth pinning down

```python
assert Solution().isValid("") is True          # vacuously valid
assert Solution().isValid("(") is False
assert Solution().isValid(")") is False
assert Solution().isValid("([{}])") is True
assert Solution().isValid("([)]") is False
assert Solution().isValid("(){}}{") is False
assert Solution().isValid("((((((()))))))") is True
```

`"(){}}{"` is a good one to trace by hand:

```text
(   push (
)   top is ( → pop
{   push {
}   top is { → pop
}   stack is empty → False
```

The count of opens and closes is not even equal in that string, but the failure happens before the end, at the third closing bracket. That is the point of scanning left to right instead of looking at the whole string at once.

The example tests are still weak, because they only cover cases you thought of. A randomized comparison against a deliberately slow reference implementation is stronger:

```python
def reference(s: str) -> bool:
    pairs = ("()", "[]", "{}")
    while True:
        for pair in pairs:
            if pair in s:
                s = s.replace(pair, "", 1)
                break
        else:
            return s == ""

import random

for _ in range(20_000):
    n = random.randint(0, 10)
    s = "".join(random.choice("()[]{}") for _ in range(n))
    assert Solution().isValid(s) == reference(s), s
```

The reference repeatedly deletes an adjacent matched pair. If the string reduces to nothing, it was valid. It is obviously correct and obviously O(n²). The stack is the linear-time version of the same reduction. Running both over random strings is what turns "the invariant seems right" into "the invariant held."

## One change I'd make: one source of truth for the alphabet

The implementation declares the bracket alphabet twice:

```python
closeToOpen = {")": "(", "}": "{", "]": "["}
# ...
if c == '(' or c == '{' or c == '[':
```

The first declaration says which characters are closing brackets and what they match. The second says which characters are opening brackets. They are two copies of the same fact, and they can drift.

Add `"<": ">"` to the map and forget to add `<` to the `if`, and `<` falls into the `else` branch, where `closeToOpen["<"]` raises `KeyError`. The failure is not subtle, but the cause is structural: there is no single place that defines the language.

The map already knows every closing bracket. Anything that is not a key is an opening bracket:

```python
for c in s:
    if c not in closeToOpen:
        stack.append(c)
        continue

    if not stack or stack[-1] != closeToOpen[c]:
        return False

    stack.pop()

return not stack
```

This is correct for the stated input, which contains only the six bracket characters. If the function might receive arbitrary text, keep an explicit `OPENING = "([{"` set and reject unknown characters instead — but then that set is the single source of truth, and the map should be checked against it, not duplicated from it.

Two smaller idioms: `return not stack` reads better than `return len(stack) == 0`, and `stack[-1] != closeToOpen[c]` collapses the nested `if/else` into one condition.

This is one instance of a general rule: every fact should have a single owner. The bracket alphabet is the fact here; the map and the `if` were two definitions of it. See [`fundamentals/43-single-source-of-truth`](../../fundamentals/43-single-source-of-truth) for the broader treatment.

## What generalizes

The stack here is a list of **unfinished obligations**. That framing shows up far beyond brackets:

- **Parsing nested syntax.** JSON objects, HTML tags, and arithmetic expressions all have scopes that open and close. The parser needs the same most-recent-first discipline.
- **The call stack.** The most recent call returns before its caller. Recursion is this algorithm with the stack managed by the language.
- **Undo.** The most recent action is the first one undone.
- **DFS and backtracking.** The frontier is LIFO: the most recently discovered node is explored next, and the most recent choice is the first one rolled back.
- **The Min Stack from the previous article.** Same container, different job. There the stack stored a **history** for a derived value; here it stores **obligations** for a structural property. A stack is what you reach for when the most recent thing is the next thing that must be resolved.

The broader distinction is between a **map** and a **schedule**:

| Question | Structure |
| --- | --- |
| What pairs with what? | hash map / lookup table |
| What must happen next? | stack / queue / priority queue |
| What was the value before? | history / snapshot |

Many bugs come from asking one structure to answer another's question. Here, the map knows every valid pair, but only the stack knows which pair is currently due.

## The takeaway

Counting is a global check on a local, ordered property. It can prove a string has the right ingredients and still miss that they are arranged in an impossible order.

The hash map supplies the pairing. The stack supplies the order. Validity lives in the difference: a `)` and a `(` form a pair no matter where they are, but a valid string requires the `)` to arrive when that `(` is the innermost open obligation.

So the lesson isn't "parentheses use a stack." It's:

> **When the rule is most-recent-first, use the structure that is most-recent-first.**

The map knows the pair. The stack knows the order. You need both, and neither one is the answer by itself.
