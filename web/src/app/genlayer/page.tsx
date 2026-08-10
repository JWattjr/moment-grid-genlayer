import type { Metadata } from "next";
import { GenLayerDemo } from "@/components/genlayer-demo";
import { PrototypeShell } from "@/components/prototype-shell";

export const metadata: Metadata = {
  title: "Live GenLayer proof — Moment Grid",
  description: "Inspect real MatchMomentResolver consensus state and its deterministic Moment Grid scoring impact.",
};

export default function GenLayerDemoPage() {
  return (
    <PrototypeShell eyebrow="Reviewer mode · Live Studionet" title="See consensus settle the grid." intro="Real football evidence becomes one auditable TRUE, FALSE, or retryable INVALID result—then ordinary code scores the cell.">
      <GenLayerDemo />
    </PrototypeShell>
  );
}
