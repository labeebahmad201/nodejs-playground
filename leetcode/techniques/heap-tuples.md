# Heap Tuples: Priority, Tiebreaker, Payload

*`heapq` compares the items it stores, so a heap entry that ends in a node can crash the moment two priorities tie. The three-part tuple prevents that by placing a unique value between the priority and the payload, so the payload is never compared at all.*

Part of the [`leetcode/`](../) techniques.

> **Revisit later.** ↻

## The failure

`heapq` orders by `<`. A bare object with no ordering raises as soon as the heap has to compare two of them:

```python
heapq.heappush(heap, node_a)        # fine: nothing to compare against
heapq.heappush(heap, node_b)        # TypeError: node_a < node_b
```

Pairing the object with a priority fixes that while the priorities differ, because tuple comparison stops at the first unequal element:

```python
heapq.heappush(heap, (node.val, node))
```

The bug appears at a tie. With two nodes of equal value the first elements are equal, so Python moves on and compares the nodes:

```python
heapq.heappush(heap, (5, node_a))
heapq.heappush(heap, (5, node_b))
# TypeError: the values tie, so the comparison falls through to the nodes
```

The comparison can happen during a push, while the heap sifts the new entry up, or during a pop, while it sifts children down; it depends on where the equal pair sits. A one-entry heap accepts anything because nothing has been compared yet. That is why the failure looks intermittent when the tests happen to keep priorities distinct.

## The shape

```python
import heapq
import itertools

order = itertools.count()
heap = []

heapq.heappush(heap, (priority, next(order), payload))

priority, _, payload = heapq.heappop(heap)
```

The first element is what orders. The third is what you want back. The middle element exists to be compared when the first ties, and it is chosen so that no two entries in the heap share it.

## Uniqueness is the whole requirement

Tuple comparison is lexicographic, so the payload is reached only when the priority and the tiebreaker are both equal. A unique tiebreaker means that never happens. A constant tiebreaker such as `0` works exactly until two priorities tie, and then the entry is the bare `(priority, payload)` case again.

`itertools.count()` is the smallest source of unique values, and a manual counter does the same. The list index works in a k-way merge because at most one entry per list is in the heap, so the indices are distinct among the entries that can be compared.

## Stability comes along

`count()` increases with insertion order, so entries with equal priority pop in the order they were pushed. That is the stable, first-in-first-out order among equals, which is usually what a merge wants. A list index gives a different deterministic order, by list, which is fine when the tie order does not matter.

## The payload stays incomparable

Because the payload is never compared, it can be any object: a node, a dictionary, a function, a mixed tuple. It can even be mutated after the push, since the heap only ever looks at the first two fields. The priority and the tiebreaker are not safe to mutate; changing either breaks the order the heap was built on.

## The class alternative

When the payload wants methods, or when the same entry type is used throughout, a small class does the same job:

```python
from dataclasses import dataclass, field


@dataclass(order=True)
class Entry:
    priority: int
    item: object = field(compare=False)
```

`order=True` writes the comparison methods, and `compare=False` keeps `item` out of them, which is the three-part tuple expressed in the type. It is more code, but the fields document themselves.

## Where it shows up

The k-way merge in [18-merge-k-sorted-lists](../18-merge-k-sorted-lists) needs it because two lists can hold the same value. Dijkstra and best-first search need it because two frontier nodes can share a distance. Whenever the ordering key can repeat and the payload cannot be compared, the middle field is doing work.

## Mistakes

`(priority, payload)` passes every test in which the priorities happen to be distinct, then raises on the first tie.

A tiebreaker derived from the priority or the payload is not unique, which is the same failure in a different form.

Incrementing the counter only when a new value appears, or forgetting to increment on one of the push paths, leaves duplicates in the middle field.

`id(payload)` is unique, so it does prevent the crash, but the order among ties becomes arbitrary and irreproducible. Prefer a counter when the order matters.

Mutating the priority or the tiebreaker after the push corrupts the heap, because the order was fixed when the entry went in.

## To remember

Priority first, unique tiebreaker second, payload last. The tiebreaker is not decoration: it is what keeps the payload out of the comparison, and with `itertools.count()` it also gives ties a stable order.
