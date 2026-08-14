"use client";

import type { PredictionId } from "@moment-grid/scoring";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import {
  activateGameRefunds,
  claimGamePayout,
  dispatchGameResolution,
  enterGameRound,
  genLayerGameConfig,
  parseStake,
  processGameSettlement,
  readCellPools,
  readGameEntry,
  readGameRound,
  readGameRoundResolution,
  resolveGameRound,
  type GameCellPool,
  type GameEntryRecord,
  type GameRoundRecord,
  type GameRoundResolutionRecord,
} from "./genlayer-game";
import type { GenLayerProvider } from "./genlayer-resolver";

export type OnchainGameAction = "IDLE" | "ENTERING" | "RESOLVING" | "DISPATCHING" | "PROCESSING" | "REFUNDING" | "CLAIMING" | "FINALIZED" | "ERROR";
export type TransactionStage = "IDLE" | "SUBMITTED" | "FINALIZING" | "FINALIZED" | "FAILED";
type Operation = (account: `0x${string}`, provider: GenLayerProvider, onSubmitted: (hash: `0x${string}`) => void) => Promise<`0x${string}`>;

export function useOnchainGame(selectedRoundId = genLayerGameConfig.roundId) {
  const { address, connector } = useAccount();
  const [round, setRound] = useState<GameRoundRecord | null>(null);
  const [entry, setEntry] = useState<GameEntryRecord | null>(null);
  const [resolution, setResolution] = useState<GameRoundResolutionRecord | null>(null);
  const [pools, setPools] = useState<GameCellPool[]>([]);
  const [action, setAction] = useState<OnchainGameAction>("IDLE");
  const [transactionStage, setTransactionStage] = useState<TransactionStage>("IDLE");
  const [error, setError] = useState("");
  const [transactionHash, setTransactionHash] = useState<`0x${string}` | null>(null);

  const refresh = useCallback(async () => {
    if (!genLayerGameConfig.enabled || !selectedRoundId) return;
    const [nextRound, nextEntry, nextPools, nextResolution] = await Promise.all([
      readGameRound(selectedRoundId),
      address ? readGameEntry(address, selectedRoundId) : Promise.resolve(null),
      readCellPools(selectedRoundId),
      readGameRoundResolution(selectedRoundId),
    ]);
    setRound(nextRound);
    setEntry(nextEntry);
    setPools(nextPools);
    setResolution(nextResolution);
  }, [address, selectedRoundId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        await refresh();
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to read the on-chain game round.");
      }
    };
    void load();
    // One refresh reads the round, resolver, wallet entry, and all nine cell
    // pools. StudioNet currently permits roughly 30 requests per minute, so a
    // one-minute cadence keeps the complete audit view below that boundary.
    const timer = window.setInterval(() => void load(), 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [refresh]);

  const provider = useCallback(async (): Promise<GenLayerProvider> => {
    if (!address) throw new Error("Connect a wallet before signing the on-chain transaction.");
    const nextProvider = await connector?.getProvider();
    if (!nextProvider) throw new Error("The connected wallet did not expose a signing provider.");
    return nextProvider as GenLayerProvider;
  }, [address, connector]);

  const run = useCallback(async (
    nextAction: Exclude<OnchainGameAction, "IDLE" | "FINALIZED" | "ERROR">,
    operation: Operation,
  ): Promise<boolean> => {
    setAction(nextAction);
    setTransactionStage("IDLE");
    setError("");
    try {
      if (!address) throw new Error("Connect a wallet before signing the on-chain transaction.");
      const hash = await operation(address, await provider(), (submittedHash) => {
        setTransactionHash(submittedHash);
        setTransactionStage("SUBMITTED");
        window.setTimeout(() => setTransactionStage((stage) => stage === "SUBMITTED" ? "FINALIZING" : stage), 700);
      });
      setTransactionHash(hash);
      setTransactionStage("FINALIZED");
      setAction("FINALIZED");
      await refresh();
      return true;
    } catch (caught) {
      setAction("ERROR");
      setTransactionStage("FAILED");
      setError(caught instanceof Error ? caught.message : "The GenLayer transaction failed.");
      return false;
    }
  }, [address, provider, refresh]);

  const enter = useCallback(async (grid: PredictionId[], stakeInput: string) => {
    try {
      const stake = parseStake(stakeInput, round?.minimum_stake, round?.maximum_stake);
      return run("ENTERING", (account, signingProvider, onSubmitted) => (
        enterGameRound(account, signingProvider, grid, stake, selectedRoundId, onSubmitted)
      ));
    } catch (caught) {
      setAction("ERROR");
      setTransactionStage("FAILED");
      setError(caught instanceof Error ? caught.message : "The stake amount is invalid.");
      return false;
    }
  }, [round, run, selectedRoundId]);

  const resolutionId = round?.resolver_resolution_id ?? selectedRoundId;
  return {
    configured: genLayerGameConfig.activeRoundEnabled && Boolean(selectedRoundId),
    config: { ...genLayerGameConfig, roundId: selectedRoundId },
    round,
    entry,
    resolution,
    pools,
    action,
    transactionStage,
    error,
    transactionHash,
    busy: ["ENTERING", "RESOLVING", "DISPATCHING", "PROCESSING", "REFUNDING", "CLAIMING"].includes(action),
    refresh,
    enter,
    resolve: () => run("RESOLVING", (account, signingProvider, onSubmitted) => resolveGameRound(account, signingProvider, resolutionId, onSubmitted)),
    dispatch: () => run("DISPATCHING", (account, signingProvider, onSubmitted) => dispatchGameResolution(account, signingProvider, resolutionId, onSubmitted)),
    process: () => run("PROCESSING", (account, signingProvider, onSubmitted) => processGameSettlement(account, signingProvider, selectedRoundId, onSubmitted)),
    activateRefunds: () => run("REFUNDING", (account, signingProvider, onSubmitted) => activateGameRefunds(account, signingProvider, selectedRoundId, onSubmitted)),
    claim: () => run("CLAIMING", (account, signingProvider, onSubmitted) => claimGamePayout(account, signingProvider, selectedRoundId, onSubmitted)),
  };
}
