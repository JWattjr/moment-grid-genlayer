import arsenalBournemouth from "../../../fixtures/genlayer/arsenal-bournemouth-2024-05-04.json";
import arsenalChelsea from "../../../fixtures/genlayer/arsenal-chelsea-2023-05-02.json";
import argentinaFrance from "../../../fixtures/genlayer/argentina-france-2022-12-18.json";
import manchesterUnitedLiverpool from "../../../fixtures/genlayer/manchester-united-liverpool-2024-09-01.json";
import type { ResolverMomentType } from "./genlayer-resolver";

export type GenLayerDemoMoment = {
  resolution_id: string;
  moment_type: ResolverMomentType;
  moment_statement: string;
  prediction_id: string;
  criteria: Record<string, unknown>;
};

export type GenLayerDemoFixture = {
  fixture_kind: "DEMO_IDENTITY_AND_CRITERIA_ONLY";
  match_id: string;
  home_team: string;
  away_team: string;
  competition: string;
  match_date: string;
  venue: string;
  source_urls: string[];
  moments: GenLayerDemoMoment[];
};

export const GENLAYER_DEMO_FIXTURES = [
  arsenalChelsea,
  argentinaFrance,
  manchesterUnitedLiverpool,
  arsenalBournemouth,
] as GenLayerDemoFixture[];

export const GENLAYER_DEMO_MOMENTS = GENLAYER_DEMO_FIXTURES.flatMap((fixture) =>
  fixture.moments.map((moment) => ({ fixture, moment })),
);
