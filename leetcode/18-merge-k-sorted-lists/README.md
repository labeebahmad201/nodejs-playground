# Merge k Sorted Lists

*The two-list merge picks the smaller of two heads. With k lists the same question has k candidates, so the structure that answers "smallest head" is a heap — one node per list, and each pop promotes that list's next node.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻↻

## The same merge with more heads

[`12-merge-two-sorted-lists`](../12-merge-two-sorted-lists) rests on one invariant: at every step the next output node is the smaller of the two current heads. Nothing about that depends on there being two lists. With k lists the next node is the smallest of the k current heads, where "head" means the first node of what remains of that list.

So the algorithm is the same merge. The only thing that changes is how the minimum is found. With two lists a comparison is enough; with k, the obvious extension is to scan the k heads. That version is worth writing out, because seeing what it costs is what makes the heap worth the extra structure.

## The N·k version

Keep the current head of each list in an array and scan the array at every step:

```python
heads = [node for node in lists if node]
dummy = tail = ListNode(0)

while True:
    best = -1
    for i, node in enumerate(heads):
        if node is not None and (best == -1 or node.val < heads[best].val):
            best = i

    if best == -1:                 # every list is exhausted
        break

    node = heads[best]
    tail.next = node
    tail = tail.next
    heads[best] = node.next

tail.next = None
return dummy.next
```

Each outer iteration emits exactly one node, so there are `N` of them, and each inner loop inspects up to `k` heads. That is `O(Nk)` time and `O(k)` space. It is correct, and for two or three lists it is perfectly reasonable; the cost only becomes the problem when `k` grows.

The waste is specific. Between two steps, exactly one candidate changes: the head of the list whose node was just popped. The scan throws away the comparison information from the previous step and recomputes the minimum over all `k` heads from scratch. The heap keeps that information in its structure, so a change costs one pop and one push, `O(log k)` each, instead of `k` comparisons.

The same `O(Nk)` bound shows up by a different route if the lists are merged one at a time with the two-list routine:

```python
result = None
for lst in lists:
    result = mergeTwoLists(result, lst)
```

After `i` merges the accumulated list holds the nodes from the first `i` lists, so the next merge walks all of them again. With `k` equal lists of `N/k` nodes the total is `(N/k)(2 + 3 + … + k)`, which is about `Nk/2`. Every node is re-walked in every later merge, so the repetition is in the nodes, not in the comparisons of heads. Merging in a balanced order — pair the lists, then pair the results, for `log k` levels — touches all `N` nodes once per level and brings the total to `O(N log k)`. The logarithm is the number of balanced levels; the heap reaches the same bound through the size of the heap instead.

Counting the push and the pop for every node, the heap does about `2N log2 k` comparisons against the scan's `Nk`, so the ratio is `k / (2 log2 k)`. It is close to 1 for eight lists, about 5 for sixty-four, and about 50 for a thousand. With `N = 10,000` nodes and `k = 64` that is roughly 640,000 comparisons for the scan and 120,000 for the heap. The heap's comparisons are individually more expensive than a single array compare, which is why the scan is competitive for two or three lists, but the `k` factor is what wins as the number of lists grows.

## Appending, not inserting

Always taking the global smallest has a second benefit, which is what keeps the output building simple. Every popped node is at least as large as everything already appended, so it can always go on the end. Taking them out of order would mean inserting a later node into the middle of the result, which is exactly the expensive operation the heap removes. The output is a merge, not an insertion sort.

## The heap holds one node per list

At the start the heap contains the head of every non-empty list. When a node is popped, its successor becomes that list's new head and is pushed. The heap therefore never holds more than one node per list, so its size is bounded by `k`, not by the total number of nodes.

This also answers a question that is easy to get stuck on: where does the next candidate come from? It comes from the node that was just popped. The tuple carries the node itself, so `node.next` is the next thing to offer from that list. There is no need to remember which list a node belongs to, or to walk the lists in parallel.

## The tuple

```python
(node.val, counter, node)
```

The first element is what the heap orders by: the value. The third is the payload, used to append the node and to reach its successor.

The middle element is Python-specific. Tuple comparison is lexicographic, so when two values are equal it moves on to the second element. `ListNode` has no ordering, so a tuple of `(value, node)` with equal values raises `TypeError: '<' not supported between instances of 'ListNode' and 'ListNode'`. A unique counter as the second element means the heap never has to compare two nodes.

The shape generalises beyond this problem, and the choice of middle value has consequences for tie order; both are worked out in [heap tuples: priority, tiebreaker, payload](../techniques/heap-tuples.md).

## The code

```python
import heapq


class Solution:
    def mergeKLists(self, lists: list[ListNode | None]) -> ListNode | None:
        min_heap: list[tuple[int, int, ListNode]] = []
        counter = 0

        # One node per list: its current head. Skipping None keeps the
        # heap from ever holding a placeholder.
        for node in lists:
            if node:
                heapq.heappush(min_heap, (node.val, counter, node))
                counter += 1

        dummy = ListNode(0)
        tail = dummy

        while min_heap:
            _, _, node = heapq.heappop(min_heap)   # smallest of the k heads

            tail.next = node
            tail = tail.next                       # forgetting this loses the list

            # The popped node's successor is the next candidate from
            # that list. A parallel array of per-list pointers is not needed.
            if node.next:
                heapq.heappush(min_heap, (node.next.val, counter, node.next))
                counter += 1

        tail.next = None
        return dummy.next
```

## The trace

For `[[1, 4, 5], [1, 3, 4], [2, 6]]`, with `A`, `B`, `C` naming the lists:

```text
start          heap: 1(A) 1(B) 2(C)
pop 1(A)  append 1   push 4(A)   heap: 1(B) 2(C) 4(A)
pop 1(B)  append 1   push 3(B)   heap: 2(C) 3(B) 4(A)
pop 2(C)  append 2   push 6(C)   heap: 3(B) 4(A) 6(C)
pop 3(B)  append 3   push 4(B)   heap: 4(A) 4(B) 6(C)
pop 4(A)  append 4   push 5(A)   heap: 4(B) 5(A) 6(C)
pop 4(B)  append 4   no push     heap: 5(A) 6(C)
pop 5(A)  append 5   no push     heap: 6(C)
pop 6(C)  append 6   no push     heap: empty

result: 1 1 2 3 4 4 5 6
```

The tie at the two 4s is the case the counter exists for: both values are 4, so the heap compares the second element and pops the one pushed earlier. Any deterministic order is fine; the important part is that it never compares the nodes.

## The dummy node

`dummy` exists for the same reason as in the two-list merge: the first append is not special. Without it, the first node would have to initialise the result head and every later node would be an append, so the loop would carry a branch that only runs once. With it, every node is appended the same way and the answer is `dummy.next`.

`tail` is the cursor: it always points at the last node of the merged list. Forgetting `tail = tail.next` means every append overwrites `dummy.next`, and because this version also ends with `tail.next = None`, the result is an empty list rather than a truncated one. Without that final cut it would return only the last node. The failure is loud only if the test has one node; with the cut it is empty, which is at least easy to notice.

The final `tail.next = None` is not strictly necessary in the correct version. The last node popped has no successor, because a successor would have been pushed and would still be in the heap. The cut is harmless and documents the end of the list, but the invariant already guarantees it.

## The counter

What matters is that every pushed tuple gets a distinct counter. The code increments after each push, which is fine; incrementing before the push is equally fine, and so is incrementing outside the `if` (it would skip numbers without hurting uniqueness). What is not fine is deriving the counter from the value, for example incrementing only when `node.val` changes: equal values from different lists would share a counter, the tuple would fall through to comparing nodes, and the `TypeError` would be back.

Two other unique second elements work. The list's index is unique among the entries in the heap, because at most one node per list is ever present, so `(node.val, list_index, node)` is enough. `itertools.count()` produces the same kind of unique value as the manual counter with less bookkeeping.

## Cost

There are `N` nodes in total and `k` lists. Building the heap costs `O(k log k)`, and every node is pushed once and popped once, with each operation `O(log k)`. The total is `O(N log k)` time and `O(k)` space for the heap, since the output reuses the input nodes.

The scan and the sequential pairwise merge are accounted for in the comparison above, and both are `O(Nk)`. Sorting every value is the other baseline: `O(N log N)`, and it ignores the fact that each list is already ordered; it also needs new nodes if the result must reuse the originals. The balanced pairwise merge is also `O(N log k)`, with a smaller constant because it runs the tight two-list loop rather than allocating and comparing heap tuples, so in practice it is often faster even though the heap version is shorter. The heap keeps `O(k)` state and fits naturally when the lists arrive incrementally or when the candidates are not conveniently stored in an array.

## Edge cases

No lists returns `None`, and a list of only empty lists does the same, because nothing is pushed. A single non-empty list is returned in its own order: every pop pushes its successor, so the heap always has exactly one candidate.

Duplicate values across lists are the normal case, handled by the counter. Negative values work because the heap orders by value, not by any index. The total node count can be large while `k` is small, which is exactly where the `log k` pays off; when `k` is close to `N` the bound degrades to `O(N log N)`, the same as sorting.

## Mistakes

A tuple of `(value, node)` works until two values tie, then raises `TypeError` because nodes have no ordering. The counter is not optional.

Forgetting `tail = tail.next` rebuilds the list at `dummy.next` every time; with the final cut the result is empty, without it only the last node survives.

Storing values instead of nodes means the successor cannot be found from the popped entry, so the list it came from is lost. Storing the node but forgetting to push `node.next` drops the rest of that list silently.

A counter based on the value rather than the push collides on duplicates. A heap built from bare nodes, or from `(value, node)` pairs, hits the same ordering problem in a different place.

## To remember

The heap holds the smallest unmerged node of each list, one per list, so its size is `k`. Pop the minimum, append it, and push its successor; the successor is the only new candidate, which is why no per-list pointer array is needed. The counter is there to keep Python from comparing nodes when values tie. The total is `O(N log k)`, and the output is built by appending because every popped node is at least as large as the last one placed.
