"use client";

import type { PredictionId } from "@moment-grid/scoring";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import {
  claimGamePayout,
  enterGameRound,
  genLayerGameConfig,
  parseStake,
  processGameSettlement,
  readGameEntry,
  readGameRound,
  resolveGameRound,
  type GameEntryRecord,
  type GameRoundRecord,
} from "./genlayer-game";
import type { GenLayerProvider } from "./genlayer-resolver";

export type OnchainGameAction = "IDLE" | "ENTERING" | "RESOLVING" | "PROCESSING" | "CLAIMING" | "ACCEPTED" | "ERROR";

export function useOnchainGame() {
  const { address, connector } = useAccount();
  const [round, setRound] = useState<GameRoundRecord | null>(null);
  const [entry, setEntry] = useState<GameEntryRecord | null>(null);
  const [action, setAction] = useState<OnchainGameAction>("IDLE");
  const [error, setError] = useState("");
  const [transactionHash, setTransactionHash] = useState<`0x${string}` | null>(null);

  const refresh = useCallback(async () => {
    if (!genLayerGameConfig.enabled) return;
    const [nextRound, nextEntry] = await Promise.all([
      readGameRound(),
      address ? readGameEntry(address) : Promise.resolve(null),
    ]);
    setRound(nextRound);
    setEntry(nextEntry);
  }, [address]);

  useEffect(() => {
    if (!genLayerGameConfig.enabled) return;
    let active = true;
    void Promise.all([
      readGameRound(),
      address ? readGameEntry(address) : Promise.resolve(null),
    ]).then(([nextRound, nextEntry]) => {
      if (!active) return;
      setRound(nextRound);
      setEntry(nextEntry);
    }).catch((caught) => {
      if (!active) return;
      setError(caught instanceof Error ? caught.message : "Unable to read the Bradbury game round.");
    });
    return () => { active = false; };
  }, [address]);

  const provider = useCallback(async (): Promise<GenLayerProvider> => {
    if (!address) throw new Error("Connect a wallet before signing the on-chain entry.");
    const nextProvider = await connector?.getProvider();
    if (!nextProvider) throw new Error("The connected wallet did not expose a signing provider.");
    return nextProvider as GenLayerProvider;
  }, [address, connector]);

  const run = useCallback(async (
    nextAction: Exclude<OnchainGameAction, "IDLE" | "ACCEPTED" | "ERROR">,
    operation: (account: `0x${string}`, signingProvider: GenLayerProvider) => Promise<`0x${string}`>,
  ): Promise<boolean> => {
    setAction(nextAction);
    setError("");
    try {
      if (!address) throw new Error("Connect a wallet before signing the on-chain transaction.");
      const hash = await operation(address, await provider());
      setTransactionHash(hash);
      setAction("ACCEPTED");
      await refresh();
      return true;
    } catch (caught) {
      setAction("ERROR");
      setError(caught instanceof Error ? caught.message : "The GenLayer transaction failed.");
      return false;
    }
  }, [address, provider, refresh]);

  const enter = useCallback(async (grid: PredictionId[], stakeInput: string) => {
    let stake: bigint;
    try {
      stake = parseStake(stakeInput);
    } catch (caught) {
      setAction("ERROR");
      setError(caught instanceof Error ? caught.message : "The stake amount is invalid.");
      return false;
    }
    return run("ENTERING", (account, signingProvider) => (
      enterGameRound(account, signingProvider, grid, stake)
    ));
  }, [run]);

  return {
    configured: genLayerGameConfig.enabled,
    config: genLayerGameConfig,
    round,
    entry,
    action,
    error,
    transactionHash,
    busy: ["ENTERING", "RESOLVING", "PROCESSING", "CLAIMING"].includes(action),
    refresh,
    enter,
    resolve: () => run("RESOLVING", resolveGameRound),
    process: () => run("PROCESSING", processGameSettlement),
    claim: () => run("CLAIMING", claimGamePayout),
  };
}
