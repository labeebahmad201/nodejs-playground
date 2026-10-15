import { timingSafeEqual } from "node:crypto";

// Naive compare: bails at the FIRST differing byte, so the time depends on how
// many leading bytes match. That difference is the side channel.
function naiveEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false; // early exit leaks the position
  }
  return true;
}

// Safe compare: touches every byte, so the time is independent of the values.
function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false; // length check first (it throws otherwise)
  return timingSafeEqual(a, b);
}

const SECRET = Buffer.from("correct-horse-battery-staple");

// Average time (ns) to compare SECRET against a guess sharing `sharedPrefix`
// leading bytes (and differing right after).
function bench(
  compare: (a: Uint8Array, b: Uint8Array) => boolean,
  sharedPrefix: number,
  trials: number,
): number {
  const guess = Buffer.alloc(SECRET.length);
  for (let i = 0; i < sharedPrefix; i++) guess[i] = SECRET[i];
  guess[sharedPrefix] = SECRET[sharedPrefix] ^ 0xff; // first byte that differs

  const start = process.hrtime.bigint();
  for (let t = 0; t < trials; t++) compare(SECRET, guess);
  const end = process.hrtime.bigint();
  return Number(end - start) / trials;
}

const TRIALS = 2_000_000;
const prefixLengths = [0, 5, 10, 20, SECRET.length - 1];

console.log(`secret = ${SECRET.length} bytes, ${TRIALS.toLocaleString()} trials each\n`);
console.log("shared prefix |   naive (ns) |   safe (ns)");
console.log("--------------|--------------|------------");

for (const n of prefixLengths) {
  const naive = bench(naiveEqual, n, TRIALS);
  const safe = bench(safeEqual, n, TRIALS);
  console.log(
    `${String(n).padStart(13)} | ${naive.toFixed(1).padStart(12)} | ${safe.toFixed(1).padStart(11)}`,
  );
}

console.log(`
What to look for:
- "naive" time RISES as more leading bytes match (it does more work before bailing)
  -> an attacker can read that off and guess the secret byte by byte.
- "safe" time stays FLAT -> reveals nothing.
Timing is noisy; run it a few times.`);
