import { packGrid, type PredictionId } from "@moment-grid/scoring";
import { createClient } from "genlayer-js";
import { localnet, studionet, testnetBradbury } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus, type CalldataEncodable } from "genlayer-js/types";
import { formatEther, isAddress, parseEther } from "viem";
import type { GenLayerProvider } from "./genlayer-resolver";

export const MINIMUM_STAKE_GEN = "10";
export const MINIMUM_STAKE_WEI = parseEther(MINIMUM_STAKE_GEN);
export const MAXIMUM_STAKE_WEI = parseEther("100");
export type RoundStatus = "OPEN" | "SCORING" | "SETTLED" | "REFUNDING";

export type GameRoundRecord = {
  round_id: string;
  match_id: string;
  resolver_address: string;
  resolver_resolution_id: string;
  status: RoundStatus;
  minimum_stake: bigint;
  maximum_stake?: bigint;
  lock_at: string;
  kickoff_at?: string;
  resolve_not_before?: string;
  refund_at: string;
  minimum_participants?: bigint;
  minimum_total_stake?: bigint;
  minimum_unique_grids?: bigint;
  unique_grid_count?: bigint;
  liquidity_ready?: boolean;
  participant_count: bigint;
  total_escrow: bigint;
  total_pool_stake: bigint;
  total_claimed: bigint;
  jackpot_seed: bigint;
  jackpot_pool: bigint;
  jackpot_winning_stake: bigint;
  jackpot_paid: bigint;
  jackpot_rolled_over: boolean;
  jackpot_rollover_destination?: string;
  revenue_pool: bigint;
  settlement_cursor: bigint;
  window_0_bitmap: bigint;
  window_1_bitmap: bigint;
  window_2_bitmap: bigint;
  window_0_valid_bitmap?: bigint;
  window_1_valid_bitmap?: bigint;
  window_2_valid_bitmap?: bigint;
  resolution_accepted_at?: string;
  settled_at: string;
};

export type GameEntryRecord = {
  player?: string;
  packed_grid: bigint;
  stake_amount: bigint;
  claimed: boolean;
  joined_at: string;
  marked_mask: bigint;
  completed_lines: bigint;
  jackpot_qualified: boolean;
  claimable: bigint;
};

export type GameCellPool = {
  cell: bigint;
  tier: "COMMON" | "MEDIUM" | "RARE";
  total_pool: bigint;
  option_0_moment_id: bigint;
  option_0_stake: bigint;
  option_1_moment_id: bigint;
  option_1_stake: bigint;
  option_2_moment_id: bigint;
  option_2_stake: bigint;
  winning_stake: bigint;
  refundable_stake?: bigint;
  paid: bigint;
};

type GenLayerClientConfig = NonNullable<Parameters<typeof createClient>[0]>;
const networkSetting = process.env.NEXT_PUBLIC_GENLAYER_GAME_NETWORK ?? "testnet-bradbury";
const networks = {
  localnet: { chain: localnet, connectName: "localnet" as const },
  studionet: { chain: studionet, connectName: "studionet" as const },
  "testnet-bradbury": { chain: testnetBradbury, connectName: "testnetBradbury" as const },
};
const selectedNetwork = networks[networkSetting as keyof typeof networks] ?? networks["testnet-bradbury"];
const contractAddress = process.env.NEXT_PUBLIC_GENLAYER_GAME_ADDRESS ?? "";
const resolverAddress = process.env.NEXT_PUBLIC_GENLAYER_ROUND_RESOLVER_ADDRESS ?? "";
const roundId = process.env.NEXT_PUBLIC_GENLAYER_GAME_ROUND_ID ?? "";
const endpoint = process.env.NEXT_PUBLIC_GENLAYER_GAME_RPC_URL?.trim() || undefined;

export const genLayerGameConfig = {
  contractAddress,
  resolverAddress,
  roundId,
  endpoint,
  network: networkSetting,
  chainId: selectedNetwork.chain.id,
  enabled: isAddress(contractAddress) && isAddress(resolverAddress),
  activeRoundEnabled: isAddress(contractAddress) && isAddress(resolverAddress) && Boolean(roundId),
};

function client(account?: `0x${string}`, provider?: GenLayerClientConfig["provider"]) {
  return createClient({
    chain: selectedNetwork.chain,
    ...(endpoint ? { endpoint } : {}),
    ...(account ? { account } : {}),
    ...(provider ? { provider } : {}),
  });
}

function gameAddress(): `0x${string}` {
  if (!isAddress(contractAddress)) throw new Error("The Bradbury game contract is not configured.");
  return contractAddress;
}

function roundResolverAddress(): `0x${string}` {
  if (!isAddress(resolverAddress)) throw new Error("The Bradbury round resolver is not configured.");
  return resolverAddress;
}

async function writeFinalized(
  account: `0x${string}`,
  provider: GenLayerProvider,
  address: `0x${string}`,
  functionName: string,
  args: CalldataEncodable[],
  value = 0n,
  onSubmitted?: (hash: `0x${string}`) => void,
): Promise<`0x${string}`> {
  const writeClient = client(account, provider);
  await writeClient.connect(selectedNetwork.connectName);
  const hash = await writeClient.writeContract({ address, functionName, args, value });
  onSubmitted?.(hash);
  const receipt = await client().waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    interval: 3_000,
    retries: 240,
  });
  if (receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    throw new Error(`GenLayer finalized the transaction, but execution failed (${receipt.txExecutionResultName}).`);
  }
  return hash;
}

export function parseStake(value: string): bigint {
  const stake = parseEther(value.trim() || "0");
  if (stake < MINIMUM_STAKE_WEI) throw new Error("Minimum stake is 10 GEN.");
  if (stake > MAXIMUM_STAKE_WEI) throw new Error("Maximum testnet stake is 100 GEN per round.");
  return stake;
}

export function formatGen(value: bigint): string {
  return Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function stakeAllocation(value: string) {
  const stake = parseStake(value);
  return {
    stake,
    common: stake * 15n / 100n,
    medium: stake * 30n / 100n,
    rare: stake * 45n / 100n,
    jackpot: stake * 5n / 100n,
    protocol: stake * 5n / 100n,
  };
}

export async function readGameRound(selectedRoundId = roundId): Promise<GameRoundRecord | null> {
  if (!genLayerGameConfig.enabled || !selectedRoundId) return null;
  const result = await client().readContract({ address: gameAddress(), functionName: "get_round", args: [selectedRoundId] });
  return result && typeof result === "object" && Object.keys(result).length > 0 ? result as GameRoundRecord : null;
}

export async function readGameRounds(): Promise<GameRoundRecord[]> {
  if (!genLayerGameConfig.enabled) return [];
  const count = await client().readContract({ address: gameAddress(), functionName: "get_round_count", args: [] }) as bigint;
  const ids = await Promise.all(Array.from({ length: Number(count) }, (_, index) => client().readContract({
    address: gameAddress(), functionName: "get_round_id", args: [index],
  }) as Promise<string>));
  const rounds = await Promise.all(ids.map((id) => readGameRound(id)));
  return rounds.filter((value): value is GameRoundRecord => Boolean(value)).reverse();
}

export async function readGameEntry(player: `0x${string}`, selectedRoundId = roundId): Promise<GameEntryRecord | null> {
  if (!genLayerGameConfig.enabled || !selectedRoundId) return null;
  const result = await client().readContract({ address: gameAddress(), functionName: "get_entry", args: [selectedRoundId, player] });
  return result && typeof result === "object" && Object.keys(result).length > 0 ? result as GameEntryRecord : null;
}

export async function readRoundEntries(selectedRoundId: string, participantCount: bigint): Promise<GameEntryRecord[]> {
  if (!genLayerGameConfig.enabled) return [];
  const records = await Promise.all(Array.from({ length: Number(participantCount) }, (_, index) => client().readContract({
    address: gameAddress(), functionName: "get_entry_by_index", args: [selectedRoundId, index],
  }) as Promise<GameEntryRecord>));
  return records.filter((record) => record && Object.keys(record).length > 0);
}

export async function readCellPools(selectedRoundId = roundId): Promise<GameCellPool[]> {
  if (!genLayerGameConfig.enabled || !selectedRoundId) return [];
  return Promise.all(Array.from({ length: 9 }, (_, cell) => client().readContract({
    address: gameAddress(), functionName: "get_cell_pool", args: [selectedRoundId, cell],
  }) as Promise<GameCellPool>));
}

type Submitted = (hash: `0x${string}`) => void;

export function enterGameRound(account: `0x${string}`, provider: GenLayerProvider, grid: PredictionId[], stake: bigint, selectedRoundId = roundId, onSubmitted?: Submitted) {
  return writeFinalized(account, provider, gameAddress(), "join_round", [selectedRoundId, packGrid(grid)], stake, onSubmitted);
}

export function resolveGameRound(account: `0x${string}`, provider: GenLayerProvider, resolutionId: string, onSubmitted?: Submitted) {
  return writeFinalized(account, provider, roundResolverAddress(), "resolve_round", [resolutionId], 0n, onSubmitted);
}

export function dispatchGameResolution(account: `0x${string}`, provider: GenLayerProvider, resolutionId: string, onSubmitted?: Submitted) {
  return writeFinalized(account, provider, roundResolverAddress(), "dispatch_resolution", [resolutionId], 0n, onSubmitted);
}

export function processGameSettlement(account: `0x${string}`, provider: GenLayerProvider, selectedRoundId = roundId, onSubmitted?: Submitted) {
  return writeFinalized(account, provider, gameAddress(), "process_settlement", [selectedRoundId, 100], 0n, onSubmitted);
}

export function activateGameRefunds(account: `0x${string}`, provider: GenLayerProvider, selectedRoundId = roundId, onSubmitted?: Submitted) {
  return writeFinalized(account, provider, gameAddress(), "activate_refunds", [selectedRoundId], 0n, onSubmitted);
}

export function claimGamePayout(account: `0x${string}`, provider: GenLayerProvider, selectedRoundId = roundId, onSubmitted?: Submitted) {
  return writeFinalized(account, provider, gameAddress(), "claim", [selectedRoundId], 0n, onSubmitted);
}
