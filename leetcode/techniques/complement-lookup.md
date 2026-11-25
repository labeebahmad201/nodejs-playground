# Looking Up the Complement

*A pair condition such as `a + b = target` is a search for one exact value, `target - a`. Once the condition is rewritten that way, a hash map turns the search into a constant-time lookup, and the pair problem becomes a single pass.*

Part of the [`techniques/`](./) collection.

## The rewrite

The brute-force pair search asks "which other element completes this one?" and answers it by trying every other element. The rewrite asks the same question with the answer already computed: if the current value is `a`, the only value that can complete it is `target - a`. There is no range of candidates to scan, just one number to look up.

With `target = 9` and the pair `2, 7`, the two directions are the same fact:

```text
9 - 2 = 7       2 + 7 = 9
9 - 7 = 2       7 + 2 = 9
```

Whichever element the scan reaches second is the one that computes the complement of the first and finds it already stored. That asymmetry is the whole algorithm: store what has been seen, and let the later element do the lookup.

## A set answers existence, a map answers location

If the question is only whether a pair exists, a set of seen values is enough: check `target - a`, and insert `a`. The moment the complement is present, a pair exists.

Two Sum asks for the indices, so the set is not enough. The structure has to be `value → index`, because the answer needs the position of the earlier element, not just the fact that it was seen. Storing `index → value` is the inverted map and fails immediately: the membership test `complement in seen` would be checking whether the complement is a valid index.

## One pass, check before insert

```python
seen = {}                       # value -> index, for elements before i
for i, value in enumerate(nums):
    complement = target - value
    if complement in seen:      # an earlier element completes this one
        return [seen[complement], i]
    seen[value] = i             # only now is this element available as a partner
return []
```

The order of the last two statements is not stylistic. Inserting before checking lets an element pair with itself: with `[3]` and `target = 6`, the element is stored at index `0`, its own complement is immediately found, and the function returns `[0, 0]` — the same index twice, which the problem forbids.

Checking first means the map only ever contains elements strictly to the left of `i`. Any hit is therefore a partner at a different index, and the pair is complete as soon as it is found.

## Duplicates

Two equal values can be the pair. With `[3, 3]` and `target = 6`, the first `3` is stored at index `0`, and the second computes complement `3`, finds it, and returns `[0, 1]`.

When a value repeats before its complement appears, the later occurrence overwrites the earlier index in the map. That does not break correctness, because any occurrence is a valid partner. With `[2, 2, 3]` and `target = 5`, the second `2` overwrites the first, and the `3` at the end returns `[1, 2]` instead of `[0, 2]`. Both are valid answers. If the earliest pair matters, the insert becomes `seen.setdefault(value, i)`, which keeps the first index.

## The two-pass version and its trap

Building the full map first and scanning afterwards also works, but the scan must reject the element itself:

```python
seen = {value: i for i, value in enumerate(nums)}
for i, value in enumerate(nums):
    complement = target - value
    if complement in seen and seen[complement] != i:
        return [seen[complement], i]
```

Without the `seen[complement] != i` check, a value that is exactly half the target pairs with its own single occurrence. The one-pass form has no such case because the map never contains the current element.

## What the map costs

The pass is `O(n)` expected time and the map holds at most `n` entries, so the space is `O(n)`. Membership is `O(1)` on average; adversarial hash collisions could degrade it, but integer keys hash to themselves and that is not a practical concern for this problem.

The alternatives are worse for the same question. The brute force is `O(n²)` time and `O(1)` space. Sorting and walking two pointers is `O(n log n)`, but sorting destroys the original indices, so the elements have to be carried as `(value, index)` pairs and sorted by value; the two-pointer walk then produces the indices. It is correct, more code, and slower than the map for the same `O(n)` space.

## Relatives

The same rewrite handles every variant of "find two things that combine". For a difference `a - b = k`, the scan looks up `a - k` among the earlier values. For a subarray summing to `k`, the stored key is a prefix sum and the lookup is `prefix - k`. For four numbers, the keys are pair sums and the lookup is `target - pair_sum`, which is the same complement idea one level up.

In each case the move is identical: name the exact value that would complete the current one, store what has already been seen in a map keyed by that value, and check before inserting.

## Mistakes

Checking after inserting creates the self-pair and reports the same index twice.

Storing the index as the key and the value as the payload inverts the map, so the membership test asks the wrong question.

Computing the partner with `nums.index(complement)` instead of a map turns each step into a linear scan, and it can also return the current index when the complement equals the value.

Forgetting to insert at all finds nothing; inserting only after a failed lookup but outside the loop misses every earlier element.

The two-pass form without the `index != current` guard pairs a single element with itself whenever the target is twice that element.

## To remember

Rewrite the pair as a complement, keep `value → index` for everything already seen, check before inserting, and let the later element close the pair. One pass, `O(n)` time, `O(n)` space.
