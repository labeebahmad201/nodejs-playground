# Reversing Instead of Stacking

*Walking a singly linked list backwards looks like it needs a container: push the nodes on a stack and pop them in reverse. The container is optional. Reversing the list in place delivers the same order through the links, and trades the memory for mutation.*

Part of the [`leetcode/`](../) techniques.

> **Revisit later.** ↻

## The container version

```python
stack = []
curr = head
while curr:
    stack.append(curr)
    curr = curr.next

while stack:
    node = stack.pop()      # nodes arrive in reverse order
```

Two passes, `O(n)` time, `O(n)` space. The stack does not compute anything the links cannot: it exists only to remember an order that the list already contains.

## The same order from the links

Reverse the list, then walk it forward. The reverse order is now encoded in the `next` pointers, so the traversal itself runs backwards and no second structure is needed. The chain after each iteration of the reverse shows what is happening:

```text
start    1 → 2 → 3 → None
step 1   None ← 1   2 → 3
step 2   None ← 1 ← 2   3
step 3   None ← 1 ← 2 ← 3
```

The left part of each line is the reversed prefix; the right part is the untouched suffix. Each step moves one node across the gap. When the suffix is empty, the left part is the whole list, read from the right.

## The three pointers

```python
prev = None
curr = head
while curr:
    nxt = curr.next     # the only way forward
    curr.next = prev    # point the node backward
    prev = curr         # advance the new head
    curr = nxt          # advance the walker
return prev
```

The first line inside the loop is what makes the reverse possible: `curr.next` is both the link being overwritten and the only reference to the rest of the list, so it has to be saved before the overwrite. After the last iteration `curr` is `None` and `prev` is the old tail, which is the new head.

## The price is mutation

The stack leaves the list intact. Reversing does not. If the caller needs the original order after the traversal, reverse it again — another `O(n)` pass, still `O(1)` space — or use the stack. A palindrome check is the usual example: reverse the second half, compare inward, and restore only if the caller still needs the list.

A recursive reverse looks like it avoids the container, but the call stack **is** the container: one frame per node, so it costs `O(n)` memory just like the stack of nodes. The three-pointer loop is the version that actually saves the space.

## Where the trade pays

The reorder solution in [17-reorder-list](../17-reorder-list) needs the second half from the back. The array version indexes it from the right and pays `O(n)`; the constant-space version reverses the half and reads it forward. Palindrome checks do the same. Adding two numbers whose digits are stored most-significant first reverses both lists, adds left to right, then reverses the result. Any operation that walks from the end is a candidate, as long as the old order is disposable.

## When the stack is the better choice

Shared or immutable lists, concurrent readers, or code that must leave the input untouched without paying for a restore pass. If only the last `k` nodes are needed, a two-pointer gap reaches them in one pass without mutation and without `O(n)` storage, which beats both options.

## To remember

A stack buys reverse order with memory; a reverse buys it with mutation. If the order is disposable and the list is yours, reverse it: three pointers, one pass, no allocation.
