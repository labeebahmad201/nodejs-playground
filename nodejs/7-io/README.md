# 7. I/O — input and output

Every program does two things with the outside world: it takes data **in** and sends
data **out**. That exchange is **I/O** (input/output). This example makes both
directions concrete and ties them back to the event loop.

## What "input" and "output" mean

Cited definitions, broad → program-level:

- **Wikipedia** — "input/output (I/O) is the communication between an information
  processing system ... and the outside world ... Inputs are the signals or data
  received by the system and outputs are the signals or data sent from it." It also
  notes: "The designation of a device as either input or output depends on
  perspective."
  <https://en.wikipedia.org/wiki/Input_and_output>
- **IBM (z/OS Basic Skills)** — "Transmission of data from a data set to a program is
  called input. Transmission of data from a program to a data set is called output."
  <https://www.ibm.com/docs/en/zos-basic-skills?topic=language-input-output>
- **NIST CSRC Glossary** — "A general term for the equipment that is used to
  communicate with a computer as well as the data involved in the communications."
  (source: NIST SP 800-82r3)
  <https://csrc.nist.gov/glossary/term/input_output>
- **Yale (Aspnes, OS notes)** — the I/O subsystem "interfaces with input/output
  devices"; "Most I/O operations at the hardware level are asynchronous — this is
  good, because I/O is slow."
  <https://www.cs.yale.edu/homes/aspnes/pinewiki/InputOutput.html>

So, from **your process's** point of view:

| | direction | Node examples |
|---|---|---|
| **input** | data **into** the process | `readFile`, `fetch` response, socket data, stdin, DNS result |
| **output** | data **out of** the process | `writeFile`, `fetch` request, socket write, stdout |

Because the label depends on perspective, one transfer can be output for one side and
input for the other: when you `readFile`, the disk *outputs* bytes that your process
*inputs*. That symmetry is why it's called "I/O", not just "input".

## What makes something "I/O"

Not the file or the socket itself — the fact that the work is **handed off**:

1. Your JS asks the OS (or libuv's threadpool) to do the transfer.
2. Your JS thread **doesn't wait**; it returns to the event loop.
3. When the data is ready, a callback is queued and runs in the **poll phase**
   (see `5-event-loop`).

In-memory work (`JSON.parse`, sorting an array) is **not** I/O: it runs on the JS
thread and blocks the loop until it finishes. That distinction — I/O-bound vs
CPU-bound — drives most Node performance decisions.

## Common misconception: I and O don't happen together

A natural first guess is that "input/output" describes a single simultaneous exchange —
data goes in *and* out at the same moment. It doesn't. **"I/O" names a category, not one
event.** The "and" is a list of two directions, not a coupling.

- **Unidirectional operations** are one direction only: `readFile` is input only,
  `writeFile` is output only. Both are still "I/O" because both are how your process
  talks to the outside world — not because they happen together.
- **Bidirectional operations** (`fetch`, a DB query, a socket) do both, but the two
  directions are **separate events at separate times**: you send the request (output),
  and *later* the response arrives (input) as its own callback, in its own loop
  iteration. A completed write does not mean the read is ready.
- **Full-duplex** is the one case where they overlap: a TCP socket can send and receive
  *concurrently*. Even then they're two independent channels with separate buffers and
  separate events.

So think of **I and O as two directions across one boundary** — data crossing *into* the
process and data crossing *out*. Each crossing is its own event, on its own schedule.

## Node modules that do I/O

- `fs` — files · `net` — TCP/Unix sockets · `http`/`https`/`http2` — web · `dgram` —
  UDP · `dns` — name resolution · `child_process` · `zlib` · `crypto` (async ops).
- `net`/`http`/`dgram` use the OS event queue; `fs`/`dns`/`zlib`/`crypto` use libuv's
  threadpool. Both surface as poll-phase callbacks.

## Run it

```sh
node index.ts
```

## Output

```
input:  read ~1310 bytes from /.../7-io/index.ts
output: wrote ~10 bytes to /var/folders/.../nodejs-playground-io.txt
output: wrote this line to stdout
```

The input byte count is just the size of this `index.ts` (so it shifts as the file
changes); the output path is in the OS temp dir and the file is removed again at the end.

## Blocking vs non-blocking I/O

Node offers two flavors of the same operation:

- **Non-blocking (async)** — `fs.promises.readFile`, `fs.readFile`, streams. Hands the
  work off; the loop stays free. This is the Node default.
- **Blocking (sync)** — `fs.readFileSync`, `fs.writeFileSync`. Runs on the JS thread and
  **stalls the whole loop** until it finishes. Fine at startup or in scripts; never in a
  hot request path.

The sync variants aren't "not I/O" — they're the same transfer done the slow way, from
the event loop's point of view.

## References

- Wikipedia, *Input/output* — <https://en.wikipedia.org/wiki/Input_and_output>
- IBM, *Input and output* (z/OS Basic Skills) —
  <https://www.ibm.com/docs/en/zos-basic-skills?topic=language-input-output>
- NIST CSRC, *Input/Output (I/O)* — <https://csrc.nist.gov/glossary/term/input_output>
- Yale CS, Aspnes, *InputOutput* —
  <https://www.cs.yale.edu/homes/aspnes/pinewiki/InputOutput.html>
