import { describe, expect, it } from "vitest";
import { applyGenLayerResolutions, applyHomeScoresFirstResolution } from "./genlayer-resolution";
import { PredictionId } from "./predictions";

const grid: PredictionId[] = [
  "HOME_TWO_SHOTS_30",
  "CARD_30_60",
  "TWO_SUBS_AFTER_60",
  "HOME_SCORES_FIRST",
  "VAR_30_60",
  "BOTH_SCORE_FULL_TIME",
  "PENALTY_BEFORE_30",
  "PENALTY_30_60",
  "GOAL_AFTER_80",
];

describe("applyGenLayerResolutions", () => {
  it("marks the home-first cell and recomputes lines for TRUE", () => {
    expect(applyHomeScoresFirstResolution(grid, { markedMask: 0x030, completedLines: 0 }, "TRUE")).toEqual({
      markedMask: 0x038,
      completedLines: 1,
    });
  });

  it("clears the home-first cell for FALSE", () => {
    expect(applyHomeScoresFirstResolution(grid, { markedMask: 0x038, completedLines: 1 }, "FALSE")).toEqual({
      markedMask: 0x030,
      completedLines: 0,
    });
  });

  it("does not alter scoring for INVALID", () => {
    const score = { markedMask: 0x038, completedLines: 1 };
    expect(applyHomeScoresFirstResolution(grid, score, "INVALID")).toEqual(score);
  });

  it("maps the two additional reusable event types", () => {
    const score = applyGenLayerResolutions(grid, { markedMask: 0, completedLines: 0 }, [
      {
        moment_type: "BOTH_TEAMS_SCORE_FULL_TIME",
        criteria_json: "{}",
        status: "SETTLED",
        result: "TRUE",
      },
      {
        moment_type: "PENALTY_AWARDED",
        criteria_json: JSON.stringify({ event: "PENALTY_AWARDED", from_minute: 30, to_minute: 60 }),
        status: "SETTLED",
        result: "TRUE",
      },
    ]);

    expect(score.markedMask).toBe((1 << 5) | (1 << 7));
  });

  it("ignores pending evidence and unknown penalty windows", () => {
    const original = { markedMask: 0x13f, completedLines: 4 };
    expect(applyGenLayerResolutions(grid, original, [
      {
        moment_type: "PENALTY_AWARDED",
        criteria_json: JSON.stringify({ event: "PENALTY_AWARDED", from_minute: 0, to_minute: 30 }),
        status: "SETTLED",
        result: "FALSE",
      },
      {
        moment_type: "BOTH_TEAMS_SCORE_FULL_TIME",
        criteria_json: "{}",
        status: "PENDING",
        result: "INVALID",
      },
    ])).toEqual(original);
  });
});
