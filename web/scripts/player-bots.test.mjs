import assert from "node:assert/strict";
import test from "node:test";

import { packMomentIds, PLAYER_BOT_PROFILES, playerBotProfile } from "./genlayer-bots.mjs";

test("form and chaos bots publish distinct fixed grids", () => {
  assert.deepEqual(PLAYER_BOT_PROFILES.form.momentIds, [1, 4, 7, 10, 13, 16, 19, 22, 25]);
  assert.deepEqual(PLAYER_BOT_PROFILES.chaos.momentIds, [3, 6, 9, 12, 15, 18, 21, 24, 27]);
  assert.notEqual(packMomentIds(PLAYER_BOT_PROFILES.form.momentIds), packMomentIds(PLAYER_BOT_PROFILES.chaos.momentIds));
});

test("each disclosed bot chooses exactly one valid option per independent cell", () => {
  for (const profile of Object.values(PLAYER_BOT_PROFILES)) {
    profile.momentIds.forEach((momentId, cell) => {
      const first = cell * 3 + 1;
      assert.ok(momentId >= first && momentId <= first + 2);
    });
  }
});

test("unknown player bot profiles are rejected", () => {
  assert.throws(() => playerBotProfile("adaptive"), /form or chaos/);
});
