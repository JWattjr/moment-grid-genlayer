"use client";

import Link from "next/link";
import { CalendarClock, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { formatGen, genLayerGameConfig, isDisclosedTestBot, readGameRounds, readRoundEntries, type GameRoundRecord } from "@/lib/genlayer-game";

type RoundWithBotCount = { round: GameRoundRecord; testBotCount: number };

export function RoundsClient() {
  const [rounds, setRounds] = useState<RoundWithBotCount[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    void readGameRounds().then(async (records) => Promise.all(records.map(async (round) => {
      const entries = await readRoundEntries(round.round_id, round.participant_count);
      return { round, testBotCount: entries.filter((entry) => isDisclosedTestBot(entry.player)).length };
    }))).then(setRounds).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load rounds."));
  }, []);

  if (!genLayerGameConfig.enabled) return <div className="prototype-note">The V2 Bradbury contracts are not configured yet.</div>;
  return (
    <section className="round-list" aria-live="polite">
      {error && <p className="error-message">{error}</p>}
      {!error && rounds.length === 0 && <div className="prototype-note">Reading on-chain rounds…</div>}
      {rounds.map(({ round, testBotCount }) => (
        <article className="round-list-card" key={round.round_id}>
          <header><span>{round.round_id.startsWith("qa-") ? "QA REHEARSAL" : round.status}</span><b>{round.match_id}</b></header>
          <p>{round.round_id}</p>
          <dl>
            <div><dt><Users size={13} /> Entries</dt><dd>{String(round.participant_count)}</dd></div>
            <div><dt><ShieldCheck size={13} /> Jackpot</dt><dd>{formatGen(round.jackpot_pool)} GEN</dd></div>
            <div><dt><CalendarClock size={13} /> Locks</dt><dd>{new Date(round.lock_at).toLocaleString()}</dd></div>
          </dl>
          <div className="liquidity-progress"><i style={{ width: `${liquidityPercent(round)}%` }} /></div>
          <small>{round.liquidity_ready === undefined ? "Legacy V1 round · view-only until V2 migration." : round.liquidity_ready === false ? `Needs ${String(round.minimum_participants ?? 2n)} players and ${String(round.minimum_unique_grids ?? 2n)} unique grids or every stake is refundable.` : "Liquidity gate met."}</small>
          {round.round_id.startsWith("qa-") && <small><b>Controlled lifecycle rehearsal:</b> both entries are test wallets. This tests settlement or timeout refund—not public or organic liquidity.</small>}
          {testBotCount > 0 && <small><b>Disclosed testnet liquidity:</b> {testBotCount} fixed-grid Test Bot. It is not presented as a human player.</small>}
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
