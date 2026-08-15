"use client";

import Link from "next/link";
import { CalendarClock, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { disclosedBotLabel, formatGen, genLayerGameConfig, readGameRounds, readRoundEntries, type GameRoundRecord } from "@/lib/genlayer-game";

type RoundWithBots = { round: GameRoundRecord; botLabels: string[] };

export function RoundsClient() {
  const [rounds, setRounds] = useState<RoundWithBots[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    void readGameRounds().then(async (records) => Promise.all(records.map(async (round) => {
      const entries = await readRoundEntries(round.round_id, round.participant_count);
      return { round, botLabels: entries.flatMap((entry) => disclosedBotLabel(entry.player) ?? []) };
    }))).then(setRounds).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load rounds."));
  }, []);

  if (!genLayerGameConfig.enabled) return <div className="prototype-note">The active GenLayer game contracts are not configured yet.</div>;
  return (
    <section className="round-list" aria-live="polite">
      {error && <p className="error-message">{error}</p>}
      {!error && rounds.length === 0 && <div className="prototype-note">Reading on-chain rounds…</div>}
      {rounds.map(({ round, botLabels }) => (
        <article className="round-list-card" key={round.round_id}>
          <header><span>{round.round_id.startsWith("qa-") ? "QA REHEARSAL" : round.status}</span><b>{round.match_id}</b></header>
          <p>{round.round_id}</p>
          <dl>
            <div><dt><Users size={13} /> Entries</dt><dd>{String(round.participant_count)}</dd></div>
            <div><dt><ShieldCheck size={13} /> Jackpot</dt><dd>{formatGen(round.jackpot_pool)} GEN</dd></div>
            <div><dt><CalendarClock size={13} /> Locks</dt><dd>{new Date(round.lock_at).toLocaleString()}</dd></div>
          </dl>
          <div className="liquidity-progress"><i style={{ width: `${liquidityPercent(round)}%` }} /></div>
          <small>{round.liquidity_ready === undefined ? "Legacy round · view-only until migration." : round.liquidity_ready === false ? `Needs ${String(round.minimum_participants ?? 2n)} players and ${String(round.minimum_unique_grids ?? 2n)} unique grids or every stake is refundable.` : "Liquidity gate met."}</small>
          {round.round_id.startsWith("qa-") && <small><b>Controlled lifecycle rehearsal:</b> both entries are test wallets. This tests settlement or timeout refund—not public or organic liquidity.</small>}
          {botLabels.length > 0 && <small><b>Disclosed automated opponents:</b> {botLabels.join(" + ")}. Their fixed grids were committed before public play and they are excluded from human rankings.</small>}
          <Link className="primary-button" href={`/?round=${encodeURIComponent(round.round_id)}`}>{round.status === "OPEN" ? "Open round" : "View position"}</Link>
        </article>
      ))}
    </section>
  );
}

function liquidityPercent(round: GameRoundRecord): number {
  const participants = BigInt(round.participant_count ?? 0);
  const minimum = BigInt(round.minimum_participants ?? 2);
  return Math.min(100, Number(participants * 100n / (minimum || 1n)));
}
