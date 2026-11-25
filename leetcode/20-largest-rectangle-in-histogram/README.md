# Largest Rectangle in Histogram

*A bar can be extended to the right until the first shorter bar. The stack holds the bars whose right edge is still unknown, and a shorter bar is the signal that closes them — with the shorter bar inheriting their left edge, because it can span everything they covered.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻↻↻

## The gist

Every column is a rectangle of its own height, and it can grow sideways as long as the bars beside it are at least as tall. So the answer is the largest `height × width` over every choice of height and the widest span that height survives.

The example `2, 1, 5, 6, 2, 3` shows both halves of the problem:

```text
index    0   1   2   3   4   5
height   2   1   5   6   2   3
         ▁   ▁   █   █   ▁   ▁
```

The 5 and the 6 can combine into a height-5 rectangle of width 2, area 10. The 2 at index 4 stops that rectangle on the right. But the 2 itself can reach back over the 5 and the 6, because they are taller than it; its own rectangle spans indices 2 through 5, area 8. The 1 at index 1 is shorter than everything, so it spans the whole histogram, area 6.

The maximum is 10, and the interesting part is that the bars that stop a rectangle do not erase it. They inherit it.

## Non-decreasing bars extend; a drop closes

While the bars are non-decreasing, each new bar can extend the previous rectangle rightwards; the height stays pinned by the shortest bar so far. That is the cheap part, and it needs no decisions: push and move on.

A drop is the first moment a decision is forced. The taller bars to the left cannot extend past `i - 1`, so their right edge is now known, and every one of them can be finalized. The current bar then takes their place, with its left edge moved back to the earliest of them, because a bar of height `h` spans every taller bar it just closed.

The sequence `1, 2, 3, 4, 2, 2` makes the merge visible:

```text
1 2 3 4 2 2
        ↑ the first 2 closes the 4 (area 4) and the 3 (area 6)
```

The 2 at index 1 is equal to the new bar, so it stays on the stack; it is the true left edge of the height-2 rectangle, and at the end it gives `2 × 5 = 10`. The 2 at index 4 starts a second entry at index 2, which is the merged left edge of the taller bars it closed. Keeping the earlier equal bar is what preserves the wider rectangle.

## Why the pending bars form a stack

The bars that are still open are exactly those whose right edge is unknown. Their heights are non-decreasing from the bottom of the stack to the top, and their positions increase, because a taller bar can only appear after a shorter one has been pushed below it.

When a shorter bar arrives, the bars that must close are the ones on top, tallest first. That is last-in-first-out: the most recently seen tall bar is the first to meet its right edge. The stack is not an implementation detail chosen for speed; it is the order in which the closures happen.

Each entry stores a **start index and a height**, not just a height. The start is the leftmost column the height can cover, which may be earlier than the bar's own index after a merge. A stack of heights alone cannot compute the width.

## The trace

For `2, 1, 5, 6, 2, 3`, with entries written as `(start, height)`:

```text
i=0  h=2   push (0,2)                          stack: (0,2)
i=1  h=1   pop (0,2): 2 × (1-0) = 2            stack: (0,1)
           push (0,1)                                        max 2
i=2  h=5   push (2,5)                          stack: (0,1) (2,5)
i=3  h=6   push (3,6)                          stack: (0,1) (2,5) (3,6)
i=4  h=2   pop (3,6): 6 × (4-3) = 6
           pop (2,5): 5 × (4-2) = 10
           push (2,2)                          stack: (0,1) (2,2)   max 10
i=5  h=3   push (5,3)                          stack: (0,1) (2,2) (5,3)
end        pop (5,3): 3 × (6-5) = 3
           pop (2,2): 2 × (6-2) = 8
           pop (0,1): 1 × (6-0) = 6                                 max 10
```

At `i=4` the drop from 6 to 2 closes both tall bars, and the new entry starts at index 2, the earliest of the bars it closed. The final drain handles the rectangles that never met a shorter bar, whose right edge is the end of the histogram.

## The code

```python
class Solution:
    def largestRectangleArea(self, heights: list[int]) -> int:
        stack = []
        maxArea = heights[0]        # the problem guarantees at least one bar

        for i in range(len(heights)):
            last_index = -1         # leftmost start among the bars popped here

            while stack and heights[i] < stack[-1][1]:
                index, _height = stack.pop()
                last_index = index

                # The bar on its own; redundant, since the width below is
                # at least 1, but harmless.
                maxArea = max(maxArea, _height)

                # It extends from its start to the column before i.
                area = _height * (i - 1 - index + 1)
                maxArea = max(maxArea, area)

            # The current bar can cover everything it just closed, so its
            # rectangle starts where the earliest of them started.
            if last_index != -1:
                stack.append((last_index, heights[i]))

            stack.append((i, heights[i]))

        n = len(heights)
        while stack:
            index, height = stack.pop()
            area = height * (n - index)
            maxArea = max(maxArea, area)

        return maxArea
```

`i - 1 - index + 1` is `i - index`: the rectangle ends at `i - 1`, so the width is the difference of the endpoints plus one. The shorthand is easier to read once the off-by-one has been worked out.

## What the original version does that it does not need

The individual-height update is redundant. Every pop has a width of at least one, so the area computed on the next line already covers the bar alone; the extra `max` never changes the answer.

The second push is also redundant. When a new bar closes taller bars, it pushes `(last_index, heights[i])`, which is the merged rectangle, and then `(i, heights[i])`, which is the bar starting at its own index. The second is a sub-rectangle of the first, so it can never beat it. It survives in the stack until it is popped, which is harmless: each entry computes an area from its own start, and both areas are valid. Dropping it leaves one entry per bar and a smaller stack.

## The same stack with one entry per bar

```python
class Solution:
    def largestRectangleArea(self, heights: list[int]) -> int:
        stack = []              # (start, height), heights non-decreasing
        best = 0

        for i, h in enumerate(heights):
            start = i           # where this bar's rectangle begins
            while stack and stack[-1][1] > h:
                index, height = stack.pop()
                best = max(best, height * (i - index))
                start = index   # the current bar inherits the left edge
            stack.append((start, h))

        n = len(heights)
        while stack:
            index, height = stack.pop()
            best = max(best, height * (n - index))

        return best
```

The only structural difference is `start`: instead of pushing two entries, one variable carries the earliest popped left edge forward, and a single entry is pushed with that start. The final drain and the width formulas are identical.

## Equal heights

The condition is strict — `heights[i] < stack[-1][1]`, or `>` in the shorter version — so equal bars stay on the stack separately. That is what keeps the earliest equal bar as the left edge for the widest rectangle.

Using `<=` and popping equal bars also works, but only if the new bar takes the popped bar's start, exactly like any other pop. Popping equals without merging loses the width of the earlier bar, which is a subtle way to undercount without any obvious error.

## The sentinel alternative

Appending a `0` to the histogram forces every remaining bar to be popped at that sentinel, because nothing is shorter than zero. It removes the final drain loop, at the cost of mutating a copy of the input or looping to `n + 1`. The two forms are equivalent; the explicit drain is easier to see and needs no special value.

## Cost

Each index is pushed once in the shorter version, and each entry is popped at most once, so the time is `O(n)`. The stack holds at most `n` entries, so the space is `O(n)`. The original version pushes at most twice per index, which doubles the constant but not the bound.

The brute force that tries every pair of endpoints is `O(n²)` and computes the minimum height of every subarray; the stack avoids it by keeping only the bars that can still be extended.

## Edge cases

A single bar returns its own height. A strictly increasing histogram never pops inside the loop, so the whole answer comes from the final drain; `1, 2, 3, 4` gives `3 × 2 = 6` there. A strictly decreasing histogram pops on every step after the first, and the drain is empty.

Equal heights give their widest rectangle only at the end, when the earliest equal bar is finally popped. Zero-height bars are allowed and contribute nothing; they act as sentinels, closing everything taller than them.

An empty histogram crashes the original code at `heights[0]`. The problem's constraints start at one bar, so the code is safe as submitted, but a reusable function needs the guard.

## Mistakes

Forgetting the final drain loses every rectangle that extends to the right edge, which is most of them when the input is increasing.

Using `i` as the new bar's start instead of the earliest popped index loses the width the shorter bar gains over the taller columns it just closed.

Storing only heights makes the width impossible; the start index is the other half of the entry.

Popping a single bar instead of all taller bars leaves the stack out of order and misses rectangles that span several columns.

The width off-by-one is easy to write as `i - index - 1`; the range is `index` through `i - 1`, inclusive.

## To remember

Each bar extends right until a shorter one. The stack holds the still-open bars in non-decreasing height order; a shorter bar closes the taller ones, takes the earliest of their starts, and becomes the new open rectangle at that start. Area is height times width, width is the distance from the start to the closing column, and the final drain closes whatever is left.
