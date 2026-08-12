import type { Metadata } from "next";
import { Clock3, Coins, Hand, ShieldCheck } from "lucide-react";
import { PrototypeShell } from "@/components/prototype-shell";

export const metadata: Metadata = { title: "Responsible play — Moment Grid", description: "Testnet limits and safer-play guidance for Moment Grid." };

export default function ResponsiblePlayPage() {
  return <PrototypeShell eyebrow="Before you commit" title="Keep play intentional." intro="Moment Grid currently uses testnet GEN, which has no promised cash value. These controls remain mandatory before any real-value launch.">
    <section className="rules-list">
      <article><span>01</span><div className="rule-icon"><Coins size={17} /></div><div><strong>Set a round budget</strong><p>Assume the full gross stake can be lost. Never stake money needed for bills, savings, or debt.</p></div></article>
      <article><span>02</span><div className="rule-icon"><Clock3 size={17} /></div><div><strong>Take a break</strong><p>Do not chase a loss by immediately entering another round. Results are independent and payouts are not guaranteed.</p></div></article>
      <article><span>03</span><div className="rule-icon"><Hand size={17} /></div><div><strong>Stop when it is not fun</strong><p>Disconnect your wallet and step away if play causes stress, secrecy, or financial pressure.</p></div></article>
      <article><span>04</span><div className="rule-icon"><ShieldCheck size={17} /></div><div><strong>Age and location rules apply</strong><p>Do not use a real-value version where prediction games are restricted or if you are under the legal age in your location.</p></div></article>
    </section>
    <div className="prototype-note">Mainnet launch remains blocked on jurisdiction-specific legal review, age gating, self-exclusion, deposit limits, independent security audit, and incident response.</div>
  </PrototypeShell>;
}
