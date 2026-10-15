import {
  createHmac,
  timingSafeEqual,
  sign as cryptoSign,
  verify as cryptoVerify,
  generateKeyPairSync,
} from "node:crypto";
import type { KeyObject } from "node:crypto";

// ---- helpers ---------------------------------------------------------------

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString("base64url");

const fromB64url = (s: string): Buffer => Buffer.from(s, "base64url");

type Claims = Record<string, unknown> & { exp?: number; nbf?: number };

// ---- HS256: sign -----------------------------------------------------------

function signHs256(header: object, payload: object, secret: string): string {
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const input = `${h}.${p}`;
  const sig = createHmac("sha256", secret).update(input).digest();
  return `${input}.${b64url(sig)}`;
}

// ---- HS256: verify ---------------------------------------------------------

function verifyHs256(token: string, secret: string): Claims | null {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null; // malformed

  // 1. recompute the MAC over the exact signing input, compare constant-time
  const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest();
  const actual = fromB64url(s);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  const header = JSON.parse(fromB64url(h).toString()) as { alg?: string };
  if (header.alg !== "HS256") return null; // pin the algorithm

  // 2. validate the claims you rely on
  const claims = JSON.parse(fromB64url(p).toString()) as Claims;
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === "number" && now >= claims.exp) return null; // expired
  if (typeof claims.nbf === "number" && now < claims.nbf) return null; // too early
  return claims;
}

// ---- RS256: asymmetric sign / verify --------------------------------------

function signRs256(header: object, payload: object, key: KeyObject): string {
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = cryptoSign("sha256", Buffer.from(input), key);
  return `${input}.${b64url(sig)}`;
}

function verifyRs256(token: string, key: KeyObject): Claims | null {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  const ok = cryptoVerify("sha256", Buffer.from(`${h}.${p}`), key, fromB64url(s));
  if (!ok) return null;
  return JSON.parse(fromB64url(p).toString()) as Claims;
}

// ---- demo ------------------------------------------------------------------

const SECRET = "super-secret-key";
const now = Math.floor(Date.now() / 1000);

const token = signHs256(
  { alg: "HS256", typ: "JWT" },
  { sub: "123", name: "Jane", iat: now, exp: now + 3600 },
  SECRET,
);

console.log("HS256 token   :", token);
console.log("HS256 verify  :", verifyHs256(token, SECRET));

// tamper: change the payload but keep the old signature -> should fail
const [h, , s] = token.split(".");
const forged = `${h}.${b64url(JSON.stringify({ sub: "999", name: "Admin" }))}.${s}`;
console.log("tampered      :", verifyHs256(forged, SECRET));

// wrong key -> should fail
console.log("wrong key     :", verifyHs256(token, "not-the-key"));

// RS256 round-trip
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const rsToken = signRs256({ alg: "RS256", typ: "JWT" }, { sub: "123" }, privateKey);
console.log("RS256 verify  :", verifyRs256(rsToken, publicKey));
console.log("RS256 wrong key:", verifyRs256(rsToken, generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey));
