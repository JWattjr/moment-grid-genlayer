import assert from "node:assert/strict";
import test from "node:test";
import { decideKeeperAction, KeeperAction } from "./keeper-policy.mjs";

const baseRound = {
  status: "OPEN",
  lock_at: "2026-08-21T18:45:00Z",
  resolve_not_before: "2026-08-21T21:30:00Z",
  refund_at: "2026-08-25T19:00:00Z",
  liquidity_ready: true,
  resolution_accepted_at: "",
};

test("waits before the evidence window", () => {
  assert.equal(decideKeeperAction(baseRound, { status: "PENDING" }, Date.parse("2026-08-21T20:00:00Z")).action, KeeperAction.WAIT);
});

test("refunds an underfilled locked round", () => {
  const round = { ...baseRound, liquidity_ready: false };
  assert.equal(decideKeeperAction(round, { status: "PENDING" }, Date.parse("2026-08-21T19:00:00Z")).action, KeeperAction.REFUND);
});

test("resolves or retries eligible evidence", () => {
  assert.equal(decideKeeperAction(baseRound, { status: "PENDING" }, Date.parse("2026-08-21T22:00:00Z")).action, KeeperAction.RESOLVE);
});

test("redispatches a settled resolution without a callback", () => {
  assert.equal(decideKeeperAction(baseRound, { status: "SETTLED" }, Date.parse("2026-08-21T22:00:00Z")).action, KeeperAction.DISPATCH);
});

test("processes scoring before the timeout", () => {
  const round = { ...baseRound, status: "SCORING", resolution_accepted_at: "2026-08-21T22:00:00Z" };
  assert.equal(decideKeeperAction(round, { status: "SETTLED" }, Date.parse("2026-08-21T22:01:00Z")).action, KeeperAction.PROCESS);
});

test("refund deadline overrides scoring", () => {
  const round = { ...baseRound, status: "SCORING" };
  assert.equal(decideKeeperAction(round, { status: "SETTLED" }, Date.parse("2026-08-25T19:00:00Z")).action, KeeperAction.REFUND);
});
