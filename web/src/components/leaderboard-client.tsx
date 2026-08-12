"use client";

import { Crown, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { genLayerGameConfig, readGameRound, readRoundEntries, type GameEntryRecord } from "@/lib/genlayer-game";

function short(address?: string) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Unknown";
}

function hits(mask: bigint) {
  let count = 0;
  for (let cell = 0; cell < 9; cell += 1) if ((mask & (1n << BigInt(cell))) !== 0n) count += 1;
  return count;
}

export function LeaderboardClient() {
  const [entries, setEntries] = useState<GameEntryRecord[]>([]);
  const [status, setStatus] = useState("Reading the active round…");
  useEffect(() => {
    void readGameRound().then(async (round) => {
      if (!round) { setStatus("No active contract round is configured."); return; }
      if (round.status !== "SETTLED") { setStatus(`Standings unlock after settlement. Current state: ${round.status}.`); return; }
      try {
        const records = await readRoundEntries(round.round_id, round.participant_count);
        records.sort((a, b) => Number(b.completed_lines - a.completed_lines) || hits(b.marked_mask) - hits(a.marked_mask));
        setEntries(records);
        setStatus(records.length ? "" : "No entries in this round.");
      } catch {
        setStatus("The current legacy round does not expose indexable entries. Deploy V2 to activate verified standings.");
      }
    }).catch(() => setStatus("Unable to read leaderboard state from Bradbury."));
  }, []);

  if (!genLayerGameConfig.activeRoundEnabled || status) return <div className="prototype-note"><Trophy size={15} />{status || "Leaderboard is not configured."}</div>;
  return <>
    <section className="podium" aria-label="Top three players">
      {entries.slice(0, 3).map((entry, index) => <div className={`podium-place place-${index + 1}`} key={entry.player}><Crown size={15} /><span>0{index + 1}</span><strong>{short(entry.player)}</strong><b>{String(entry.completed_lines)} lines</b></div>)}
    </section>
    <section className="rank-card">
      <header><span>Rank</span><span>Player</span><span>Lines</span><span>Hits</span></header>
      {entries.map((entry, index) => <div key={entry.player}><b>#{String(index + 1).padStart(2, "0")}</b><strong>{short(entry.player)}</strong><span>{String(entry.completed_lines)}</span><span>{hits(entry.marked_mask)}/9</span></div>)}
    </section>
  </>;
}
