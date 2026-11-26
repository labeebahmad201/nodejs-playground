# Top K Frequent Elements

*Count the frequencies, then keep the k most frequent values in a min-heap of size k.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻

## The solution

Count how often each value occurs. Then scan the distinct values and keep the k with the highest counts in a min-heap. For each value, push `(count, value)` and pop the root whenever the heap grows past k. The heap ends with the answer.

```python
from collections import defaultdict
import heapq

class Solution:
    def topKFrequent(self, nums: list[int], k: int) -> list[int]:
        freqMap = defaultdict(int)
        for num in nums:
            freqMap[num] += 1

        minHeap = []
        for num, freq in freqMap.items():
            heapq.heappush(minHeap, (freq, num))
            if len(minHeap) > k:
                heapq.heappop(minHeap)

        return [num for _, num in minHeap]
```

`defaultdict` needs its import. LeetCode's editor does not add the `collections` import, so a file that starts with `import heapq` alone raises `NameError: name 'defaultdict' is not defined` on the first increment.

## Why a min-heap

The heap removes its root. That is the only entry it can discard cheaply, so the root should be the entry we are willing to lose.

For the k most frequent values, the entry we are willing to lose is the least frequent value currently kept. A min-heap keyed by frequency puts that entry at the root. When the heap holds k+1 entries, the root is the least frequent of those k+1, and popping it leaves the k most frequent.

The loop pushes first and checks the size second. The heap holds k+1 entries for one step, then discards the weakest. The size never grows further because each iteration adds one entry.

An alternative form compares before inserting and never holds the extra entry:

```python
if len(minHeap) < k:
    heapq.heappush(minHeap, (freq, num))
elif freq > minHeap[0][0]:
    heapq.heapreplace(minHeap, (freq, num))
```

`heapreplace` removes the root and inserts the new entry in one operation. The comparison must come first, so the root is replaced only when the new entry is more frequent.

For the k smallest scores, use a max-heap and keep the largest kept score at the root. Python provides a min-heap, so the max-heap is built by negating the score.

## The tuple

Each entry is `(frequency, value)`. The frequency comes first because the heap orders by the first element. The value is the payload we return.

When two frequencies tie, Python compares the values. The values are integers, so the comparison is safe. The tie decides which of two equally frequent values survives at the cutoff, and the problem accepts any order.

A payload without `<` would raise `TypeError` on a tie. The three-part entry from [`heap-tuples`](../techniques/heap-tuples.md) handles that case by placing a unique counter between the frequency and the payload.

## The trace

For `nums = [1,1,1,2,2,3]` and k = 2, the counts are `1:3, 2:2, 3:1`.

```text
start                       heap []
push (3, 1)                 heap [(3,1)]
push (2, 2)                 heap [(2,2), (3,1)]
push (1, 3)   size 3 > 2    pop (1,3)    heap [(2,2), (3,1)]
return [2, 1]
```

The third push adds the least frequent value. The pop removes it immediately, so the heap stays the same. The loop needed no special check for this case; the root comparison handled it.

## Cost

Let n be the length of `nums`, d the number of distinct values, and k the requested count. Counting is `O(n)`. The heap loop runs d times, once per distinct value. Each push costs `O(log k)`, and each pop costs `O(log k)`, so the loop is `O(d log k)`. The total is `O(n + d log k)`. The map uses `O(d)` space, and the heap uses `O(k)`.

The heap height is `log k` because the heap never holds more than k+1 entries. The loop performs d pushes, not n. For a million numbers with ten distinct values and k = 3, the counting loop performs a million increments and the heap loop performs ten pushes. `O(n log k)` is a valid upper bound, but it suggests a heap operation for every input element.

Sorting the distinct values takes `O(d log d)`. The heap replaces the `log d` factor with `log k`. If k is close to d, the heap saves little and sorting is simpler. If k is much smaller than d, the heap saves a lot.

## Alternatives

Bucket sort removes the logarithm. Frequencies are integers from 1 to n, so they can index an array of lists. Append each distinct value to `buckets[f]`, then walk the buckets from n down to 1 and collect values until you have k. This takes `O(n)` time and `O(n)` space, and it is the fastest version here. It requires a small integer score; a heap works with any orderable score, such as a distance or a price, and uses `O(k)` extra space.

`Counter.most_common(k)` uses the same heap internally. With an argument it delegates to `heapq.nlargest` keyed by the count; without an argument it sorts everything. `[value for value, _ in Counter(nums).most_common(k)]` is a correct one-liner. `heapq.nlargest(k, freqMap.items(), key=lambda kv: kv[1])` does the same without a `Counter`.

Quickselect gives `O(d)` average time by partitioning the counts until the top k are on one side. It needs an array of pairs, mutates it, and has an `O(d²)` worst case. The heap's `O(d log k)` is easier to reason about and fast enough for the stated limits. A full sort is the simplest correct baseline and is the better choice when k is a large fraction of d.

## Edge cases

k = 1 returns the single most frequent value. If two values tie, the tuple comparison keeps the larger value; the problem's uniqueness guarantee avoids that case.

k equal to the number of distinct values returns every key. The size limit never triggers, so the heap becomes a heap-ordered copy of the map.

A single-element array with k = 1 returns that element. An array with one repeated value has d = 1, so k must be 1. The duplicate-push bug still passes this case, which is why it can hide.

Negative values work as ordinary keys. The frequency arithmetic never touches the value itself.

A tie at the cutoff would make the answer set ambiguous. The problem guarantees a unique answer, so that case does not appear in the tests. The tuple tiebreak still makes the output deterministic.

## What goes wrong

Reading `nums` instead of `freqMap.items()` pushes one entry per occurrence. With `[1,1,1,2,2,3]` and k = 2, the loop pushes `(3,1)` three times, and those three copies fill both heap slots. The result is `[1, 1]`, and `2` never enters the heap.

```text
push (3,1)  push (3,1)  push (3,1)  → pop (3,1)
push (2,2)                          → pop (2,2)   two copies of (3,1) remain
push (2,2)                          → pop (2,2)
push (1,3)                          → pop (1,3)
final [1, 1]
```

The bug can pass small tests. With k = 1 the duplicate copies are popped unless they are the best value, and with one distinct value the answer is trivial. It appears when one value's copies can fill the heap on their own.

A max-heap keyed by frequency puts the most frequent kept value at the root, so the pop discards the answer. For the same example, pushing `(-frequency, value)` and popping the smallest negated key removes `1` and leaves `[2, 3]`; the answer is `[1, 2]`.

Popping before comparing removes the root without looking at the new value. If the new value is worse, the heap has replaced a kept entry with a rejected one. For the same example, the final heap is `[3, 1]`: frequency 2 is dropped for frequency 1.

Skipping the size check lets the heap grow to d entries, which costs `O(d log d)` and makes sorting the pairs simpler.

Popping when `len(minHeap) >= k` before the push is the same eviction-order bug.

Putting the value first, `(num, freq)`, orders the heap by value. The k entries kept are the largest values instead of the most frequent ones.

Returning the heap's tuples gives the judge `(freq, value)` pairs where it expects integers.

The hand-written heap is in heap order, so the k results are unsorted. The problem accepts any order. If sorted output were required, sort the k entries at the end or use `heapq.nlargest`.

The first version pushed bare `nums[i]` values before the counts existed. A heap of bare numbers orders by value and cannot answer a question about frequency.

## To remember

Count the values first. Then keep k candidates in a min-heap keyed by frequency: push each pair, and pop when the size exceeds k. Read the distinct keys from `freqMap.items()`, and import `defaultdict`.

The mechanism is written out once in [`techniques/bounded-heap.md`](../techniques/bounded-heap.md), together with the k-closest-points, kth-largest, and streaming variants.
