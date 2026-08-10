"use client";

import { PredictionId } from "@moment-grid/scoring";
import { useCallback, useState } from "react";
import { useAccount } from "wagmi";
import {
  genLayerResolverConfig,
  readConfiguredResolution,
  requireRegisteredResolution,
  resolveConfiguredResolution,
  type GenLayerProvider,
  type ResolverRecord,
} from "./genlayer-resolver";

export type GenLayerResolutionPhase =
  | "IDLE"
  | "CHECKING"
  | "READY"
  | "SUBMITTED"
  | "ACCEPTED"
  | "SETTLED"
  | "ERROR";

export function useGenLayerResolution() {
  const { address, connector } = useAccount();
  const [record, setRecord] = useState<ResolverRecord | null>(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<GenLayerResolutionPhase>("IDLE");
  const [transactionHash, setTransactionHash] = useState<`0x${string}` | null>(null);

  const usesConfiguredMoment = useCallback((grid: PredictionId[]) => {
    const predictionId = genLayerResolverConfig.moment?.prediction_id as PredictionId | undefined;
    return Boolean(predictionId && grid.includes(predictionId));
  }, []);

  const lock = useCallback(async (grid: PredictionId[]): Promise<boolean> => {
    if (!genLayerResolverConfig.enabled || !usesConfiguredMoment(grid)) return true;
    setPhase("CHECKING");
    setError("");
    try {
      const registered = await requireRegisteredResolution();
      setRecord(registered);
      setPhase(registered.status === "SETTLED" ? "SETTLED" : "READY");
      return true;
    } catch (caught) {
      setPhase("ERROR");
      setError(caught instanceof Error ? caught.message : "GenLayer registration check failed.");
      return false;
    }
  }, [usesConfiguredMoment]);

  const resolve = useCallback(async (grid: PredictionId[]): Promise<boolean> => {
    if (!genLayerResolverConfig.enabled || !usesConfiguredMoment(grid)) return true;
    const existing = await readConfiguredResolution().catch(() => null);
    if (existing?.status === "SETTLED") {
      setRecord(existing);
      setPhase("SETTLED");
      setError("");
      return true;
    }
    if (!address) {
      setPhase("ERROR");
      setError("Connect a wallet to trigger this permissionless GenLayer resolution.");
      return false;
    }

    setError("");
    try {
      const provider = await connector?.getProvider();
      if (!provider) throw new Error("The connected wallet did not expose a signing provider.");
      const resolved = await resolveConfiguredResolution(
        address,
        provider as GenLayerProvider,
        (nextPhase, hash) => {
          setTransactionHash(hash);
          setPhase(nextPhase);
        },
      );
      setRecord(resolved.record);
      if (resolved.hash) setTransactionHash(resolved.hash);
      setPhase("SETTLED");
      return true;
    } catch (caught) {
      const latest = await readConfiguredResolution().catch(() => null);
      if (latest) setRecord(latest);
      setPhase("ERROR");
      setError(caught instanceof Error ? caught.message : "GenLayer resolution failed.");
      return false;
    }
  }, [address, connector, usesConfiguredMoment]);

  return {
    configured: genLayerResolverConfig.enabled,
    record,
    error,
    phase,
    transactionHash,
    busy: ["CHECKING", "SUBMITTED", "ACCEPTED"].includes(phase),
    lock,
    resolve,
  };
}
