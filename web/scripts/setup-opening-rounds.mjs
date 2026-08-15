#!/usr/bin/env node

import { createRequire } from "node:module";
import { join } from "node:path";
import { createAccount, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { CalldataAddress, ExecutionResult, TransactionStatus } from "genlayer-js/types";
import { packMomentIds, PLAYER_BOT_PROFILES } from "./genlayer-bots.mjs";

const GAME_ADDRESS = "0x4bff4e5b50E21D25988D8029A7535E8111Eb62eF";
const RESOLVER_ADDRESS = "0x901327a3D6D1d91baa57542bd27eAf336bC604d7";
const OWNER_ADDRESS = "0xdb433ff614bdd1ece21aa97221c3e0a7ecf79c92";
const ACCOUNT_NAME = "moment-grid-studionet";
const ONE_GEN = 1_000_000_000_000_000_000n;

const rounds = [
  {
    roundId: "epl-2026-08-22-hull-man-united-bradbury-v3",
    matchId: "epl-hull-man-united-2026-08-22",
    home: "Hull City",
    away: "Manchester United",
    date: "2026-08-22",
    sources: [
      "https://www.bbc.co.uk/sport/football/scores-fixtures/2026-08-22",
      "https://www.thesportsdb.com/event/2494001-hull-city-vs-manchester-united",
    ],
    lockAt: "2026-08-22T11:15:00Z",
    kickoffAt: "2026-08-22T11:30:00Z",
    resolveNotBefore: "2026-08-22T14:00:00Z",
    refundAt: "2026-08-26T11:30:00Z",
  },
  {
    roundId: "epl-2026-08-23-man-city-bournemouth-bradbury-v3",
    matchId: "epl-man-city-bournemouth-2026-08-23",
    home: "Manchester City",
    away: "AFC Bournemouth",
    date: "2026-08-23",
    sources: [
      "https://www.bbc.co.uk/sport/football/scores-fixtures/2026-08-23",
      "https://www.thesportsdb.com/event/2494006-manchester-city-vs-bournemouth",
    ],
    lockAt: "2026-08-23T13:45:00Z",
    kickoffAt: "2026-08-23T14:00:00Z",
    resolveNotBefore: "2026-08-23T16:30:00Z",
    refundAt: "2026-08-27T14:00:00Z",
  },
  {
    roundId: "epl-2026-08-23-newcastle-liverpool-bradbury-v3",
    matchId: "epl-newcastle-liverpool-2026-08-23",
    home: "Newcastle United",
    away: "Liverpool",
    date: "2026-08-23",
    sources: [
      "https://www.bbc.co.uk/sport/football/scores-fixtures/2026-08-23",
      "https://www.thesportsdb.com/event/2494008-newcastle-united-vs-liverpool",
    ],
    lockAt: "2026-08-23T15:15:00Z",
    kickoffAt: "2026-08-23T15:30:00Z",
    resolveNotBefore: "2026-08-23T18:00:00Z",
    refundAt: "2026-08-27T15:30:00Z",
  },
];

function calldataAddress(value) {
  const bytes = Uint8Array.from(Buffer.from(value.slice(2), "hex"));
  return new CalldataAddress(bytes);
}

function hasRecord(value) {
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
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
    throw new Error(`${functionName} execution failed (${receipt.txExecutionResultName ?? leaderExecution ?? "UNKNOWN"}).`);
  }
  console.log(`${functionName} accepted with successful execution.`);
  return hash;
}

async function unlockedAccount() {
  if (process.env.ALLOW_GENLAYER_ROUND_SETUP !== "true") {
    throw new Error("Set ALLOW_GENLAYER_ROUND_SETUP=true to create testnet rounds.");
  }
  const appData = process.env.APPDATA;
  if (!appData) throw new Error("APPDATA is unavailable; the GenLayer CLI keychain cannot be located.");
  const requireFromCli = createRequire(join(appData, "npm", "node_modules", "genlayer", "package.json"));
  const keytarModule = requireFromCli("keytar");
  const keytar = keytarModule.default ?? keytarModule;
  let privateKey = await keytar.getPassword("genlayer-cli", `account:${ACCOUNT_NAME}`);
  if (!privateKey) throw new Error(`Unlock ${ACCOUNT_NAME} with the GenLayer CLI first.`);
  const account = createAccount(privateKey);
  privateKey = null;
  if (account.address.toLowerCase() !== OWNER_ADDRESS.toLowerCase()) {
    throw new Error("The unlocked account is not the deployed contract owner.");
  }
  return account;
}

async function main() {
  const account = await unlockedAccount();
  const reader = createClient({ chain: testnetBradbury });
  const writer = createClient({ chain: testnetBradbury, account });
  const transactions = {};

  for (const round of rounds) {
    console.log(`\n${round.home} vs ${round.away}`);
    const existingResolution = await reader.readContract({
      address: RESOLVER_ADDRESS,
      functionName: "get_round_resolution",
      args: [round.roundId],
    });
    if (!hasRecord(existingResolution)) {
      transactions[`${round.roundId}:register`] = await submit(reader, writer, RESOLVER_ADDRESS, "register_round", [
        round.roundId,
        round.matchId,
        round.home,
        round.away,
        "English Premier League",
        round.date,
        JSON.stringify(round.sources),
        calldataAddress(GAME_ADDRESS),
        round.roundId,
        round.resolveNotBefore,
        round.refundAt,
      ]);
    } else {
      console.log("Resolver record already exists; skipping registration.");
    }

    const existingRound = await reader.readContract({
      address: GAME_ADDRESS,
      functionName: "get_round",
      args: [round.roundId],
    });
    if (!hasRecord(existingRound)) {
      transactions[`${round.roundId}:create`] = await submit(reader, writer, GAME_ADDRESS, "create_round", [
        round.roundId,
        round.matchId,
        calldataAddress(RESOLVER_ADDRESS),
        round.roundId,
        round.lockAt,
        round.kickoffAt,
        round.resolveNotBefore,
        round.refundAt,
        ONE_GEN,
        2,
        2n * ONE_GEN,
        2,
      ]);
    } else {
      console.log("Game round already exists; skipping creation.");
    }

    const existingEntry = await reader.readContract({
      address: GAME_ADDRESS,
      functionName: "get_entry",
      args: [round.roundId, account.address],
    });
    if (!hasRecord(existingEntry)) {
      transactions[`${round.roundId}:seed`] = await submit(
        reader,
        writer,
        GAME_ADDRESS,
        "join_round",
        [round.roundId, packMomentIds(PLAYER_BOT_PROFILES.form.momentIds)],
        ONE_GEN,
      );
    } else {
      console.log("Form Bot already seeded; skipping entry.");
    }
  }

  console.log("\nOpening rounds ready.");
  console.log(JSON.stringify(transactions, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
