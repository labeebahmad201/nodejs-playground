# Copy List with Random Pointer

*A deep copy means every node is a new object and every pointer — `next` and `random` — points at the new nodes. The `random` pointer makes this a two-pass problem: when you create a node's copy, the node its `random` points to may not have a copy yet.*

Part of the [`leetcode/`](../) section.

> **Revisit later.** ↻ Two passes, one map keyed by node identity, and three mistakes that all produce a graph that looks right until you inspect it.

---

## The problem

Each node has a value, a `next`, and a `random` that can point at any node in the list or at `None`. Return a deep copy.

```text
index:    0      1      2      3      4
value:    7  →  13  →  11  →  10  →   1
random:  None    0      4      2      0
```

Two properties define "deep":

1. Every node in the result is a **new object**. No node is shared with the input.
2. The `random` pointers reproduce the same graph: `copyA.random` is the copy of `A.random`, not the original.

The second property is the one that separates a real copy from a shallow one that happens to look correct when printed.

## Why one pass is not enough

Suppose you are copying node `13` and its `random` points to node `7`. If you create the copy as `Node(13, ..., ...)`, what do you put in `random`?

- The original node `7`? Then the copy shares a node with the input, so it is not a copy.
- The copy of `7`? It may not exist yet — `7` comes earlier in this list, but `random` can point anywhere.

So the connection has to wait until every copy exists. That gives the two-pass shape:

1. **Create** a copy of every node, in order, and remember `original → copy`.
2. **Connect** the randoms using that map.

`next` is easy in the first pass because it always points forward: by the time you copy node `i`, you are about to copy `i + 1`, so you can chain as you go.

## The map is the trick

```text
original            copy
  7      ──────→    copy of 7
 13      ──────→    copy of 13
 11      ──────→    copy of 11
 10      ──────→    copy of 10
  1      ──────→    copy of 1
```

With that map, the second pass is one line per node:

```python
copy_curr.random = original_to_copy[curr.random]
```

Two things make the map work:

- **The key is the node object**, not its value.
- **The value is the copy**, so the lookup returns a new node, never an original.

## The code

```python
class Solution:
    def copyRandomList(self, head: "Optional[Node]") -> "Optional[Node]":
        # Pass 1: copy every value and chain the `next` pointers.
        dummy = tail = Node(0)
        original_to_copy = {}

        curr = head
        while curr:
            tail.next = Node(curr.val)
            # Key by the node itself: values may repeat.
            original_to_copy[curr] = tail.next
            tail = tail.next
            curr = curr.next

        # Pass 2: wire the randoms through the map.
        curr = head
        copy_curr = dummy.next
        while curr:
            if curr.random:
                # The copy of the random target, not the random target itself.
                copy_curr.random = original_to_copy[curr.random]
            curr = curr.next
            copy_curr = copy_curr.next

        return dummy.next
```

The `else` that sets `random = None` is unnecessary: `Node(curr.val)` already leaves it as `None`.

## The three mistakes

### 1. Copying the original's pointers

```python
tail.next = Node(curr.val, curr.next, curr.random)   # wrong
```

This creates a new node whose `next` and `random` point into the **original** list. The result is a hybrid: the first node is new, everything it reaches is old. Mutating the "copy" mutates the input, and the returned structure is not a copy at all.

Only the value belongs in the new node. The pointers are wired in a later pass, when the targets exist.

### 2. Looking up the current node instead of the random target

```python
copy_curr.random = original_to_copy[curr]            # wrong
copy_curr.random = original_to_copy[curr.random]     # right
```

The first line asks "what is the copy of me?" and assigns it to my `random`. Every node ends up pointing at itself — a list of self-loops that can look plausible if you only check that `random` is not `None`.

The map is a function from original to copy. Feed it the node you want the copy *of*: `curr.random`.

### 3. Keying the map by value

```python
original_to_copy[curr.val] = tail.next               # fragile
```

Values are not unique. With `[1, 1]`, both nodes share the key `1`, so the second copy overwrites the first and both randoms resolve to the same node. The input `[[1,1],[1,0]]` has two different `1`s pointing at different places, and a value-keyed map cannot tell them apart.

Python objects hash by identity by default, so `original_to_copy[curr]` uses exactly the right notion of "same node". This only holds while the class does not define value-based `__eq__`/`__hash__`; if it did, the map would need a different key.

## The O(1)-space alternative

A clever version weaves the copies into the original list and avoids the dictionary:

```text
before:  A → B → C
after:   A → A' → B → B' → C → C'
```

1. Walk the list and insert each copy right after its original.
2. For each original, `original.next.random = original.random.next` (when `random` is not `None`).
3. Split the woven list into the original and the copy.

The `random` lookup in step 2 is just "the node after the random target", which is why the weaving works. The cost: it mutates the input list while running and is much easier to get wrong at the tail. The hash-map version is the one to reach for first; this one is worth knowing for the O(1) space claim.

## A lazy single-pass version

Instead of two passes, create copies on demand and memoize:

```python
def clone(node):
    if node is None:
        return None
    if node in seen:
        return seen[node]

    copy = Node(node.val)
    seen[node] = copy          # store before recursing: the graph may cycle

    copy.next = clone(node.next)
    copy.random = clone(node.random)
    return copy
```

It is short and correct, and the memo has to be filled before the recursive calls so a `random` that points back into the list terminates. The cost is O(n) stack space.

## Speed

- **Time:** O(n) — each node is visited a constant number of times.
- **Space:** O(n) for the map (or the recursion). The weave version is O(1) extra.

## Edge cases

| Case | Result |
| --- | --- |
| `[]` | `None` |
| One node, `random` points to itself | copy's random points to the copy |
| Every `random` is `None` | plain copy of a singly linked list |
| Duplicate values | handled, because the key is the node |
| `random` points backwards | handled, because pass 1 already made every copy |

## Revision checklist

- [ ] Say why `random` forces a second pass or a memo.
- [ ] Explain why the map key is the object, not the value.
- [ ] Show what `original_to_copy[curr]` does to every node's `random`.
- [ ] Show what `Node(val, curr.next, curr.random)` shares with the input.
- [ ] Trace `[[7,null],[13,0],[11,4],[10,2],[1,0]]` through both passes.
- [ ] Describe the weave version's three steps in order.

## The short version

- Pass 1: copy values, chain `next`, and record `original → copy` keyed by the node object.
- Pass 2: `copy.random = map[original.random]`, or leave it `None`.
- Return `dummy.next`.
- Never put an original node's pointer into a copy, never key by value, and never look up the current node when you meant its random target.
