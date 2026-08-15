#!/usr/bin/env node

import { createAccount, createClient } from "genlayer-js";
import { studionet, testnetBradbury } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import { pathToFileURL } from "node:url";
import { decideKeeperAction, KeeperAction } from "./keeper-policy.mjs";

const ONE_GEN = 1_000_000_000_000_000_000n;

// Both grids are fixed, public, and committed before human play. These bots
// provide disclosed liquidity; they never optimize against a player's entry.
export const PLAYER_BOT_PROFILES = Object.freeze({
  form: Object.freeze({
    label: "Form Bot",
    strategy: "First registered option in every cell.",
    momentIds: Object.freeze([1, 4, 7, 10, 13, 16, 19, 22, 25]),
  }),
  chaos: Object.freeze({
    label: "Chaos Bot",
    strategy: "Third registered option in every cell.",
    momentIds: Object.freeze([3, 6, 9, 12, 15, 18, 21, 24, 27]),
  }),
});
export const TEST_BOT_MOMENT_IDS = PLAYER_BOT_PROFILES.chaos.momentIds;

export function packMomentIds(momentIds) {
  if (momentIds.length !== 9) throw new Error("The test bot grid must contain nine moment IDs.");
  return momentIds.reduce((packed, momentId, cell) => {
    const first = cell * 3 + 1;
    if (!Number.isInteger(momentId) || momentId < first || momentId > first + 2) {
      throw new Error(`Moment ${momentId} is invalid for cell ${cell}.`);
    }
    return packed | (BigInt(momentId) << BigInt(cell * 8));
  }, 0n);
}

function json(value) {
  return JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item, 2);
}

function config() {
  const network = process.env.GENLAYER_NETWORK ?? process.env.NEXT_PUBLIC_GENLAYER_GAME_NETWORK ?? "studionet";
  const gameAddress = process.env.GENLAYER_GAME_ADDRESS ?? process.env.NEXT_PUBLIC_GENLAYER_GAME_ADDRESS ?? "";
  const resolverAddress = process.env.GENLAYER_ROUND_RESOLVER_ADDRESS ?? process.env.NEXT_PUBLIC_GENLAYER_ROUND_RESOLVER_ADDRESS ?? "";
  const roundId = process.env.GENLAYER_GAME_ROUND_ID ?? process.env.NEXT_PUBLIC_GENLAYER_GAME_ROUND_ID ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(gameAddress) || !/^0x[0-9a-fA-F]{40}$/.test(resolverAddress) || !roundId) {
    throw new Error("GENLAYER_GAME_ADDRESS, GENLAYER_ROUND_RESOLVER_ADDRESS, and GENLAYER_GAME_ROUND_ID are required.");
  }
  if (network !== "studionet" && network !== "testnet-bradbury") {
    throw new Error("Bots are restricted to studionet or testnet-bradbury.");
  }
  return { gameAddress, resolverAddress, roundId, network };
}

function clients(requireSigner, network) {
  const chain = network === "studionet" ? studionet : testnetBradbury;
  const reader = createClient({ chain });
  if (!requireSigner) return { reader, writer: null, account: null };
  const privateKey = process.env.GENLAYER_BOT_PRIVATE_KEY?.trim();
  if (!privateKey?.match(/^0x[0-9a-fA-F]{64}$/)) {
    throw new Error("GENLAYER_BOT_PRIVATE_KEY must be supplied through a secret store for execution.");
  }
  const account = createAccount(privateKey);
  const writer = createClient({ chain, account });
  return { reader, writer, account };
}

async function submit(reader, writer, address, functionName, args, value = 0n) {
  const hash = await writer.writeContract({ address, functionName, args, value });
  console.log(`${functionName} submitted: ${hash}`);
  const receipt = await reader.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    interval: 3_000,
    retries: 120,
  });
  const leaderExecution = receipt.consensus_data?.leader_receipt?.[0]?.execution_result;
  if (receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN && leaderExecution !== "SUCCESS") {
    throw new Error(`${functionName} was accepted but execution failed (${receipt.txExecutionResultName ?? leaderExecution ?? "UNKNOWN"}).`);
  }
  console.log(`${functionName} accepted with successful execution.`);
  return hash;
}

async function readState(reader, settings, player) {
  const round = await reader.readContract({ address: settings.gameAddress, functionName: "get_round", args: [settings.roundId] });
  const resolution = await reader.readContract({ address: settings.resolverAddress, functionName: "get_round_resolution", args: [settings.roundId] });
  const entry = player
    ? await reader.readContract({ address: settings.gameAddress, functionName: "get_entry", args: [settings.roundId, player] })
    : null;
  return { round, resolution, entry };
}

export function playerBotProfile(name = "form") {
  const profile = PLAYER_BOT_PROFILES[name];
  if (!profile) throw new Error("GENLAYER_BOT_PROFILE must be form or chaos.");
  return profile;
}

async function runPlayer(execute, profileName) {
  const settings = config();
  const { reader, writer, account } = clients(execute, settings.network);
  const profile = playerBotProfile(profileName);
  const disclosedAddress = account?.address ?? process.env.GENLAYER_BOT_ADDRESS ?? "not configured";
  const state = await readState(reader, settings, account?.address);
  const stakeGen = process.env.GENLAYER_BOT_STAKE_GEN ?? "1";
  if (!/^\d+(\.\d{1,18})?$/.test(stakeGen)) throw new Error("GENLAYER_BOT_STAKE_GEN must be a positive decimal.");
  const [whole, fraction = ""] = stakeGen.split(".");
  const stake = BigInt(whole) * ONE_GEN + BigInt((fraction + "0".repeat(18)).slice(0, 18));
  const roundMinimum = BigInt(state.round?.minimum_stake ?? ONE_GEN);
  const roundMaximum = BigInt(state.round?.maximum_stake ?? 100n * ONE_GEN);
  if (stake < roundMinimum || stake > roundMaximum) {
    throw new Error(`Player bot stake must be within this round's ${roundMinimum}–${roundMaximum} wei range.`);
  }

  const plan = {
    mode: "DISCLOSED_PLAYER_BOT",
    network: settings.network,
    profile: profileName,
    label: profile.label,
    strategy: profile.strategy,
    address: disclosedAddress,
    roundId: settings.roundId,
    stakeWei: stake,
    momentIds: profile.momentIds,
    packedGrid: packMomentIds(profile.momentIds),
    existingEntry: Boolean(state.entry && Object.keys(state.entry).length),
    execute,
  };
  console.log(json(plan));
  if (!execute) return plan;
  if (plan.existingEntry) return plan;
  if (state.round?.status !== "OPEN") throw new Error(`Round is ${state.round?.status ?? "unavailable"}; bot entry refused.`);
  if (Date.now() >= Date.parse(state.round.lock_at)) throw new Error("Round lock has passed; bot entry refused.");
  await submit(reader, writer, settings.gameAddress, "join_round", [settings.roundId, plan.packedGrid], stake);
  const verified = await readState(reader, settings, account.address);
  if (!verified.entry || Object.keys(verified.entry).length === 0) throw new Error("Bot entry was not readable after acceptance.");
  console.log(json({ verifiedEntry: verified.entry, round: verified.round }));
  return verified;
}

async function runKeeper(execute) {
  const settings = config();
  const { reader, writer, account } = clients(execute, settings.network);
  const state = await readState(reader, settings);
  const decision = decideKeeperAction(state.round, state.resolution);
  console.log(json({
    mode: "KEEPER",
    network: settings.network,
    keeperAddress: account?.address ?? process.env.GENLAYER_BOT_ADDRESS ?? "not configured",
    roundId: settings.roundId,
    roundStatus: state.round?.status,
    resolutionStatus: state.resolution?.status,
    decision,
    execute,
  }));
  if (!execute || decision.action === KeeperAction.WAIT) return decision;
  const operations = {
    [KeeperAction.RESOLVE]: [settings.resolverAddress, "resolve_round", [settings.roundId]],
    [KeeperAction.DISPATCH]: [settings.resolverAddress, "dispatch_resolution", [settings.roundId]],
    [KeeperAction.PROCESS]: [settings.gameAddress, "process_settlement", [settings.roundId, 100]],
    [KeeperAction.REFUND]: [settings.gameAddress, "activate_refunds", [settings.roundId]],
  };
  const operation = operations[decision.action];
  if (!operation) throw new Error(`Unsupported keeper action ${decision.action}.`);
  await submit(reader, writer, ...operation);
  console.log(json(await readState(reader, settings)));
  return decision;
}

export async function main(args = process.argv.slice(2)) {
  const mode = args.find((value) => !value.startsWith("--")) ?? "keeper";
  const execute = args.includes("--execute");
  const profileName = args.find((value) => value.startsWith("--profile="))?.split("=")[1]
    ?? process.env.GENLAYER_BOT_PROFILE
    ?? "form";
  if (execute && process.env.ALLOW_GENLAYER_BOTS !== "true" && process.env.ALLOW_GENLAYER_TESTNET_BOTS !== "true") {
    throw new Error("Set ALLOW_GENLAYER_BOTS=true to acknowledge disclosed test-network execution.");
  }
  if (mode === "player") return runPlayer(execute, profileName);
  if (mode === "keeper") return runKeeper(execute);
  throw new Error("Usage: genlayer-bots.mjs <player|keeper> [--profile=form|chaos] [--execute]");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
