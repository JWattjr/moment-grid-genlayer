import type { Metadata } from "next";
import { Coins, Grid3X3, LockKeyhole, Scale, ShieldCheck, Trophy } from "lucide-react";
import { PrototypeShell } from "@/components/prototype-shell";

export const metadata: Metadata = {
  title: "How to play — Moment Grid",
  description: "The exact Moment Grid rules in five quick steps.",
};

const STEPS = [
  { n: "01", title: "Build nine calls", copy: "Fill every cell. Columns cover 0–30′, 30–60′, and 60–90+′. Each row uses its own rarity pool.", icon: Grid3X3 },
  { n: "02", title: "Stake and lock", copy: "Stake from 1 GEN and commit all nine calls before the round locks. Your packed grid is stored on-chain.", icon: LockKeyhole },
  { n: "03", title: "Back nine unique pools", copy: "At 1 GEN: each Common pool receives 0.05, each Medium pool 0.10, each Rare pool 0.15, while 0.05 funds the jackpot and 0.05 is the protocol fee. Winners split only their cell's loser-funded pool.", icon: Coins },
  { n: "04", title: "Resolve the evidence", copy: "GenLayer validators compare distinct registered publishers. A call without complete evidence coverage is refunded rather than guessed FALSE.", icon: Scale },
  { n: "05", title: "Win pools and jackpot", copy: "Correct calls share each cell pool. Complete a horizontal row plus a diagonal to share the jackpot.", icon: Trophy },
] as const;

export default function RulesPage() {
  return (
    <PrototypeShell eyebrow="Rules · 90 second read" title="Call. Lock. Reveal." intro="Prediction bingo for a full football match. Simple enough to understand before kickoff, tense enough to watch for 90 minutes.">
      <section className="rules-grid-demo" aria-label="Three by three grid with winning lines">
        {Array.from({ length: 9 }, (_, cell) => <i className={cell === 0 || cell === 4 || cell === 8 ? "is-line" : ""} key={cell}>{cell === 0 || cell === 4 || cell === 8 ? "✓" : "·"}</i>)}
        <span>8 possible lines</span>
      </section>

      <section className="rules-list">
        {STEPS.map(({ n, title, copy, icon: Icon }) => (
          <article key={n}>
            <span>{n}</span>
            <div className="rule-icon"><Icon size={17} /></div>
            <div><strong>{title}</strong><p>{copy}</p></div>
          </article>
        ))}
      </section>

      <section className="winning-rule"><Trophy size={18} /><div><span>Jackpot rule</span><strong>Complete a horizontal row and a diagonal.</strong><p>Qualifiers share the jackpot in proportion to their gross stake. With no qualifier, the jackpot rolls into the next round.</p></div></section>

      <section className="chain-native-rule">
        <header><ShieldCheck size={18} /><div><span>Why GenLayer</span><strong>Public evidence needs shared judgment.</strong></div></header>
        <p>Validators independently compare public sources. Supported calls settle TRUE or FALSE; unsupported evidence coverage refunds the affected pool stake.</p>
        <div><span><Scale size={14} /> Consensus resolves the moment</span><i>→</i><span><Grid3X3 size={14} /> Pure code scores every grid</span></div>
      </section>
    </PrototypeShell>
  );
}
