"use client";

import Link from "next/link";
import { ReceiptText, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { formatGen, genLayerGameConfig, readGameEntry, readGameRounds, type GameEntryRecord, type GameRoundRecord } from "@/lib/genlayer-game";
import { useOnchainGame } from "@/lib/use-onchain-game";

type Position = { round: GameRoundRecord; entry: GameEntryRecord };

export function EntriesClient() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const wrongNetwork = Boolean(address && chainId !== genLayerGameConfig.chainId);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!address || wrongNetwork) return;
    let active = true;
    const frame = window.requestAnimationFrame(() => setLoading(true));
    void readGameRounds().then(async (rounds) => {
      const records = await Promise.all(rounds.map(async (round) => ({ round, entry: await readGameEntry(address, round.round_id) })));
      if (active) setPositions(records.filter((value): value is Position => Boolean(value.entry)));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; window.cancelAnimationFrame(frame); };
  }, [address, wrongNetwork]);

  if (!address) return <div className="prototype-note"><ReceiptText size={15} />Connect the wallet that entered a round to recover its position and claim path.</div>;
  if (wrongNetwork) return <div className="prototype-note"><ReceiptText size={15} /><span>Moment Grid entries live on {genLayerGameConfig.networkLabel}. Switch networks to read this wallet&apos;s positions.</span><button className="primary-button" onClick={() => switchChain({ chainId: genLayerGameConfig.chainId })}>Switch to {genLayerGameConfig.networkLabel}</button></div>;
  if (loading) return <div className="prototype-note">Reading your on-chain entries…</div>;
  if (!positions.length) return <div className="prototype-note">No entries were found for this wallet.</div>;
  return <section className="round-list">{positions.map(({ round }) => <PositionCard key={round.round_id} roundId={round.round_id} />)}</section>;
}

function PositionCard({ roundId }: { roundId: string }) {
  const game = useOnchainGame(roundId);
  const { round, entry } = game;
  if (!round || !entry) return null;
  const canClaim = !entry.claimed && entry.claimable > 0n && ["SETTLED", "REFUNDING"].includes(round.status);
  return <article className="round-list-card">
    <header><span>{round.status}</span><b>{round.match_id}</b></header>
    <dl>
      <div><dt>Stake</dt><dd>{formatGen(entry.stake_amount)} GEN</dd></div>
      <div><dt>Claimable</dt><dd>{formatGen(entry.claimable)} GEN</dd></div>
      <div><dt>Lines</dt><dd>{String(entry.completed_lines)}</dd></div>
      <div><dt>Jackpot</dt><dd>{entry.jackpot_qualified ? "Qualified" : "No"}</dd></div>
    </dl>
    {canClaim && <button className="primary-button" onClick={() => void game.claim()} disabled={game.busy}>Claim {formatGen(entry.claimable)} GEN</button>}
    {entry.claimed && <p><ShieldCheck size={13} /> Claim completed on-chain.</p>}
    <Link href={`/?round=${encodeURIComponent(roundId)}`}>Open committed grid</Link>
    {game.transactionHash && <small>{game.transactionHash.slice(0, 12)}… · {game.transactionStage}</small>}
    {game.error && <p className="error-message">{game.error}</p>}
  </article>;
}
