# Valid Anagram

*An anagram is not an arrangement property, it is a multiset property: the same characters with the same counts. That makes the frequency vector the canonical form of the string, and the cheapest comparison is not two maps but one map carrying the signed difference.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻

## The property

Two strings are anagrams when one can be rearranged into the other, which is the same as saying every character occurs the same number of times in both. Order is irrelevant, so sorting is one way to expose the counts, and a frequency map is another. The map is the more direct statement of the property: the exact question is whether `count_s(c) - count_t(c)` is zero for every character.

That difference does not need two maps. One map can hold the difference itself, which is what the solution does: increment for every character of `s`, decrement for every character of `t`, and the strings are anagrams exactly when every entry ends at zero.

## One map, two passes

```text
s = "rat"        r +1    a +1    t +1
t = "car"        c -1    a  0    r  0
final            r  0    a  0    t +1    c -1
```

The `t` pass walks `c`, `a`, `r`: `c` is a key the map has never seen, so `defaultdict(int)` creates it at zero and the decrement leaves `-1`; `a` and `r` cancel their increments. The final entries are `t = +1` and `c = -1`, two witnesses that the strings differ. For `"anagram"` and `"nagaram"` every key finishes at zero and the answer is `True`.

The sign is diagnostic. A positive value means the character was left over in `s`; a negative value means `t` had more of it than `s` did. A character that appears only in `t` still gets an entry, because the decrement itself creates the key — that behaviour is load-bearing, and a plain `dict` would raise `KeyError` on that line instead.

## The final scan

The scan over the values is the whole verdict: any nonzero entry means the counts differ somewhere, and zero everywhere means the multisets match. There is a useful invariant behind why no separate bookkeeping is needed. The sum of all the differences is `len(s) - len(t)`, so strings of different lengths are guaranteed to leave at least one nonzero entry. The final scan catches length mismatches by itself.

## The early length check

A length check at the top is still worth having:

```python
if len(s) != len(t):
    return False
```

It is `O(1)`, it rejects the most common failure before the map is allocated, and it states the invariant outright. It is a fast path, not a correctness requirement — the final scan already covers that case. With the check in place, the map's values sum to zero, so a positive entry cannot exist without a matching negative one.

## The common mistake

The second loop is the one that gets copied and left half-edited:

```python
for i in range(len(t)):
    charFreq[s[i]] -= 1        # wrong: should be charFreq[t[i]]
```

The header was changed from `s` to `t` but the body still reads `s`. The consequences depend on the lengths, and one of them is silent:

When the lengths are equal, both passes touch the same characters of `s`, so every count cancels and every key ends at zero. The function returns `True` for any `t` of the same length: `"abc"` against `"xyz"` is reported as an anagram. When `t` is longer than `s`, the loop indexes past the end of `s` and raises `IndexError`. When `t` is shorter, the leftover positives make it return `False`, which happens to be the right verdict for two strings of different lengths, but the second string was never read.

The reason the mistake is so easy is that the loop body is an index expression, and only the loop header was renamed. Binding the character removes the shape entirely:

```python
for ch in t:
    charFreq[ch] -= 1
```

There is no `s` left in the body to forget, and the code is shorter.

## The code

```python
from collections import defaultdict

class Solution:
    def isAnagram(self, s: str, t: str) -> bool:
        if len(s) != len(t):
            return False

        charFreq = defaultdict(int)

        for i in range(len(s)):
            charFreq[s[i]] += 1

        for i in range(len(t)):
            charFreq[t[i]] -= 1

        for key, freq in charFreq.items():
            if freq != 0:
                return False

        return True
```

`defaultdict` has to be imported; LeetCode provides the class skeleton, not the `collections` import. The `key` in the final loop is unused, so `for freq in charFreq.values()` says the same thing with less noise.

## Alternatives

Sorting both strings and comparing them is the shortest correct solution and it works for any characters that can be ordered, but it is `O(n log n)` and allocates two lists.

A 26-element array indexed by `ord(c) - ord('a')` is `O(n)` time and `O(1)` space, and it is the fastest version for the stated alphabet. It is also the version that breaks the moment the input is not lowercase English, which is exactly the follow-up question.

`Counter(s) == Counter(t)` is a clear `O(n)` one-liner, but it builds two maps to compute a difference that one map can hold directly.

Comparing `set(s) == set(t)` is not enough: `"aab"` and `"abb"` share the set `{a, b}` and are not anagrams. Sums of code points and XOR folds are not enough either: `"ad"` and `"bc"` both sum to `197`.

## The Unicode follow-up

The dictionary needs no change. Its keys are whatever the string iterates over, so any character works as a key and there is no alphabet to encode. That is why the answer to the follow-up is that this solution already generalises, and the 26-array is the one that would need rewriting.

One precision is worth keeping. Python strings are sequences of code points, so the map compares code points exactly. A precomposed `é` and an `e` followed by a combining acute accent are different keys even though they render the same; if the input is allowed to mix canonical forms, normalise with `unicodedata.normalize("NFC", ...)` before counting. LeetCode's follow-up means code points, and at that level the solution works unchanged.

## Cost

The two passes are `O(len(s) + len(t))`, and the final scan is `O(k)` for `k` distinct characters, so the time is linear in the input size. The space is `O(k)`. Under the stated alphabet `k` is at most 26, which is effectively constant; with arbitrary Unicode, `k` can grow to the number of distinct code points in the input.

## Edge cases

Two empty strings are anagrams, and the code returns `True` through the empty map; the problem's constraints start at one character, so that case is outside the judge but not outside the function. A string is an anagram of itself. Strings of different lengths are rejected by the length check. A character that appears only in one string leaves a nonzero entry of the appropriate sign.

Case matters: `"A"` and `"a"` are different characters and their counts do not cancel. If the problem were case-insensitive, the fix belongs before the count, by normalising the strings, not inside the comparison.

## Mistakes

The stale index in the second loop is the headline: it silently returns `True` for any equal-length pair, raises on a longer `t`, and only looks correct on the shorter case.

Forgetting the `defaultdict` import turns the solution into a `NameError` at runtime.

Using a plain `dict` and decrementing a key that only exists in `t` raises `KeyError`; the difference map depends on the missing key being created at zero.

Comparing sets instead of counts misses the multiplicity, and comparing sums or XORs of code points lets different multisets collide.

Scanning only the keys that came from `s` is safe only when the lengths are known to match, because a `t`-only character is then always balanced by a missing `s` character. Without the length check, that shortcut can return `True` while the map still holds negative entries.

Treating a count that reaches zero during the `t` pass as success is premature: more occurrences of the same character can still arrive and push it below zero.

## To remember

Anagram means the frequency difference is zero everywhere. Increment over one string, decrement over the other, check that every value is zero, and put the length check first. Bind characters instead of indexing them, and the copy-paste bug that motivated this note cannot be written.

The mechanism is written out once in [`techniques/frequency-difference.md`](../techniques/frequency-difference.md), together with the extra-character, ransom-note, and sliding-window variants.
