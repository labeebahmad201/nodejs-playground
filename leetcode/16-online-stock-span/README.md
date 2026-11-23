# Online Stock Span

*The span of a day is the run of days ending today whose prices are at most today's. Brute force walks that run on every call; the fix is to make each run collapse into the day that ends it, so no run is ever walked twice.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻↻

## The brute force, and why one call looks cheap

The straightforward version keeps every price and walks backwards from today until a higher price stops it:

```python
def next(self, price: int) -> int:
    self.prices.append(price)

    i = len(self.prices) - 1
    count = 0
    while i >= 0 and self.prices[i] <= price:
        count += 1
        i -= 1
    return count
```

The count is the span by definition: consecutive days, ending today, whose price is at most today's. In `7, 2, 1, 2`, the last day has span 3 because the 1 and the earlier 2 both qualify and the 7 stops the walk. A single call costs the length of that run, which is at most the number of days so far.

On its own that looks acceptable. The mistake is judging the cost per call when the interface is called many times.

## Why per-call linear becomes quadratic overall

The problem calls `next` up to ten thousand times, and each call can walk the entire history. A non-decreasing sequence is the worst case: `5, 6, 7` makes the first call do 1 comparison, the second 2, the third 3. After `n` calls the total is `1 + 2 + … + n`, which is about `n² / 2`. At ten thousand calls that is roughly fifty million comparisons for work that should be linear.

The repeated work is not the comparisons themselves; it is that the same days are examined again and again. When 7 asks its question it walks 6 and then 5. The 6 had already walked the 5. The history is being reread on every call instead of being reused.

That is the real statement of the inefficiency, and it is the one worth carrying into the design: if a later day is going to re-walk the same stretch, the earlier walk should have left something behind that answers the later question directly.

## The question that produced the design

The detour that does not work is trying structures and hoping one fits — "maybe a stack, maybe a precomputed count" — and then inventing a story for whichever one seems to work. The question that does work is narrower: what should a day carry with it so that a later day does not have to rescan?

The first attempt is to store, for each price, how many consecutive days before it were at most equal to it. That fails to compose. The 7 in `7, 2, 1, 2` has a count of 1, but the later 2 cannot use it, because its own run stops at the 7. Even a later 8 cannot use the 7's count as a separate piece, since including the 7 means including everything the 7 covers. The count is only reusable by a day that can take the entire run the count describes.

So the thing to store is not a count attached to a price, but a run that can be absorbed whole: the block.

## Blocks, and what makes one absorbable

A stack entry `(price, span)` means that the last `span` days form a block whose newest day has this `price`, every price inside the block is at most `price`, and the day immediately before the block has a price above `price` (or the block reaches the start of the history).

When a new price `P` arrives, it can absorb the top block whenever the block's price is at most `P`. Every day in the block is at most the block's price, so every day is at most `P`, and the block is adjacent to today, so the run is continuous. The block's span is added and the block is popped. The first block whose price is above `P` is the blocker, and the scan stops there.

The part that makes this safe is that absorbed blocks are never needed again. If a future price is at least `P`, it absorbs `P`'s block, which already contains the days in question. If a future price is below `P`, it stops at `P` and never reaches them. Either way, the only route to an absorbed day is through the block that absorbed it, so keeping the day separately would be redundant.

That is the domination argument in one sentence: the block that absorbed a run is later and at least as expensive as everything in it, so any query that would reach past the absorber must also include the absorber, and any query that stops at the absorber never sees what is behind it.

## The scenarios

Take the increasing run `5, 6, 7`. The 6 absorbs the 5 and becomes a block of two days. The 7 then absorbs that whole block and becomes a block of three. After each call the stack holds a single entry, and the spans are 1, 2, 3. This is where the last-in-first-out behaviour shows up: the block the new price must deal with is the newest one, the one immediately before it, not some entry further back.

Now make the prices drop: `5, 6, 7, 6`. The last 6 is smaller than the 7, so it absorbs nothing and its span is 1. It also cannot see the earlier 6, because the 7 sits between them and is higher than both. The stack becomes `(7, 3)` followed by `(6, 1)`. A drop does not merge; it starts a new block.

The third case is the one that makes the design convincing: `100, 5, 6, 7, 6`. The stack at the end is `(100, 1), (7, 3), (6, 1)`. Notice that the 5 is not in it. The 5 was absorbed by the 6, and that block was absorbed by the 7. What looked like five days of history is three blocks, and the compression is the whole point: the 5 will never be consulted again, because anything that could reach it would have to pass through the 7's block, which already counts it.

Finally, append another 100: `100, 5, 6, 7, 6, 100`. The new 100 absorbs the `(6, 1)`, then the `(7, 3)`, then the `(100, 1)` — equality counts as absorbable — and its span is 6. The stack collapses to a single entry. And now the observation that closes the argument: the 7 and 6 are gone and will never be needed. A future price below 100 stops at the 100 block and never reaches them; a future price at or above 100 absorbs the whole block, which already contains them. There is no third possibility.

## Why it is a stack

The scan always starts at the most recent block and moves backwards in time, and absorption always removes from that same end. That is last-in-first-out by construction, which is the honest justification for the stack rather than "this problem is known to use one". The reason the newest entry is the one to examine is positional: it is the only block adjacent to today, so it must be absorbed or treated as the blocker before any older block becomes visible.

There is a second invariant that makes the stopping rule work. Because everything with a price at most `P` is popped before `P` is pushed, the remaining top is strictly greater than `P`. So the stack's prices strictly decrease from bottom to top. If the top block does not qualify, nothing below it can, and the loop can stop after a single failure.

## The trace

```text
call  price  absorbed                        span  stack, bottom → top
1     100    —                                 1   (100,1)
2     5      —                                 1   (100,1) (5,1)
3     6      (5,1)                             2   (100,1) (6,2)
4     7      (6,2)                             3   (100,1) (7,3)
5     6      —                                 1   (100,1) (7,3) (6,1)
6     100    (6,1), (7,3), (100,1)             6   (100,6)
```

Call 3 is worth pausing on. The 6 absorbs the block `(5, 1)`, so the resulting span is 2, and the new block already accounts for the 5. Call 4 then absorbs that block of 2, so the 5 is counted a second time indirectly — not by revisiting it, but by carrying its count forward inside the 6's span. That is the pre-calculation doing its job.

## The code

```python
class StockSpanner:
    def __init__(self) -> None:
        # (price, span) blocks, newest last. Prices strictly decrease
        # from bottom to top, so the first non-qualifying block is the
        # blocker and everything below it is more expensive still.
        self.stack: list[tuple[int, int]] = []

    def next(self, price: int) -> int:
        span = 1                        # today counts for itself

        # One price can absorb several consecutive blocks, so this is a
        # loop, not a single check. Equality counts, because the span is
        # defined as prices less than or equal to today's.
        while self.stack and price >= self.stack[-1][0]:
            _, block_span = self.stack.pop()
            span += block_span

        self.stack.append((price, span))
        return span
```

Returning `span` and returning `self.stack[-1][1]` are the same value; the local is simpler and does not depend on the push having happened. The raw price list is gone entirely: the blocks are the compressed history, and the span attached to each block is the only thing a later call needs from the days inside it.

## The `if` that had to become a `while`

The first version used a single `if` for the absorption, which reads naturally if you think of the span as "today plus the previous run". It is wrong on the problem's own example. Before the last day of `7, 2, 1, 2` the stack is `(7, 1), (2, 1), (1, 1)`. A single check absorbs only `(1, 1)`, giving a span of 2, but the previous day's 2 is also at most today's 2, so the correct span is 3. The `if` never looks past the first block.

The same failure appears in `100, 50, 40, 60`, where the 60 absorbs the 40, then the 50, and only then meets the 100. A single check returns 2 instead of 3. The loop exists because the number of absorbable blocks is not bounded by one.

## The empty-stack check is not optional

The guard reads like a formality until the first call, when the stack is empty and `self.stack[-1]` raises `IndexError`. Since the first call always arrives with nothing to absorb, the guard is the normal case, not a defensive extra. It also gives the correct default: with nothing to absorb, the span stays at 1, which is exactly today counted alone.

## `>=` here, `>` in Daily Temperatures

The span definition includes prices equal to today's, so equality extends the run and the comparison is `>=`. On `5, 5, 5` the spans are 1, 2, 3; with `>` they would be 1, 1, 1. In the large example, the final 100 gets a span of 6 with `>=` and 5 with `>`, because it would fail to absorb the earlier 100.

This is the opposite of the daily temperatures problem, where the question is the first day strictly warmer, so equal days do not answer each other and the comparison must be `>`. The two problems share a structure and disagree on exactly the boundary condition, which is why the boundary has to come from the definition rather than from the pattern.

## The same shape as Daily Temperatures

The side question worth answering is why the stack is justified there as well, not just here. In both problems a new value resolves a suffix of the unresolved history. The pending items are kept in order of arrival, the newest is the first one the new value meets, and once an item is resolved it is dominated by its resolver and never needed again.

What differs is the unit. In daily temperatures each pending item is a single index waiting for a strictly greater price, and resolving it records a distance. Here each pending item is a block of days that already carries its own span, and resolving it adds that span. The first stack is non-increasing because equal values wait; this one is strictly decreasing because equal values are absorbed. Same argument, different boundary.

## Cost

Each block is pushed once and popped at most once, so across `n` calls the inner loop performs at most `n` pops in total. The amortised cost is `O(1)` per call and `O(n)` for the whole sequence, with `O(n)` space in the worst case. The brute force is `O(n)` per call and `O(n²)` overall, which is the gap that makes the compression worth the extra state.

## Edge cases

The first call always has an empty stack and returns 1. A strictly decreasing sequence keeps every day as its own block, so every span is 1 and the stack grows to the full length. A strictly increasing sequence absorbs on every call, so every span grows and the stack stays at one entry. A run of equal prices behaves like the increasing case, with spans 1, 2, 3 and a single block, because equality is absorbable.

The problem bounds prices at 1 or more and the number of calls at ten thousand, so the stack depth and the arithmetic are both comfortable. An empty history never occurs through the interface, but the code would return 1 for a first call regardless of the price.

## To remember

The span of a day is a run, and a run can be summarised by its length plus the price that ends it. Once a run is summarised, a later price either takes the whole summary or is blocked by it, so the individual days are never needed again. That is why the stack can throw them away.

The stack is last-in-first-out because the run that ends immediately before today is the only one today can touch. The prices in it strictly decrease from bottom to top, so the first block that cannot be absorbed is the blocker. The comparison is `>=` because the span is defined with "at most", and the loop is a loop because one price can absorb several blocks.
