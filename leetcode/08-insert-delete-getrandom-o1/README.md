# Insert Delete GetRandom O(1): The Set That Keeps an Index

*A set gives constant-time membership but no index. A list gives an index but linear-time deletion. The trick is to keep both: the list supplies random access, and a map supplies each value's index so deletion can swap the last element into the hole.*

Part of the [`leetcode/`](../) section.

---

## The problem

Design a `RandomizedSet` that supports three operations, all in **average O(1)** time:

- `insert(val)`: add `val` if it is not present. Return `true` if it was inserted, `false` if it was already there.
- `remove(val)`: remove `val` if it is present. Return `true` if it was removed, `false` if it was not there.
- `getRandom()`: return a uniformly random element. Every element currently in the set must have the same probability.

```text
RandomizedSet()
insert(1)   → true
remove(2)   → false
insert(1)   → false
getRandom() → 1
remove(1)   → true
insert(2)   → true
getRandom() → 2
```

## Why a set or a list alone is not enough

| Structure | `insert` | `remove` | `getRandom` |
| --- | --- | --- | --- |
| Hash set | O(1) | O(1) | no index; converting to a list is O(n) |
| List | O(1) append | O(n) to find and remove | O(1) |
| List + index map | O(1) | O(1) | O(1) |

A set answers "is this value present?" but not "which position is it in?" Random selection needs an
index, because the random functions produce integers, not set elements. A list gives indices, but
removing from the middle shifts every later element, which is O(n).

The map bridges the two. It stores `value → index`, so the list can hold the values and the map can
say where each one lives. With that information, removal can move the last element into the vacated
slot instead of shifting everything left.

## Two paths: mutation and read

`insert` and `remove` are mutations: they change the set, so every structure that describes the set
has to be updated. `getRandom` is a read: it changes nothing, but it needs uniform access by
position.

The two paths have different requirements:

| Path | Operations | Needs | Natural structure |
| --- | --- | --- | --- |
| Mutation | `insert`, `remove` | O(1) membership and O(1) update | hash map |
| Read | `getRandom` | O(1) uniform index | dense array |

A single structure tends to satisfy one path and fail the other. A set is excellent for mutations
and has no index for the read. A list is excellent for the read and has O(n) arbitrary deletion for
the mutation. The challenge is not any one operation; it is reconciling the two paths in one data
structure.

The solution is to keep one structure per path and a small map to keep them consistent:

- The list is the read structure: dense, indexable, uniform.
- The map is the mutation index: O(1) value → index, so a deletion can find the slot and repair the
  list.
- `insert` and `remove` update both; `getRandom` touches only the list.

The swap-with-last trick is where the paths meet. It lets the mutation path delete an arbitrary
value using only O(1) operations at the end of the read structure, preserving the density that
makes the read path uniform.

## The design

Keep two structures:

- `values`: a list of the current values. This is what `getRandom` samples from.
- `index_of`: a dictionary mapping each value to its index in `values`.

The invariant is:

```text
values[index_of[v]] == v          for every value v in the set
len(values) == len(index_of)
```

Every value appears exactly once in `values`, and the map and list always agree about its index.

```text
values:    [10, 20, 30, 40]
indices:     0   1   2   3
index_of:  {10: 0, 20: 1, 30: 2, 40: 3}
```

`insert` is the easy one: if the value is already in the map, return `false`; otherwise record its
new index, append it, and return `true`. The new index is `len(values)` before the append.

`getRandom` is the reason the list exists: pick an index in `[0, len(values) - 1]` and return the
value there. Because every distinct value occupies exactly one index, each value has probability
`1 / n`.

`remove` is the hard one, and it is where the swap-with-last trick lives.

## The removal trick

To remove a value:

1. Look up its index in `index_of`.
2. Pop the last element from `values`. This is O(1).
3. If the value being removed was not the last element, write that popped last element into the
   removed value's slot, and update its index in the map.
4. Delete the removed value's key from the map.

Why bring the last element forward? Because deleting from the middle of a list shifts every
subsequent element, which is O(n). The list is unordered, so the only requirement is that every
value sits at the index the map claims. Moving the last element into the hole preserves that
invariant without shifting anything.

```text
start:  values = [10, 20, 30, 40]
        index_of = {10: 0, 20: 1, 30: 2, 40: 3}

remove(20):
  index = 1
  last = pop() = 40          values = [10, 20, 30]
  1 < 3 → values[1] = 40     values = [10, 40, 30]
           index_of[40] = 1
  del index_of[20]           index_of = {10: 0, 40: 1, 30: 2}
```

Now `40` sits where `20` used to be, and its map entry says `1`. The removed value is gone from
both structures.

### The last-element guard

There is one edge case: removing the last element. After `pop()`, the list is one shorter, so the
removed index equals the new length. Writing the popped element back to that index would be out of
range.

```text
remove(30) from [10, 40, 30]:
  index = 2
  last = pop() = 30          values = [10, 40]
  2 < 2 is false             no move: there is no hole to fill
  del index_of[30]           index_of = {10: 0, 40: 1}
```

The guard `if index < len(values)` means "the removed element was not the last one." If it was the
last, the pop already removed it, and there is nothing to copy back. Only the map entry needs to be
deleted.

## The code

```python
import random


class RandomizedSet:
    def __init__(self):
        self.index_of = {}
        self.values = []

    def insert(self, val: int) -> bool:
        if val in self.index_of:
            return False

        self.index_of[val] = len(self.values)
        self.values.append(val)
        return True

    def remove(self, val: int) -> bool:
        if val not in self.index_of:
            return False

        index = self.index_of[val]
        last = self.values.pop()

        if index < len(self.values):
            self.values[index] = last
            self.index_of[last] = index

        del self.index_of[val]
        return True

    def getRandom(self) -> int:
        index = random.randrange(0, len(self.values))
        return self.values[index]
```

The names `index_of` and `values` are not accidental: the map is the value-to-index direction, and
the list is the index-to-value direction. Each operation uses the direction it needs.

## Why `getRandom` is uniform

`values` has no duplicates because `insert` only appends when the value is absent. Therefore each
distinct value occupies exactly one index.

`random.randrange(0, n)` chooses each integer from `0` to `n - 1` with equal probability. Since
each index holds exactly one distinct value, each value is chosen with probability `1 / n`.

The order of `values` changes when elements are removed and the last element is moved, but the list
is still a permutation of the set. Uniformity is about distinct values, not about preserving the
original insertion order.

If the list were allowed to contain duplicates, uniform index selection would over-weight the
duplicated values. The map check in `insert` is what prevents that.

## Is `insert` idempotent?

`insert` returns `true` the first time and `false` the second time for the same value. The return
value depends on outside state, which can look odd.

The state transition is idempotent: calling `insert(v)` twice leaves the set exactly as it was after
the first call. The return value is not idempotent, because it reports whether the operation
*changed* the state:

- First call: `v` was absent, so the set changes and the result is `true`.
- Second call: `v` is already present, so the set does not change and the result is `false`.

The boolean answers "did this call insert the value?" not "is the value present now?" That is a
deliberate API contract. `remove` has the same shape: `true` the first time, `false` the second,
with the set unchanged after the second call.

## Small traps

- **`dict` has no `remove` method.** `set.remove` exists, which makes `self.index_of.remove(val)`
  an easy mistake. For a dictionary, use `del self.index_of[val]` or `self.index_of.pop(val)`.
- **`list.pop(index)` is not O(1) for an arbitrary index.** Only `pop()` from the end is O(1). The
  whole design avoids an arbitrary-index pop.
- **`randrange(0, len)` is correct.** The stop value is exclusive, so it returns `0` through
  `len - 1`, exactly the valid indices. Passing `len + 1` would sometimes return an out-of-range
  index. `randint(0, len - 1)` is also correct, but easier to get wrong.
- **`getRandom` assumes a non-empty set.** The problem guarantees at least one element when
  `getRandom` is called. Without that guarantee, `randrange(0, 0)` would raise `ValueError`.
- **Update the moved element's index.** After moving the last element into the hole, the map must
  say where it now lives. Forgetting that update corrupts the next removal.
- **Delete the removed value's key.** The map entry for the removed value is what makes future
  `insert` calls report `false` incorrectly if it is left behind.

## Complexity

| Operation | Time | Why |
| --- | --- | --- |
| `insert` | O(1) average | dictionary lookup and assignment, list append |
| `remove` | O(1) average | dictionary lookup and delete, list pop from the end, one index assignment |
| `getRandom` | O(1) | `randrange` and list indexing |

Space is **O(n)**: the list holds `n` values and the map holds `n` entries.

The hash operations are average O(1); list append and `pop()` from the end are amortized O(1).
Removal is O(1) precisely because it pops the last element and overwrites one slot. If it used
`list.remove(val)` or `del list[index]`, it would be O(n) because of the search or the shift.

For contrast:

| Approach | `insert` | `remove` | `getRandom` |
| --- | --- | --- | --- |
| Set only | O(1) | O(1) | O(n) to convert to a sequence |
| List only | O(1) | O(n) | O(1) |
| List + index map | O(1) | O(1) | O(1) |

## What generalizes

- **Swap-with-last deletion.** When order does not matter, an array element can be deleted in O(1)
  by moving the last element into its place. The price is that the order changes, which is fine
  here because randomness does not care about order.
- **Two structures, two directions.** The list maps index → value; the map maps value → index. Each
  operation uses the direction it needs. This "dense array plus index map" pattern also appears in
  sparse sets and random-sampling structures.
- **Separate the read path from the mutation path.** When one representation makes writes cheap and
  another makes reads cheap, keep both and synchronize them with a small index. This is the
  data-structure version of a read-model/write-model split.
- **Uniform sampling needs a dense, duplicate-free array.** Random index selection is uniform over
  values only if each distinct value appears exactly once. If duplicates are allowed (LeetCode 381),
  the map must store a set of indices per value, and sampling has to account for frequencies.
- **Idempotent state, non-idempotent report.** `insert` and `remove` can be idempotent as state
  transitions while their booleans report whether the state changed. That is an API design point,
  not a contradiction.
- **Choose the structure for the hardest operation.** A set handles membership and a list handles
  random access; the map patches the list's weakness. The operation that constrains the design —
  random access — is the one that forces the list to exist.

## The takeaway

- A set has membership but no index; a list has an index but O(n) middle deletion.
- Mutations and reads have different needs: the map serves mutation, the list serves the read.
- Keep both: `values` for random access, `index_of` for value → index.
- Remove by swapping the last element into the hole, updating its index, then deleting the key.
- Guard the last-element case: after `pop()`, `index == len(values)` means there is no hole to fill.
- O(1) average for all three operations, O(n) space.
- `insert` is idempotent on state, but its boolean reports whether the state changed.
