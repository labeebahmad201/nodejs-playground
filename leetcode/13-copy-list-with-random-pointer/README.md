# Copy List with Random Pointer

*A deep copy sounds like a loop that creates nodes. Then you reach a node whose `random` points at a node you have not copied yet, and the simple loop falls apart. The fix is to stop trying to finish each node in one go: build every copy first, then connect the randoms.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻ The idea is small; the mistakes are subtle and all of them produce output that looks right if you only print values.

---

## The problem

Each node has a value, a `next`, and a `random` that points at any node in the list or at `None`. Return a **deep copy**.

```text
index:    0      1      2      3      4
value:    7  →  13  →  11  →  10  →   1
random:  None    0      4      2      0
```

Read the `random` row as indices:

- `13` points at `7`
- `11` points at `1`
- `10` points at `11`
- `1` points at `7`

"Deep" means two separate things:

1. Every node in the result is a **new object**, not one from the input.
2. Every pointer in the result points at a **new node** — including `random`.

A copy that gets the values and `next` right but points `random` into the original list is not a copy. It is a second view of the same graph, and mutating one changes the other.

## The trap: it looks like a one-pass copy

The first instinct is reasonable:

```python
copy = Node(curr.val)
copy.next = ...      # the next node, when we get there
copy.random = ...    # the node curr.random points to
```

Then you start walking and hit `11`:

```text
copying index 2 (value 11)
its random is index 4 (value 1)

index 4 has not been created yet.
```

There is nothing to point at. You only have two nodes so far.

Now the rabbit hole opens. You could jump ahead and create node 4 now. But node 4's `random` points at node 0, and its `next` is `None`, and now your "simple loop" is a recursive graph walk with no record of which nodes you have already built. With a cycle, it never ends. With duplicates, you cannot even tell which node you meant.

That is the actual difficulty of this problem: **a node's `random` can point at a node that does not exist yet.** The pointer is the problem, not the value.

## The way out: separate creating from connecting

Do not finish a node before moving on. Do the work in two passes:

1. **Create** a copy of every node, in order, and chain the copies with `next`. Store `original → copy` in a map as you go.
2. **Connect** the randoms. By now every original has a copy, so each lookup succeeds.

`next` is safe in pass 1 because it always points at the following node: by the time you finish copying `i`, you are about to copy `i + 1`, and the chain is already there. `random` is the only pointer that needs the waiting period.

The map turns "which copy is this original?" into a lookup:

```text
original → copy
   7     →    7'
  13     →   13'
  11     →   11'
  10     →   10'
   1     →    1'
```

Pass 2 becomes one line per node:

```python
copy_curr.random = original_to_copy[curr.random]
```

That single line is the whole solution, once the map exists.

## Why the key is the node, not the value

The map has to answer: **given this original node, which copy belongs to it?**

Values cannot answer that, because values are not unique. The list may contain two nodes with value `3`, and they may have different random targets:

```text
index:    0      1
value:    3  →   3
random:   1      None
```

With a value-keyed map, the second `3` overwrites the first:

```python
copy_by_value[3] = copy_of_index_0
copy_by_value[3] = copy_of_index_1   # index 0 is now unreachable
```

Both randoms would resolve to the same copy, and the structure would be wrong while the values still look perfect.

Python uses object identity for hashing by default (as long as the class does not define `__eq__`/`__hash__`), so `original_to_copy[curr]` compares *this exact node*. That is the only notion of "same node" that survives duplicates.

## Walking through the example

Pass 1 builds the chain and the map:

| Step | Original | Copy created | Map entry |
| --- | --- | --- | --- |
| 1 | 7 | 7' | `7 → 7'` |
| 2 | 13 | 13' | `13 → 13'` |
| 3 | 11 | 11' | `11 → 11'` |
| 4 | 10 | 10' | `10 → 10'` |
| 5 | 1 | 1' | `1 → 1'` |

Pass 2 sets each random:

| Original | Original `random` | Map lookup | Copy's `random` |
| --- | --- | --- | --- |
| 7 | `None` | — | stays `None` |
| 13 | 7 | `7'` | `7'` |
| 11 | 1 | `1'` | `1'` |
| 10 | 11 | `11'` | `11'` |
| 1 | 7 | `7'` | `7'` |

Notice that every lookup returns a **new** node. That is what makes the copy deep.

## The code

```python
class Solution:
    def copyRandomList(self, head: "Optional[Node]") -> "Optional[Node]":
        # Pass 1: copy the values and chain `next` in one walk.
        dummy = tail = Node(0)
        original_to_copy = {}

        curr = head
        while curr:
            tail.next = Node(curr.val)          # value only; pointers come later
            original_to_copy[curr] = tail.next  # key: the node object
            tail = tail.next
            curr = curr.next

        # Pass 2: every copy exists, so every random can be wired.
        curr = head
        copy_curr = dummy.next
        while curr:
            if curr.random:
                copy_curr.random = original_to_copy[curr.random]
            curr = curr.next
            copy_curr = copy_curr.next

        return dummy.next
```

The dummy/tail pair is the same idea as [merging two lists](../12-merge-two-sorted-lists): `dummy` holds the head so the first append is not a special case, and `tail` is where the next node goes.

`else: copy_curr.random = None` is unnecessary — `Node(curr.val)` already leaves `random` as `None`.

## The mistakes

### 1. Copying the original's pointers

```python
tail.next = Node(curr.val, curr.next, curr.random)   # wrong
```

This makes a new node that points at the **old** graph:

```text
copy7 → original 13 → original 11 → ...
            ↑ the "copy" is now a view of the input
```

Two consequences:

- Mutating `copy7.next.val` mutates the original list.
- The deep-copy promise is broken even though every value looks correct.

Only the value belongs in the new node during pass 1. Pointers are wired when their targets exist.

### 2. Looking up the current node instead of its random

```python
copy_curr.random = original_to_copy[curr]            # wrong
copy_curr.random = original_to_copy[curr.random]     # right
```

The first line asks "what is the copy of me?" and stores it as my `random`. Every node ends up pointing at itself:

```text
copy13.random → copy13
copy11.random → copy11
```

The values and `next` chain still look perfect. Only a random-pointer check reveals it.

### 3. Keying the map by value

```python
original_to_copy[curr.val] = tail.next               # fragile
```

With `[3, 3]`, the second copy overwrites the first entry, so both randoms resolve to one node. The input had two distinct nodes; the output has one shared one.

### 4. Checking only the `next` chain

A test that walks `next` and compares values passes for all three bugs above. When verifying a copy, compare the random structure **and** check that no node in the output is the same object as a node in the input.

## The O(1)-space alternative

There is a trick that avoids the dictionary by weaving the copies into the original list:

```text
before:  A → B → C
after:   A → A' → B → B' → C → C'
```

1. Walk the list and insert each copy directly after its original.
2. For each original, `original.next.random = original.random.next` (when `random` is not `None`).
3. Split the woven list into the original and the copy.

Step 2 works because the copy of any node is always `original.next` — so the copy of `random` is `random.next`.

It is O(1) extra space, but it mutates the input while running and the split at the end is easy to get wrong. The map version is the one to reach for first.

## A lazy single-pass version

Instead of two passes, create copies on demand and memoize:

```python
def clone(node):
    if node is None:
        return None
    if node in seen:
        return seen[node]

    copy = Node(node.val)
    seen[node] = copy          # store before recursing, or cycles never end

    copy.next = clone(node.next)
    copy.random = clone(node.random)
    return copy
```

Short and correct, at the cost of O(n) stack space. The important line is `seen[node] = copy` **before** the recursive calls: a `random` pointing back into the list would otherwise recurse forever.

## Speed

- **Time:** O(n) — each node is visited a constant number of times.
- **Space:** O(n) for the map (or the recursion). The weave version is O(1) extra.

## Edge cases

| Case | What happens |
| --- | --- |
| `[]` | return `None` |
| One node whose `random` is itself | copy's `random` points at the copy |
| Every `random` is `None` | the map is still built; pass 2 does nothing |
| Duplicate values | fine, because the key is the node |
| `random` points backwards | fine, because pass 1 already created every copy |
| `random` points forwards | the case that breaks a one-pass solution |
| A large list | O(n) map memory; the weave trades it for mutation |

## Revision checklist

- [ ] Say why a node's `random` can point at a node that does not exist yet.
- [ ] Explain why `next` does not have the same problem.
- [ ] Say why the map is keyed by the object, not the value.
- [ ] Show what `map[curr]` does to every node's `random`.
- [ ] Show what `Node(val, curr.next, curr.random)` shares with the input.
- [ ] Trace the five-node example through both passes.
- [ ] Describe the weave version's three steps.
- [ ] Say why copying only `next` is not a deep copy.

## The short version

- A `random` pointer can point at a node that has not been copied yet, so one pass cannot finish a node.
- Pass 1: copy values, chain `next`, and record `original → copy` with the node as the key.
- Pass 2: `copy.random = map[original.random]`.
- The key is the object because values repeat; the map lookup is what keeps the copy from pointing back into the original.
- Return `dummy.next`.
