# The Bounded Heap: Keep k, Evict the Root

*Keep the k best candidates in a heap of size k. The root is the worst candidate kept, so it is the one discarded when a new candidate arrives.*

Part of the [`techniques/`](./) collection.

## The rule

Use a min-heap of size k to keep the k largest scores. Use a max-heap of size k to keep the k smallest scores. Python's `heapq` is a min-heap, so the second case stores `(-score, payload)`.

```python
heap = []

for item in candidates:
    heapq.heappush(heap, (score(item), item))
    if len(heap) > k:
        heapq.heappop(heap)
```

After each iteration, the heap holds at most k entries. When it holds k, they are the k best-scoring candidates seen so far. The push makes the size k+1 for one step, and the pop removes the weakest of those entries. The check never sees a larger size because each iteration adds one entry.

The push happens before the pop. The heap is full, the new candidate arrives, and the pop compares the new candidate with the root before discarding anything. The root that leaves is the weakest of the k+1 entries.

The guarded form avoids the temporary entry:

```python
entry = (score(item), item)

if len(heap) < k:
    heapq.heappush(heap, entry)
elif entry[0] > heap[0][0]:
    heapq.heapreplace(heap, entry)
```

`heapreplace` removes the root and inserts the new entry in one operation. The comparison must come first, so the root is replaced only when the new entry beats it. Compare only the score. `entry > heap[0]` compares the payload when the scores tie, and the payload may not have `<`.

## Why the root is the worst kept

The heap removes its root. That is the only entry it can discard cheaply, so the root should be the entry we are willing to lose.

To keep the k largest scores, the entry we are willing to lose is the smallest score currently kept. A min-heap puts that entry at the root. To keep the k smallest, the entry we are willing to lose is the largest kept score, and a max-heap puts that entry at the root.

## The entry

The first tuple element is the score, because the heap orders by the first element. The second element is the payload we return. `(payload, score)` orders by the payload and selects the wrong candidates.

If two scores tie and the payload cannot be compared with `<`, `(score, payload)` raises `TypeError`. The three-part entry from [`heap-tuples`](./heap-tuples.md) fixes that by placing a unique counter between the two:

```python
heapq.heappush(heap, (score, next(order), payload))
```

The counter also resolves ties in insertion order. An integer payload such as a value, an index, or an id is already comparable, so the two-part entry is safe when its natural order is an acceptable tiebreak.

## A trace

Scores `(3, a), (5, b), (1, c), (4, d)` with k = 2, using a min-heap for the two largest:

```text
push (3,a)                       heap [(3,a)]
push (5,b)                       heap [(3,a), (5,b)]
push (1,c)   size 3 > 2          pop (1,c)      heap [(3,a), (5,b)]
push (4,d)   size 3 > 2          pop (3,a)      heap [(4,d), (5,b)]
```

The third push is rejected and the fourth evicts an incumbent. Both decisions compare the new candidate with the root. The heap never examines the entries below the root.

The final heap is in heap order. Its root is the weakest kept candidate, and the other entries sit below it. A min-heap drained by repeated pops returns ascending scores, which is the reverse of the usual top-k presentation. If the output must be ordered, sort the k entries at the end, or use a library function that sorts them.

## Cost

With d candidates and k kept, the heap performs d pushes and at most d − k pops, each `O(log k)`. Selection takes `O(d log k)` time and `O(k)` space. Computing the scores costs whatever the score needs. In a frequency problem, that is an `O(n)` counting pass over n input items, so the total is `O(n + d log k)`.

Sorting all d candidates takes `O(d log d)`. The heap replaces the `log d` factor with `log k`. When k is close to d, the heap saves little and sorting is simpler. When k is small, the heap saves a lot. The heap also works on a stream: it keeps `O(k)` memory and never stores the full input.

Quickselect gives `O(d)` average time, but it needs the full array, mutates it, and has a quadratic worst case. The bounded heap is online, and its worst case matches its average.

## The library forms

`heapq.nlargest(k, iterable, key=...)` implements this pattern. It keeps a min-heap of size k while scanning, then sorts the k results in descending order. `heapq.nsmallest` mirrors it with a max-heap internally. Both return a list of k and run in `O(d log k)`.

`Counter.most_common(k)` delegates to `heapq.nlargest` keyed by the count. Without an argument it sorts everything. That is why `most_common(k)` is cheap for small k and the no-argument form is not.

Writing the loop by hand is useful when the score is computed per candidate, when the input is a stream, or when the tiebreak must be explicit. The library versions rank by the key and break ties by input order, so they cannot use a payload-based tiebreak.

## Where it shows up

Top K Frequent Elements in [24-top-k-frequent-elements](../24-top-k-frequent-elements) uses it with the count as the score and the value as the payload.

K Closest Points to Origin is the k smallest case: the score is the squared distance from the origin, and the bounded heap is a max-heap of size k, implemented by negating the distance. The square root is unnecessary because squaring is monotone for non-negative distances.

Kth Largest Element keeps a min-heap of size k and reads its root, which is the smallest of the k largest. The heap costs `O(n log k)`; quickselect does it in `O(n)` average time when mutation and a worst case are acceptable.

A streaming top-k or heavy-hitters summary keeps k candidates and processes each new item in `O(log k)` without ever storing the stream.

Merge k sorted lists also uses a heap of size k, but k there is the number of input lists. Each list contributes one entry at a time, and the heap returns the next smallest value in the merged output. The shape is similar; the purpose is different.

## What goes wrong

A max-heap for the k largest scores puts the strongest kept score at the root, so the size limit removes the best candidate and keeps the k weakest. With scores `3, 5, 1, 4` and k = 2, it ends with the two lowest scores.

Popping before pushing, or popping when `len == k` before the insert, removes the root without comparing it with the new candidate. If the new candidate is worse, the heap has replaced a kept entry with a rejected one.

Skipping the size check lets the heap grow to d. The heap then costs `O(d log d)`, and sorting is simpler.

Comparing the whole tuple in the `heapreplace` guard crashes when the payload lacks `<`, or orders by the payload when it has `<`.

Reversing the tuple to `(payload, score)` ranks by the wrong field and returns the k largest payloads instead of the k best scores.

Pushing one entry per input occurrence instead of one per distinct candidate lets duplicates fill several of the k slots and can return the same candidate twice.

Expecting the hand-written heap to be sorted is wrong. It leaves its entries in heap order. Drain or sort deliberately if order matters.

For the k smallest scores, forgetting the negation builds a min-heap whose root is the smallest kept score, so the size limit evicts the entries we want to keep.

Mutating a score after the push corrupts the heap order, so the kept set can no longer be trusted.

## To remember

Keep k candidates and put the worst kept candidate at the root. For the k largest scores, that is a min-heap on the score. For the k smallest, it is a max-heap, which Python builds by negating the score. Push first and pop when the size exceeds k, or compare with the root before `heapreplace`. Store the score first and the payload second, and add a tiebreaker between them when the payload lacks `<`. The cost is `O(d log k)` time and `O(k)` space.
