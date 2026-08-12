import { createClient } from "genlayer-js";
import { localnet, studionet, testnetBradbury } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import { isAddress } from "viem";
import fixture from "../../../fixtures/genlayer/arsenal-chelsea-2023-05-02.json";

export type ResolverResult = "UNRESOLVED" | "TRUE" | "FALSE" | "INVALID";
export type ResolverMomentType =
  | "HOME_TEAM_SCORES_FIRST"
  | "BOTH_TEAMS_SCORE_FULL_TIME"
  | "PENALTY_AWARDED";

export type ResolverRecord = {
  resolution_id: string;
  match_id: string;
  home_team: string;
  away_team: string;
  competition: string;
  match_date: string;
  moment_type: ResolverMomentType;
  moment_statement: string;
  criteria_json: string;
  source_urls_json: string;
  status: "PENDING" | "SETTLED";
  result: ResolverResult;
  reason_code: string;
  match_status: "FINAL" | "LIVE" | "SCHEDULED" | "UNKNOWN";
  event_minute: number;
  evidence_summary: string;
  source_references_json: string;
  resolved_at: string;
  attempt_count: number;
};

type FixtureMoment = {
  resolution_id: string;
  moment_type: ResolverMomentType;
  moment_statement: string;
  prediction_id: string;
  criteria: Record<string, unknown>;
};

type GenLayerClientConfig = NonNullable<Parameters<typeof createClient>[0]>;
export type GenLayerProvider = NonNullable<GenLayerClientConfig["provider"]>;
export type ResolverWriteResult = { record: ResolverRecord; hash: `0x${string}` | null };
type ResolutionHistoryResponse = { records?: ResolverRecord[]; technical_error?: string };

const networkSetting = process.env.NEXT_PUBLIC_GENLAYER_RESOLVER_NETWORK
  ?? process.env.NEXT_PUBLIC_GENLAYER_NETWORK
  ?? "studionet";
const networks = {
  localnet: { chain: localnet, connectName: "localnet" as const },
  studionet: { chain: studionet, connectName: "studionet" as const },
  "testnet-bradbury": { chain: testnetBradbury, connectName: "testnetBradbury" as const },
};
const selectedNetwork = networks[networkSetting as keyof typeof networks] ?? networks.studionet;
const contractAddress = process.env.NEXT_PUBLIC_GENLAYER_RESOLVER_ADDRESS ?? "";
const endpoint = process.env.NEXT_PUBLIC_GENLAYER_RESOLVER_RPC_URL?.trim()
  || process.env.NEXT_PUBLIC_GENLAYER_RPC_URL?.trim()
  || undefined;
const resolutionId = process.env.NEXT_PUBLIC_GENLAYER_RESOLUTION_ID
  ?? "epl-2023-05-02-arsenal-chelsea-home-first";
const configuredMoment = (fixture.moments as FixtureMoment[])
  .find((moment) => moment.resolution_id === resolutionId);

export const genLayerResolverConfig = {
  contractAddress,
  endpoint,
  network: networkSetting,
  chainId: selectedNetwork.chain.id,
  resolutionId,
  fixture,
  moment: configuredMoment,
  enabled: isAddress(contractAddress) && Boolean(configuredMoment),
};

function client(account?: `0x${string}`, provider?: GenLayerProvider) {
  return createClient({
    chain: selectedNetwork.chain,
    ...(endpoint ? { endpoint } : {}),
    ...(account ? { account } : {}),
    ...(provider ? { provider } : {}),
  });
}

export async function readResolutionById(targetResolutionId: string): Promise<ResolverRecord | null> {
  if (!isAddress(contractAddress)) return null;
  const result = await client().readContract({
    address: contractAddress as `0x${string}`,
    functionName: "get_resolution",
    args: [targetResolutionId],
  });
  if (!result || (typeof result === "object" && Object.keys(result).length === 0)) return null;
  return result as ResolverRecord;
}

export async function readResolutionHistory(legacyIds: string[] = []): Promise<ResolverRecord[]> {
  if (!isAddress(contractAddress)) return [];
  const readClient = client();
  const ids: string[] = [];

  if (legacyIds.length > 0) {
    ids.push(...legacyIds);
  } else try {
    const countResult = await readClient.readContract({
      address: contractAddress as `0x${string}`,
      functionName: "get_resolution_count",
      args: [],
    });
    const count = Math.min(Number(countResult), 50);
    for (let index = 0; index < count; index += 1) {
      const id = await readClient.readContract({
        address: contractAddress as `0x${string}`,
        functionName: "get_resolution_id",
        args: [index],
      });
      if (typeof id === "string" && id.length > 0) ids.push(id);
    }
  } catch {
    const configuredIds = process.env.GENLAYER_HISTORY_IDS
      ?? "epl-2023-05-02-arsenal-chelsea-home-first,epl-2023-05-02-arsenal-chelsea-penalty-30-60";
    ids.push(...configuredIds.split(",").map((id) => id.trim()).filter(Boolean));
  }

  const records: ResolverRecord[] = [];
  for (const id of [...new Set(ids)]) {
    const record = await readResolutionById(id);
    if (record) records.push(record);
  }
  return records.sort((left, right) => right.resolved_at.localeCompare(left.resolved_at));
}

function sameJson(left: string, right: unknown): boolean {
  try {
    return JSON.stringify(JSON.parse(left)) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function assertExpectedResolution(record: ResolverRecord): void {
  if (!configuredMoment) throw new Error("The configured resolution is not present in the tracked demo fixture.");
  const matchesConfig =
    record.resolution_id === configuredMoment.resolution_id
    && record.match_id === fixture.match_id
    && record.home_team === fixture.home_team
    && record.away_team === fixture.away_team
    && record.competition === fixture.competition
    && record.match_date === fixture.match_date
    && record.moment_type === configuredMoment.moment_type
    && record.moment_statement === configuredMoment.moment_statement
    && sameJson(record.criteria_json, configuredMoment.criteria)
    && sameJson(record.source_urls_json, fixture.source_urls);

  if (!matchesConfig) {
    throw new Error("The configured GenLayer resolution id is bound to different immutable match evidence.");
  }
}

export async function readConfiguredResolution(): Promise<ResolverRecord | null> {
  if (!genLayerResolverConfig.enabled) return null;
  let record: ResolverRecord | null;
  if (typeof window === "undefined") {
    record = await readResolutionById(resolutionId);
  } else {
    const response = await fetch(`/api/genlayer/resolutions?id=${encodeURIComponent(resolutionId)}`, { cache: "no-store" });
    const payload = await response.json() as ResolutionHistoryResponse;
    if (!response.ok) {
      throw new Error(payload.technical_error || "The GenLayer resolution API is temporarily unavailable.");
    }
    record = payload.records?.find((candidate) => candidate.resolution_id === resolutionId) ?? null;
  }
  if (!record) return null;
  assertExpectedResolution(record);
  return record;
}

/// Registration is intentionally absent from the browser: only the deployer
/// may create immutable market definitions. Players can inspect and trigger a
/// registered resolution permissionlessly.
export async function requireRegisteredResolution(): Promise<ResolverRecord> {
  const record = await readConfiguredResolution();
  if (!record) throw new Error("The configured GenLayer moment has not been registered by the deployer.");
  return record;
}

export async function resolveConfiguredResolution(
  account: `0x${string}`,
  provider: GenLayerProvider,
  onStatus?: (phase: "SUBMITTED" | "FINALIZING" | "FINALIZED", hash: `0x${string}`) => void,
): Promise<ResolverWriteResult> {
  const existing = await requireRegisteredResolution();
  if (existing.status === "SETTLED") return { record: existing, hash: null };

  const writeClient = client(account, provider);
  await writeClient.connect(selectedNetwork.connectName);
  const hash = await writeClient.writeContract({
    address: contractAddress as `0x${string}`,
    functionName: "resolve_moment",
    args: [resolutionId],
    value: 0n,
  });
  onStatus?.("SUBMITTED", hash);

  onStatus?.("FINALIZING", hash);
  const finalized = await client().waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    interval: 3_000,
    retries: 240,
  });
  if (finalized.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    throw new Error(`GenLayer finalized the transaction, but execution failed (${finalized.txExecutionResultName}).`);
  }
  onStatus?.("FINALIZED", hash);

  const record = await requireRegisteredResolution();
  if (record.status !== "SETTLED") {
    throw new Error(`Evidence was not final enough to settle (${record.reason_code || "UNKNOWN"}); retry later.`);
  }
  return { record, hash };
}
