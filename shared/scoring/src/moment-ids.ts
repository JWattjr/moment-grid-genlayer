import { PREDICTIONS, PredictionId, Tier } from "./predictions";

/// Stable identity for every prediction. Values are deliberately spelled out
/// rather than derived from array order so clients and stored demo data do not
/// silently change meaning when `PREDICTION_IDS` is reordered.
///
/// Layout invariant, asserted in the tests: tier 0 owns 1–9, tier 1 owns 10–18,
/// tier 2 owns 19–27.
export const MOMENT_IDS: Record<PredictionId, number> = {
  HOME_TWO_SHOTS_30: 1,
  GOAL_FIRST_30: 2,
  TWO_CORNERS_30: 3,
  CARD_30_60: 4,
  GOAL_30_60: 5,
  TWO_SUBS_BY_60: 6,
  TWO_SUBS_AFTER_60: 7,
  CARD_AFTER_75: 8,
  TWO_CORNERS_AFTER_60: 9,
  HOME_SCORES_FIRST: 10,
  GOAL_BEFORE_20: 11,
  YELLOW_BEFORE_30: 12,
  VAR_30_60: 13,
  BOTH_SCORE_BY_60: 14,
  TWO_GOALS_BY_60: 15,
  BOTH_SCORE_FULL_TIME: 16,
  FOUR_CARDS_FULL_TIME: 17,
  GOAL_AFTER_75: 18,
  PENALTY_BEFORE_30: 19,
  AWAY_LEADS_30: 20,
  GOAL_OVERTURNED_30: 21,
  PENALTY_30_60: 22,
  SUBSTITUTE_GOAL_BY_60: 23,
  THREE_GOALS_BY_60: 24,
  GOAL_AFTER_80: 25,
  SUBSTITUTE_GOAL_AFTER_60: 26,
  EXTRA_TIME: 27,
};

export const GRID_CELLS = 9;

/// One bitmap per row listing every moment ID accepted by that tier. Derived
/// from `PREDICTIONS` so the compact representation cannot drift from the UI.
export const TIER_POOLS: readonly [bigint, bigint, bigint] = (() => {
  const pools: [bigint, bigint, bigint] = [0n, 0n, 0n];
  for (const definition of Object.values(PREDICTIONS)) {
    pools[definition.tier] |= 1n << BigInt(MOMENT_IDS[definition.id]);
  }
  return pools;
})();

export function tierPoolFor(tier: Tier): bigint {
  return TIER_POOLS[tier];
}

export function gridToMomentIds(grid: PredictionId[]): number[] {
  assertFullGrid(grid);
  return grid.map((prediction) => MOMENT_IDS[prediction]);
}

/// Packs nine row-major moment IDs into a compact bigint, one byte per cell,
/// little-endian. This is retained as a stable serialization format for tools.
export function packGrid(grid: PredictionId[]): bigint {
  assertFullGrid(grid);
  return grid.reduce((packed, moment, cell) => packed | (BigInt(MOMENT_IDS[moment]) << BigInt(cell * 8)), 0n);
}

const PREDICTION_BY_MOMENT_ID = Object.fromEntries(
  Object.entries(MOMENT_IDS).map(([prediction, momentId]) => [momentId, prediction]),
) as Record<number, PredictionId>;

/// Restores the exact row-major grid committed to the game contract. Invalid
/// bytes are rejected instead of being replaced with a frontend default.
export function unpackGrid(packedGrid: bigint): PredictionId[] {
  const grid: PredictionId[] = [];
  for (let cell = 0; cell < GRID_CELLS; cell += 1) {
    const momentId = Number((packedGrid >> BigInt(cell * 8)) & 0xffn);
    const prediction = PREDICTION_BY_MOMENT_ID[momentId];
    if (!prediction) throw new Error(`Packed grid contains unknown moment id ${momentId}.`);
    grid.push(prediction);
  }
  return grid;
}

export function assertFullGrid(grid: PredictionId[]): void {
  if (grid.length !== GRID_CELLS) {
    throw new Error(`A Moment Grid must contain exactly nine predictions, received ${grid.length}.`);
  }
}
