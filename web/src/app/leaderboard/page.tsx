import type { Metadata } from "next";
import { PrototypeShell } from "@/components/prototype-shell";
import { LeaderboardClient } from "@/components/leaderboard-client";

export const metadata: Metadata = { title: "Leaderboard — Moment Grid", description: "Contract-indexed Moment Grid standings." };

export default function LeaderboardPage() {
  return <PrototypeShell eyebrow="Verified standings" title="Best calls lead." intro="No sample wallets: ranks come from indexed entries after validator-agreed settlement."><LeaderboardClient /></PrototypeShell>;
}
