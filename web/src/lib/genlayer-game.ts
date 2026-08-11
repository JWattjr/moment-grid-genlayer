import { packGrid, type PredictionId } from "@moment-grid/scoring";
import { createClient } from "genlayer-js";
import { localnet, studionet, testnetBradbury } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus, type CalldataEncodable } from "genlayer-js/types";
import { formatEther, isAddress, parseEther } from "viem";
import type { GenLayerProvider } from "./genlayer-resolver";

export const MINIMUM_STAKE_GEN = "10";
export const MINIMUM_STAKE_WEI = parseEther(MINIMUM_STAKE_GEN);

export type GameRoundRecord = {
  round_id: string;
  match_id: string;
  resolver_address: string;
  resolver_resolution_id: string;
  status: "OPEN" | "SCORING" | "SETTLED" | "REFUNDING";
  minimum_stake: bigint;
  lock_at: string;
  refund_at: string;
  participant_count: bigint;
  total_escrow: bigint;
  total_pool_stake: bigint;
  total_claimed: bigint;
  jackpot_seed: bigint;
  jackpot_pool: bigint;
  jackpot_winning_stake: bigint;
  jackpot_paid: bigint;
  jackpot_rolled_over: boolean;
  revenue_pool: bigint;
  settlement_cursor: bigint;
  window_0_bitmap: bigint;
  window_1_bitmap: bigint;
  window_2_bitmap: bigint;
  settled_at: string;
};

export type GameEntryRecord = {
  packed_grid: bigint;
  stake_amount: bigint;
  claimed: boolean;
  joined_at: string;
  marked_mask: bigint;
  completed_lines: bigint;
  jackpot_qualified: boolean;
  claimable: bigint;
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
  enabled: isAddress(contractAddress) && isAddress(resolverAddress) && Boolean(roundId),
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

async function writeAccepted(
  account: `0x${string}`,
  provider: GenLayerProvider,
  address: `0x${string}`,
  functionName: string,
  args: CalldataEncodable[],
  value = 0n,
): Promise<`0x${string}`> {
  const writeClient = client(account, provider);
  await writeClient.connect(selectedNetwork.connectName);
  const hash = await writeClient.writeContract({ address, functionName, args, value });
  const receipt = await client().waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    interval: 3_000,
    retries: 120,
  });
  if (receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    throw new Error(`GenLayer accepted the transaction, but execution failed (${receipt.txExecutionResultName}).`);
  }
  return hash;
}

export function parseStake(value: string): bigint {
  const stake = parseEther(value.trim() || "0");
  if (stake < MINIMUM_STAKE_WEI) throw new Error("Minimum stake is 10 GEN.");
  return stake;
}

export function formatGen(value: bigint): string {
  return Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export async function readGameRound(): Promise<GameRoundRecord | null> {
  if (!genLayerGameConfig.enabled) return null;
  const result = await client().readContract({
    address: gameAddress(),
    functionName: "get_round",
    args: [roundId],
  });
  return result && typeof result === "object" && Object.keys(result).length > 0
    ? result as GameRoundRecord
    : null;
}

export async function readGameEntry(player: `0x${string}`): Promise<GameEntryRecord | null> {
  if (!genLayerGameConfig.enabled) return null;
  const result = await client().readContract({
    address: gameAddress(),
    functionName: "get_entry",
    args: [roundId, player],
  });
  return result && typeof result === "object" && Object.keys(result).length > 0
    ? result as GameEntryRecord
    : null;
}

export async function enterGameRound(
  account: `0x${string}`,
  provider: GenLayerProvider,
  grid: PredictionId[],
  stake: bigint,
): Promise<`0x${string}`> {
  return writeAccepted(account, provider, gameAddress(), "join_round", [roundId, packGrid(grid)], stake);
}

export async function resolveGameRound(
  account: `0x${string}`,
  provider: GenLayerProvider,
): Promise<`0x${string}`> {
  return writeAccepted(
    account,
    provider,
    roundResolverAddress(),
    "resolve_round",
    [roundId],
  );
}

export async function processGameSettlement(
  account: `0x${string}`,
  provider: GenLayerProvider,
): Promise<`0x${string}`> {
  return writeAccepted(account, provider, gameAddress(), "process_settlement", [roundId, 100]);
}

export async function claimGamePayout(
  account: `0x${string}`,
  provider: GenLayerProvider,
): Promise<`0x${string}`> {
  return writeAccepted(account, provider, gameAddress(), "claim", [roundId]);
}
