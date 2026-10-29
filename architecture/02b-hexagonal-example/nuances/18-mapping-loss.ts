// 18 — Mapping loss
// Scenario: a save/load round-trip must preserve meaning, not just field names.
import { test } from "node:test";
import assert from "node:assert/strict";

type Tier = "free" | "pro";

type Account = {
  id: string;
  email: string;
  nickname?: string; // absent is not the same as empty
  balanceCents: number;
  createdAt: Date;
  tier: Tier;
};

type AccountRow = {
  id: string;
  email: string;
  nickname: string | null;
  balance_cents: number;
  created_at: string;
  tier: string;
};

// (a) correct: explicit mapping preserves absence, units, instants, and the enum.
function toRow(account: Account): AccountRow {
  return {
    id: account.id,
    email: account.email,
    nickname: account.nickname ?? null,
    balance_cents: account.balanceCents,
    created_at: account.createdAt.toISOString(),
    tier: account.tier,
  };
}

function toDomain(row: AccountRow): Account {
  if (row.tier !== "free" && row.tier !== "pro") throw new Error(`unknown tier: ${row.tier}`);
  return {
    id: row.id,
    email: row.email,
    ...(row.nickname === null ? {} : { nickname: row.nickname }),
    balanceCents: row.balance_cents,
    createdAt: new Date(row.created_at),
    tier: row.tier,
  };
}

// (b) anti-pattern: JSON is treated as a mapper.
function naiveRoundTrip(account: Account): Account {
  return JSON.parse(JSON.stringify(account)) as Account;
}

test("18: the explicit mapper round-trips exactly", () => {
  const account: Account = {
    id: "a-1",
    email: "ada@example.com",
    balanceCents: 1999,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    tier: "pro",
  };

  assert.deepEqual(toDomain(toRow(account)), account);
  assert.equal("nickname" in toDomain(toRow(account)), false);
});

test("18: the naive round-trip loses types and presence", () => {
  const account: Account = {
    id: "a-1",
    email: "ada@example.com",
    balanceCents: 1999,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    tier: "pro",
  };

  const copy = naiveRoundTrip(account);

  assert.equal(typeof copy.createdAt, "string"); // a Date became a string
  assert.deepEqual(copy, { ...account, createdAt: "2026-01-01T00:00:00.000Z" });
  assert.notDeepEqual(copy, account);
  // An absent nickname would also disappear: JSON has no undefined.
});
