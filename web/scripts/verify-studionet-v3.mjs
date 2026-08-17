#!/usr/bin/env node

// Read-only verification of the StudioNet V3 game + round resolver deployment.
// No keys or secrets are used: every call is a contract read.

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const GAME_ADDRESS = "0x9f95bDD3E4a2479b8f628599cc672E7a519C0920";
const RESOLVER_ADDRESS = "0xDa0569bE8c8d148D3F2f6Fba5aC00a39bFc64590";
const ROUND_ID = "epl-2026-08-21-arsenal-coventry-studionet-v3";

const client = createClient({ chain: studionet });

function serialize(value) {
  return JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item), 2);
}

async function read(address, functionName, args = []) {
  return client.readContract({ address, functionName, args });
}

async function main() {
  console.log(`network: studionet (chain id ${studionet.id})`);

  const gameVersion = await read(GAME_ADDRESS, "get_version");
  const resolverVersion = await read(RESOLVER_ADDRESS, "get_version");
  console.log(`game ${GAME_ADDRESS} version: ${gameVersion}`);
  console.log(`round resolver ${RESOLVER_ADDRESS} version: ${resolverVersion}`);

  const round = await read(GAME_ADDRESS, "get_round", [ROUND_ID]);
  if (!round || Object.keys(round).length === 0) throw new Error(`Round ${ROUND_ID} is missing on the game contract.`);
  console.log("active round:", serialize(round));

  const resolution = await read(RESOLVER_ADDRESS, "get_round_resolution", [ROUND_ID]);
  console.log("round resolution:", serialize(resolution));

  const pools = [];
  for (let cell = 0; cell < 9; cell += 1) {
    pools.push(await read(GAME_ADDRESS, "get_cell_pool", [ROUND_ID, cell]));
  }
  console.log("cell pools:", serialize(pools));

  const entries = [];
  for (let index = 0; index < Number(round.participant_count); index += 1) {
    entries.push(await read(GAME_ADDRESS, "get_entry_by_index", [ROUND_ID, index]));
  }
  console.log("entries:", serialize(entries));
}

main().catch((error) => {
  console.error("verification failed:", error);
  process.exit(1);
});
