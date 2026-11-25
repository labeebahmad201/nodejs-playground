# Counting the Difference

*Comparing two multisets is usually written as two counters and an equality check. It can be one counter instead: increment over the first, decrement over the second, and equality becomes "every entry is zero". The same signed difference answers the extra-character, missing-character, and sliding-window questions without a second structure.*

Part of the [`techniques/`](./) collection.

## The canonical form

A multiset ignores order and keeps counts. Two collections are equal as multisets exactly when every element occurs the same number of times in both, so the count map is a canonical form: equal maps if and only if equal multisets. Any comparison of arrangements — sorting, permutations, adjacency — is a detour around that fact.

## One map, signed

The comparison needs one map, not two. Increment a count for every element of the source, decrement for every element of the target, and each key ends at `count_source - count_target`. Zero everywhere is the answer.

The target may contain keys the source never had. With `defaultdict(int)` the first decrement creates the key at zero and immediately subtracts, leaving `-1`; that auto-creation is the part that makes the shortcut work. A plain `dict` raises `KeyError` on the same line, and a `.get(key, 0) - 1` form works but reads like a workaround.

## The signs are the diagnosis

A positive entry means the element is in surplus in the source; a negative entry means the source is short of it. The sign therefore names which side the extra value came from, which is why the same structure answers "which character was added?" without a separate search: the single nonzero entry, read with its sign, is the answer.

For the ransom-note question the direction matters more than the final scan. Count the available letters, then walk the note and decrement; a count that goes negative at any point means the note needs a letter that is not available, and later letters cannot repair it, so the loop can stop immediately. The same early-exit reasoning does not apply to the source pass, where a count passing through zero is just an intermediate state.

## The sum invariant

The values sum to `len(source) - len(target)`, so unequal lengths force at least one nonzero entry. The final zero scan is therefore complete by itself, without a length check.

The length check is still worth writing first. It is `O(1)`, it rejects the common failure before any allocation, and it makes the invariant explicit to the reader. It also licenses a shortcut: once the lengths match, a positive entry cannot exist without a negative one, so scanning only one side's keys is enough.

## The index trap

The recurring bug in this pattern is a copied loop whose header changed and whose body did not:

```python
for i in range(len(target)):
    counts[source[i]] -= 1       # wrong
```

When the lengths match, both passes touch the source, every count cancels, and the function reports equality for any target of the same length. When the target is longer, the source is indexed out of bounds. When it is shorter, the leftover positives produce the right verdict for the wrong reason.

The fix is structural rather than attentional: iterate the elements.

```python
for element in target:
    counts[element] -= 1
```

There is no stale index left to copy because there is no index at all.

## Fixed alphabets

A dense array of counts indexed by `ord(c) - ord('a')` is the specialisation for lowercase English: `O(1)` space with a small constant, and faster than hashing. The price is that the alphabet is now encoded in the code, and any input outside it either indexes out of bounds or silently collides after a modulo. The map is the general form and handles arbitrary code points unchanged. Use the array only when the alphabet is guaranteed and small.

## Where it shows up

Anagram checking is the pure form: two strings, one difference map, zero everywhere.

Finding the extra character is the same map with one nonzero entry; if exactly one element was added, XOR also works, but the count map also reports which side and survives more than one extra.

The ransom note is a one-directional version: count the supply, decrement the demand, fail on the first negative.

A permutation in a window keeps the difference between a pattern's counts and a sliding window's counts, adding the entering character and removing the leaving one, and declaring a match when every entry is zero.

## Alternatives and non-solutions

Sorting both collections and comparing is `O(n log n)` and needs no map; it is the simplest correct form and works for any orderable elements, at the cost of the extra time and the allocations.

Two counters and an equality check is clear but builds the difference twice.

Fingerprints are the tempting non-solution. Comparing sets ignores multiplicity: `"aab"` and `"abb"` share `{a, b}`. Summing code points ignores identity: `"ad"` and `"bc"` both sum to `197`. XOR folds collide for the same reason. A count vector hashed into a single number inherits the same collision problem, and it also has to encode the vector unambiguously.

## To remember

One signed map, increment the source, decrement the target, and equal multisets are exactly the all-zero map. The signs name the surplus side, the sum equals the length difference, and iterating elements instead of indices removes the copy-paste failure that this pattern invites.
