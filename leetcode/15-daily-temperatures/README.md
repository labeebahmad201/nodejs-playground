# Daily Temperatures

*Each day asks its own question — "where is my first warmer day?" — and no single value answers them all. The stack is the set of questions still open: every new day closes as many as it can, then becomes one of them.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻↻

## Every day asks about a different day

Take the example and read it as pairs rather than as an array:

```text
index:    0   1   2   3   4   5   6   7
temp:    73  74  75  71  69  72  76  73
answer:   1   1   4   2   1   1   0   0
```

The 73 at index 0 is answered by 74 the very next day. The 75 at index 2 is answered by 76 four days later. The 71 at index 3 is answered by 72, two days later — not by 76, because 72 arrives first. Different days, different targets.

This is the first thing the problem tells you, and it rules out the cheap structures. If the question were "the first day hotter than the hottest day so far", a running maximum would be enough: one number, updated as you go. But the reference point here is the day you are standing on, so the target moves. What the stack has to hold is therefore not a summary of the data but a set of unresolved questions, each with its own threshold.

It also rules out a shortcut that is easy to reach for: the value you want is not the greatest value to the right, only the first one greater than you. Those are different questions. The greatest is global and can be tracked with one variable; the first greater is relative to each index, and each index can have a different answer.

## What the brute force pays for

The straightforward version does exactly what the definitions say: for each day, walk right until something warmer appears. That is `O(n²)` in the worst case, and the worst case is an array that never increases — a strictly decreasing run like `76, 75, 74, 73` sends every index all the way to the end.

The sharper way to see the cost is to look at where the work is concentrated. In an increasing array every day is answered immediately and the total work is linear. The waste starts when temperatures go down or stay equal. In `75, 71, 69`, each of those three will eventually look far to the right, and they are all looking for the same thing at the same time. The index at 69 scans forward and meets 72; the index at 71 scans forward and meets 69 and then 72; the index at 75 scans forward and meets 71, 69, 72, and then 76. The same values are inspected again and again by different days.

That repetition is the whole inefficiency. Each day in a descending run makes its own trip over the region that the other days in the run will also traverse.

## One arrival can answer several questions

Now look at index 5. The 72 there is the warmer day for 69 at index 4, one day later, and it is also the warmer day for 71 at index 3, two days later. One number resolves two waiting days. Later, 76 at index 6 does the same thing: it answers 72 at index 5 and 75 at index 2, four days later.

This is the observation the stack exists for. Instead of sending every day on its own trip to the right, keep the open questions in one place and let each new day answer all of them that it can. The trip is shared, and the shared trip turns the quadratic scan into a single pass.

## Every day is also a question

The other half is easy to miss. A day that answers nobody still has a question of its own, so it must be kept. When 72 arrives and resolves 69 and 71, it does not then vanish: 75 is still warmer, so 72 is still waiting, and it stays on the stack. The push happens for every day, resolved or not.

Resolution and registration are two separate jobs. The inner loop does the first; the push does the second; every day performs the second even when it performs none of the first. This is also why the current day cannot be thrown away after it pops something, which is the detail that forces the loop structure later on.

## Why the waiting questions form a stack

Inside a descending run, each newer day is colder than the one before it, so the newest question has a threshold no larger than any older one. That ordering is the invariant: the stack is non-increasing from bottom to top.

The invariant is what makes the work linear. When a new temperature arrives, it can only resolve questions whose threshold it beats. If it fails to beat the top of the stack, it fails to beat everything below the top as well, because those are all at least as warm. So the comparison can stop at the first failure. If it does beat the top, record the distance, pop, and try the next one down; one arrival is allowed to clear a whole run.

The strictness matters. A temperature equal to the top does not count as warmer, so the comparison is `>` and not `>=`, and an equal day stacks on top of the older one and waits. Two 72s in a row answer nothing for each other.

## The trace

```text
i  t[i]  what happens                                  stack, bottom → top
0   73   push                                          (73,0)
1   74   74 > 73: ans[0] = 1, pop                      (74,1)
2   75   75 > 74: ans[1] = 1, pop                      (75,2)
3   71   push                                          (75,2) (71,3)
4   69   push                                          (75,2) (71,3) (69,4)
5   72   72 > 69: ans[4] = 1
         72 > 71: ans[3] = 2, pop both                 (75,2) (72,5)
6   76   76 > 72: ans[5] = 1
         76 > 75: ans[2] = 4, pop both                 (76,6)
7   73   push                                          (76,6) (73,7)
end      76 and 73 never see a warmer day              ans = 1 1 4 2 1 1 0 0
```

Watch the stack during the descending run. From index 3 to index 5 it holds `75, 71, 69`, which is exactly the set of days whose answer is still unknown, ordered from most patient to least. The 72 at index 5 then answers the two newest of them and joins the stack itself, because 75 still has not been answered. The four days that 75 waits are the four days between index 2 and index 6, and while it waited the stack held each day that appeared in between — 71, then 69, then 72 — every one of them waiting on an answer of its own.

## The version that broke

The first implementation kept a single loop and made the walk conditional on the stack:

```python
stack = [(temperatures[0], 0)]
i = 1
while i < n and stack:
    if temperatures[i] > stack[-1][0]:
        result[stack[-1][1]] = i - stack[-1][1]
        stack.pop()          # note: i is not advanced here
    else:
        stack.append((temperatures[i], i))
        i += 1
```

The `and stack` looks harmless. Why keep walking if nobody is waiting? The answer is that an empty stack is a normal, temporary state, not the end of the array. It empties precisely when the current day has just answered everyone it could, which is exactly the moment the walk must continue to the next day.

On the example array this stops at index 1. The 74 answers the 73, the stack empties, the loop condition fails, and the function returns `[1, 0, 0, 0, 0, 0, 0, 0]`. On `[1, 2, 3]` it returns `[1, 0, 0]` instead of `[1, 1, 0]`, and the longer the array, the more of it is never visited.

The `if`/`else` pairing in that code is right, though, and worth keeping. With `>` on one side, `else` means exactly "not warmer", which covers both colder and equal. Writing `temperatures[i] <= stack[-1][0]` as an explicit second condition restates the same rule in a second place; if the strictness ever changes, both copies have to change together, and one of them will be forgotten.

Two other things in that version were shaped by the same loop. Starting the stack with index 0 forced the walk to begin at `i = 1` and created the single-element edge case the notes spend a paragraph on; starting empty removes the edge case entirely, because the first day goes through the same code as every other. And the `for` loop could not survive in the final shape because a `for` advances the index once per iteration, while one index may need to resolve several waiting days before moving on. The final code separates the two concerns instead of negotiating between them: a `while` over the array advances once per day, and an inner `while` drains the stack of everything that day can answer.

## The code

```python
class Solution:
    def dailyTemperatures(self, temperatures: list[int]) -> list[int]:
        n = len(temperatures)
        result = [0] * n          # unresolved days keep the zero
        stack = []                # (temperature, index), non-increasing

        i = 0
        while i < n:              # one iteration per day, never on the stack
            # This day may be the answer for several waiting days.
            # Stop at the first one it does not beat: everything below
            # that is at least as warm, so it cannot beat those either.
            while stack and temperatures[i] > stack[-1][0]:
                _, prev_index = stack.pop()
                result[prev_index] = i - prev_index

            # Every day becomes a question, even after answering others.
            stack.append((temperatures[i], i))
            i += 1

        return result
```

The result array is initialized to zeros so that days with no warmer future need no write at all. That also means the leftover entries on the stack after the walk are already correct; the explicit "set the rest to zero" loop in the first version was redundant, and its presence was a sign the invariant was not trusted yet.

The index is stored alongside the temperature because the answer is a difference of indices. The comparison uses the temperature, the arithmetic uses the index, and the tuple carries both.

## The numbers, not the nouns

The statement's words — "warmer", "days", "wait" — point toward the brute force. That reading is comfortable, and it is also where the pattern hides. What produced the stack was not the vocabulary but the specific data: writing the indices above the temperatures and the answers below, then following which day each one was waiting for.

That is how the two key observations became visible. The fact that 71 is answered by 72 rather than by 76 is a fact about values, and it is what shows that the answer is relative to the day. The fact that 69 and 71 are both answered at index 5 is what shows that one arrival can close several questions. Neither is visible in the sentence "find the next greater element"; both are visible in `73, 74, 75, 71, 69, 72, 76, 73`.

The trap is glossing over the numbers, and the reason it is a trap is that the numbers are the only place where the pattern lives. Abstracting to nouns feels like progress, and then the algorithm has to be recalled rather than derived. The insight worth keeping, in the words this was worked through with: the pattern emerges only if you do not fear the numbers. The moment you find yourself glossing over them, the pattern will not emerge from them at all.

## Cost

Every index enters the stack once and leaves at most once, so the inner `while` does at most `n` pops across the whole run, even though it can run many times for a single `i`. The time is `O(n)`, and the space is `O(n)` for the stack.

The stack size is a useful signal about the input. On an increasing array it never holds more than one entry, because each day answers the previous one immediately. On a decreasing array it holds every index until the end. The structure adapts to the run length instead of assuming one.

## Edge cases

A single day returns `[0]` with no special handling: the outer loop pushes it, the inner loop never fires, and the zero stands. An empty array returns `[]` for the same reason, although LeetCode's constraints start at one day.

An all-equal array returns all zeros. Values that are equal are not warmer, so nothing ever resolves anything and the stack grows to the length of the array. A strictly decreasing array behaves the same way for a different reason: every day is colder than the one before it, so every day waits forever.

Days at the tail that never meet a warmer day stay at zero, which is the same mechanism as the all-decreasing case. There is no separate cleanup step in the final code; the initialization and the invariant cover it.

## To remember

Each day asks a question whose answer depends on that day, so no single tracked value can answer them all; the stack holds the open questions, and each new day closes every question it beats. The push is unconditional because a day is always a new question, even when it has just answered several.

The stack stays non-increasing from bottom to top, which is why checking from the top and stopping at the first failure is enough, and why the whole scan is linear. The comparison is strict, the answer is an index difference, and the array of zeros is the answer for everything the walk never resolves.
