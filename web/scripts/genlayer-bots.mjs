#!/usr/bin/env node

import { createAccount, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import { pathToFileURL } from "node:url";
import { decideKeeperAction, KeeperAction } from "./keeper-policy.mjs";

const DEFAULT_GAME = "0x1D87C32c1A0D65C083ce322608D284E5767b8408";
const DEFAULT_RESOLVER = "0x0aeBC87aBa11CA67945A73BcbC66AEEAA0D828FB";
const DEFAULT_ROUND = "epl-2026-08-21-arsenal-coventry-v2";
const TESTNET_CHAIN_ID = 4221;
const ONE_GEN = 1_000_000_000_000_000_000n;

// A fixed, public grid using the third option in every cell. A disclosed test
// bot must be predictable and auditable, not optimized against human entries.
export const TEST_BOT_MOMENT_IDS = Object.freeze([3, 6, 9, 12, 15, 18, 21, 24, 27]);

function packMomentIds(momentIds) {
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
  const gameAddress = process.env.GENLAYER_GAME_ADDRESS ?? process.env.NEXT_PUBLIC_GENLAYER_GAME_ADDRESS ?? DEFAULT_GAME;
  const resolverAddress = process.env.GENLAYER_ROUND_RESOLVER_ADDRESS ?? process.env.NEXT_PUBLIC_GENLAYER_ROUND_RESOLVER_ADDRESS ?? DEFAULT_RESOLVER;
  const roundId = process.env.GENLAYER_GAME_ROUND_ID ?? process.env.NEXT_PUBLIC_GENLAYER_GAME_ROUND_ID ?? DEFAULT_ROUND;
  return { gameAddress, resolverAddress, roundId };
}

function clients(requireSigner) {
  if (testnetBradbury.id !== TESTNET_CHAIN_ID) throw new Error("Testnet chain definition changed; refusing to run bots.");
  const reader = createClient({ chain: testnetBradbury });
  if (!requireSigner) return { reader, writer: null, account: null };
  const privateKey = process.env.GENLAYER_BOT_PRIVATE_KEY?.trim();
  if (!privateKey?.match(/^0x[0-9a-fA-F]{64}$/)) {
    throw new Error("GENLAYER_BOT_PRIVATE_KEY must be supplied through a secret store for execution.");
  }
  const account = createAccount(privateKey);
  const writer = createClient({ chain: testnetBradbury, account });
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
  if (receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    throw new Error(`${functionName} was accepted but execution failed (${receipt.txExecutionResultName}).`);
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

async function runPlayer(execute) {
  const settings = config();
  const { reader, writer, account } = clients(execute);
  const disclosedAddress = account?.address ?? process.env.GENLAYER_BOT_ADDRESS ?? "not configured";
  const state = await readState(reader, settings, account?.address);
  const stakeGen = process.env.GENLAYER_BOT_STAKE_GEN ?? "10";
  if (!/^\d+(\.\d{1,18})?$/.test(stakeGen)) throw new Error("GENLAYER_BOT_STAKE_GEN must be a positive decimal.");
  const [whole, fraction = ""] = stakeGen.split(".");
  const stake = BigInt(whole) * ONE_GEN + BigInt((fraction + "0".repeat(18)).slice(0, 18));
  if (stake < 10n * ONE_GEN || stake > 100n * ONE_GEN) throw new Error("Test bot stake must be 10–100 GEN.");

  const plan = {
    mode: "TESTNET_PLAYER",
    network: "testnet-bradbury",
    address: disclosedAddress,
    roundId: settings.roundId,
    stakeWei: stake,
    momentIds: TEST_BOT_MOMENT_IDS,
    packedGrid: packMomentIds(TEST_BOT_MOMENT_IDS),
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
  const { reader, writer, account } = clients(execute);
  const state = await readState(reader, settings);
  const decision = decideKeeperAction(state.round, state.resolution);
  console.log(json({
    mode: "KEEPER",
    network: "testnet-bradbury",
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
  if (execute && process.env.ALLOW_GENLAYER_TESTNET_BOTS !== "true") {
    throw new Error("Set ALLOW_GENLAYER_TESTNET_BOTS=true to acknowledge testnet-only execution.");
  }
  if (mode === "player") return runPlayer(execute);
  if (mode === "keeper") return runKeeper(execute);
  throw new Error("Usage: genlayer-bots.mjs <player|keeper> [--execute]");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
