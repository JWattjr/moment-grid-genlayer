import type { Metadata } from "next";
import { Grid3X3, LockKeyhole, Scale, ShieldCheck, Trophy } from "lucide-react";
import { PrototypeShell } from "@/components/prototype-shell";

export const metadata: Metadata = {
  title: "How to play — Moment Grid",
  description: "The exact Moment Grid rules in five quick steps.",
};

const STEPS = [
  { n: "01", title: "Build nine calls", copy: "Fill every cell. Columns cover 0–30′, 30–60′, and 60–90+′. Each row uses its own rarity pool.", icon: Grid3X3 },
  { n: "02", title: "Lock the grid", copy: "Commit to all nine calls before the replay starts. The locked grid becomes the fixed scoring input.", icon: LockKeyhole },
  { n: "03", title: "Resolve the evidence", copy: "GenLayer validators evaluate the registered football criterion against public match sources.", icon: Scale },
  { n: "04", title: "Complete lines", copy: "A marked row, column, or diagonal is a line. There are eight possible lines and every line scores equally.", icon: Trophy },
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

      <section className="winning-rule"><Trophy size={18} /><div><span>Scoring rule</span><strong>Most completed lines leads.</strong><p>No multipliers and no per-line weighting. The same deterministic rule applies to every grid.</p></div></section>

      <section className="chain-native-rule">
        <header><ShieldCheck size={18} /><div><span>Why GenLayer</span><strong>Public evidence needs shared judgment.</strong></div></header>
        <p>Validators compare independent match sources and finalize TRUE, FALSE, or INVALID with a structured evidence record.</p>
        <div><span><Scale size={14} /> Consensus resolves the moment</span><i>→</i><span><Grid3X3 size={14} /> Pure code scores every grid</span></div>
      </section>
    </PrototypeShell>
  );
}
