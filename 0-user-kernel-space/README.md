# 0. User space vs kernel space — they only talk through syscalls

Your program and the OS do **not** share memory or call each other's functions. They sit on
opposite sides of a hard boundary and communicate **only through system calls**. Everything
in Node that touches the outside world — files, sockets, clocks, threads, memory — is a
syscall crossing that boundary. This dir documents just that, because it explains *why* fds,
sockets, limits and "the kernel" keep showing up in every other topic.

## The two spaces

- **User space** — unprivileged. Your JavaScript, Node's core modules, V8, libuv, and any
  native addons all live here. Code here **cannot** touch hardware, other processes' memory,
  or kernel data directly.
- **Kernel space** — privileged. The kernel (scheduler, memory management, filesystems,
  network stack, device drivers) runs here with full access to the machine.

The CPU itself enforces the split with a **privilege level** (user mode vs kernel mode). User
mode can't execute privileged instructions; the only way to ask for privileged work is a
**controlled entry point**: a system call.

```
        USER SPACE (unprivileged)                    KERNEL SPACE (privileged)
   ┌───────────────────────────────┐          ┌──────────────────────────────────────┐
   │ JS · Node core · V8 · libuv   │          │ scheduler · memory · VFS · net ·     │
   │ your process (fds, memory)    │          │ drivers · per-process fd table        │
   └───────────────┬───────────────┘          └───────────────────┬──────────────────┘
                   │                                              │
                   └────────►  SYSTEM CALL (trap)  ◄──────────────┘
                        the ONLY crossing; CPU switches to kernel
                        mode, runs the request, returns a result
```

## What a syscall actually is

A syscall is a **deliberate trap into the kernel**, not a function call into shared code:

1. User code puts a **syscall number** and arguments in CPU registers (or on the stack).
2. It executes a special instruction (`syscall` on x86-64, `svc` on ARM, `int 0x80` on old
   x86). The CPU switches to **kernel mode** and jumps to a fixed kernel entry point.
3. The kernel **validates** the request (are these arguments legal? does this process have
   permission?), performs it, and puts a result (or an error like `errno`) back.
4. The CPU switches back to **user mode** and the call returns.

That mode switch is why syscalls have real cost — and why "reduce syscalls" is a real
optimization. User code **never** jumps into arbitrary kernel code; it can only name one of
the ~300+ numbered operations the kernel chooses to expose.

## Node lives entirely in user space

Node is **not** privileged. Its whole stack — V8, libuv, the C++ core — is user space. When
your JS asks for I/O, the request travels down and eventually becomes a syscall:

```
your JS → Node core (JS) → Node C++ layer → libuv → libc → syscall → kernel
```

libuv doesn't bypass the boundary; it's a *user-space* wrapper that makes syscalls
non-blocking and multiplexed (`epoll`/`kqueue` are themselves syscalls).

## Every Node "outside world" operation is a syscall

| Node API | Syscall(s) it becomes |
|---|---|
| `fs.readFile` / `writeFile` | `open`, `read` / `write`, `close` |
| `net` / `http` sockets | `socket`, `bind`, `listen`, `accept`, `connect`, `sendto`/`recvfrom` |
| `new Worker` / threads | `clone` |
| memory allocation | `mmap`, `brk` |
| timers / event loop wait | `epoll_wait` / `kevent` / `nanosleep` |
| `process.memoryUsage()` | `read` of `/proc` (or syscalls) |
| `crypto` (random) | `getrandom` |

Two consequences you've already met:

- **fds exist** because the kernel object is on the other side; the fd is the user-space
  handle returned by `open`/`socket`/`accept`/`pipe`.
- **Limits exist** because the **kernel** enforces them (`RLIMIT_NOFILE`, cgroups, permissions).
  User space can only ask; the kernel decides.

## How to actually see the syscalls

```sh
# Linux: count/trace syscalls a Node program makes
strace -f -c node -e "require('fs').readFileSync('/etc/hosts')"
strace -f    node -e "require('fs').readFileSync('/etc/hosts')"   # full trace

# macOS (needs sudo): dtruss, or use `dtrace`
sudo dtruss -f node -e "require('fs').readFileSync('/etc/hosts')"
```

You'll see the boundary in action: `openat(...)`, `read(...)`, `write(...)`, `close(...)` —
each one a user→kernel crossing for a single JS call.

## One-line summary

**User space and kernel space are separated by CPU privilege and communicate only through
system calls; a syscall is a trap into the kernel, not a function call. Node is entirely user
space, and every file/socket/thread/memory operation is a syscall across that boundary.**

## References

- Linux `syscalls(2)` — the list of system calls — <https://man7.org/linux/man-pages/man2/syscalls.2.html>
- Linux `syscall(2)` — the syscall mechanism / ABI — <https://man7.org/linux/man-pages/man2/syscall.2.html>
- Linux `read(2)`, `write(2)`, `open(2)` — <https://man7.org/linux/man-pages/man2/read.2.html>
- OSTEP, *Operating Systems: Three Easy Pieces* (processes & system calls) —
  <https://pages.cs.wisc.edu/~remzi/OSTEP/>
- LWN, *Anatomy of a system call* — <https://lwn.net/Articles/604287/>
- Related: `10-request-lifecycle`, `13-sockets`
