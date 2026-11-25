# Two Sum

*The brute force asks "which other element completes this one?" and pays a scan for every element. Rewriting the pair condition as `x = target - y` turns that question into a lookup of one exact value, and a map from value to index makes the lookup constant time.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻

## The rewrite

The obvious solution tries every pair and checks the sum, which is `O(n²)`. The rewrite avoids the second loop by solving the condition for the partner instead of searching for it. If the current value is `y`, the only value that can complete the pair is

```text
x + y = target      →      x = target - y
```

That is the note in the original solution, and the example there is the same pair seen from both sides:

```text
9 - 2 = 7       2 + 7 = 9
9 - 7 = 2       7 + 2 = 9
```

Whichever element the scan reaches second is the one that computes the complement of the first and finds it already stored. So the pass keeps a map of everything seen so far, and each new element either finds its partner in that map or becomes a future partner itself.

With `nums = [2, 7, 11, 15]` and `target = 9`, the scan is short:

```text
i=0  value 2   complement 7    not in {}          store 2 → 0
i=1  value 7   complement 2    in seen at 0       return [0, 1]
```

## Why the map holds values, not indices

The answer needs the positions of both elements, so the map has to be `value → index`. A set of seen values would answer "does a partner exist?" but not "where is it". The inverted map, `index → value`, fails on the first membership test: `complement in seen` would be asking whether the complement is a valid index.

Because the stored element was seen earlier than the current one, `[seen[x], i]` comes out in increasing index order, which is the conventional form of the answer.

## Check before insert

The order of the two statements inside the loop is the algorithm:

```python
seen = {}

for i in range(len(nums)):
    x = target - nums[i]

    if x in seen:
        return [seen[x], i]

    seen[nums[i]] = i

return []
```

Inserting before checking lets an element pair with itself. With `[3]` and `target = 6`, the single element is stored at index `0`, its own complement `3` is found immediately, and the function returns `[0, 0]` — the same index twice, which the problem does not allow. Checking first guarantees that the map contains only elements strictly to the left of `i`, so a hit is always a partner at a different index.

The trailing `return []` cannot run under the problem's guarantee of exactly one solution. It is there for the type checker and for anyone who reuses the function on input without that guarantee; on valid input the loop always returns from inside.

## Duplicates

Two equal values can be the pair. With `[3, 3]` and `target = 6`, the first `3` is stored at index `0`, and the second computes complement `3`, finds it, and returns `[0, 1]`. The check-before-insert order is what makes this work, and it also means the first occurrence's index is the one that survives until the pair closes.

When a value repeats before its complement appears, the later occurrence overwrites the earlier index. With `[2, 2, 3]` and `target = 5`, the second `2` overwrites the first, so the `3` returns `[1, 2]` rather than `[0, 2]`. Both are valid pairs, because any occurrence works. If the earliest pair is required, `seen.setdefault(nums[i], i)` keeps the first index instead of overwriting it.

## Cost and alternatives

The pass is `O(n)` expected time and the map holds at most `n` entries, so the space is `O(n)`. Membership is `O(1)` on average, and integer keys make the hash distribution uninteresting in practice.

The brute force is `O(n²)` time and `O(1)` space. Sorting and walking two pointers is `O(n log n)`, but sorting destroys the original positions, so the values have to be carried with their indices as `(value, index)` pairs and sorted by value before the walk; it is correct, longer, and slower than the map for the same `O(n)` space. The map wins here because the question is about positions, not order.

## Edge cases

Negative values and a negative target are ordinary: the complement arithmetic does not care about sign. `[-3, 4, 3, 90]` with target `0` gives `[0, 2]`, and `[-1, -2, -3, -4, -5]` with target `-8` gives `[2, 4]`.

Zeros work as keys like any other value; `[0, 4, 3, 0]` with target `0` gives `[0, 3]`, which is the two equal values case again.

The pair can be two adjacent elements, the first and the last, or two equal values at any distance. The constraints guarantee at least two elements and exactly one solution, so the scan never runs out before finding the answer.

## Mistakes

Adding before checking creates the self-pair and reports the same index twice.

Storing `index → value` instead of `value → index` makes the membership test ask about indices rather than complements, so it never finds a real partner.

Computing the partner with `nums.index(complement)` instead of a map turns every step into a linear scan, and when the complement equals the value it can also return the current index.

Building the map in a first pass and scanning in a second without a `seen[complement] != i` guard pairs a single element with itself whenever the target is twice that value.

Assuming the array is sorted sends the solution toward two pointers and a sort that loses the indices it needs.

## To remember

Rewrite the pair as a complement, keep `value → index` for what has already been seen, check before inserting, and let the later element close the pair. One pass, `O(n)` time, `O(n)` space.

The mechanism is written out once in [`techniques/complement-lookup.md`](../techniques/complement-lookup.md), together with the difference, prefix-sum, and pair-sum variants.
