import { completedLinesForMask } from "./lines";
import { PredictionId } from "./predictions";
import { GridScore } from "./scoring-bridge";

export type GenLayerMomentResult = "TRUE" | "FALSE" | "INVALID";
export type GenLayerMomentType =
  | "HOME_TEAM_SCORES_FIRST"
  | "BOTH_TEAMS_SCORE_FULL_TIME"
  | "PENALTY_AWARDED";

export type GenLayerScoringResolution = {
  moment_type: GenLayerMomentType;
  criteria_json: string;
  status: "PENDING" | "SETTLED";
  result: GenLayerMomentResult | "UNRESOLVED";
};

function predictionForResolution(resolution: GenLayerScoringResolution): PredictionId | null {
  if (resolution.moment_type === "HOME_TEAM_SCORES_FIRST") return "HOME_SCORES_FIRST";
  if (resolution.moment_type === "BOTH_TEAMS_SCORE_FULL_TIME") return "BOTH_SCORE_FULL_TIME";

  try {
    const criteria = JSON.parse(resolution.criteria_json) as Record<string, unknown>;
    if (criteria.event === "PENALTY_AWARDED" && criteria.from_minute === 30 && criteria.to_minute === 60) {
      return "PENALTY_30_60";
    }
  } catch {
    return null;
  }
  return null;
}

/// Applies finalized shared facts to the deterministic grid score. Pending or
/// invalid attempts never alter the local replay result.
export function applyGenLayerResolutions(
  grid: PredictionId[],
  score: GridScore,
  resolutions: GenLayerScoringResolution[],
): GridScore {
  let markedMask = score.markedMask;

  for (const resolution of resolutions) {
    if (resolution.status !== "SETTLED") continue;
    if (resolution.result !== "TRUE" && resolution.result !== "FALSE") continue;
    const prediction = predictionForResolution(resolution);
    if (!prediction) continue;
    const cell = grid.indexOf(prediction);
    if (cell === -1) continue;
    const cellBit = 1 << cell;
    markedMask = resolution.result === "TRUE" ? markedMask | cellBit : markedMask & ~cellBit;
  }

  return { markedMask, completedLines: completedLinesForMask(markedMask) };
}

/// Backwards-compatible adapter for callers that only have the first result.
export function applyHomeScoresFirstResolution(
  grid: PredictionId[],
  score: GridScore,
  result: GenLayerMomentResult | null,
): GridScore {
  if (result === null) return score;
  return applyGenLayerResolutions(grid, score, [{
    moment_type: "HOME_TEAM_SCORES_FIRST",
    criteria_json: "{}",
    status: "SETTLED",
    result,
  }]);
}
