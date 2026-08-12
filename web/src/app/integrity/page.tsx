import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, Database, ExternalLink, Scale, ShieldCheck } from "lucide-react";
import { PrototypeShell } from "@/components/prototype-shell";

export const metadata: Metadata = { title: "Integrity — Moment Grid", description: "How Moment Grid protects entries and settles match evidence." };

export default function IntegrityPage() {
  return <PrototypeShell eyebrow="Trust model" title="Know what decides your payout." intro="The frontend previews the match. Only finalized contract state decides marks, claims, refunds, and jackpot eligibility.">
    <section className="rules-list">
      <article><span>01</span><div className="rule-icon"><Database size={17} /></div><div><strong>Immutable entry</strong><p>Your nine choices and gross stake are stored on-chain after transaction finalization.</p></div></article>
      <article><span>02</span><div className="rule-icon"><BookOpenCheck size={17} /></div><div><strong>Distinct public publishers</strong><p>The resolver fetches at least two allow-listed publishers and treats their page content as untrusted evidence.</p></div></article>
      <article><span>03</span><div className="rule-icon"><Scale size={17} /></div><div><strong>Independent validator agreement</strong><p>Leader and validators independently derive truth and evidence-coverage bitmaps. Material disagreement prevents settlement.</p></div></article>
      <article><span>04</span><div className="rule-icon"><ShieldCheck size={17} /></div><div><strong>Recovery by design</strong><p>Underfilled, unresolved, or timed-out scoring rounds can enter full-refund mode permissionlessly.</p></div></article>
    </section>
    <section className="proof-links" aria-label="Public verification links">
      <Link href="/genlayer"><ShieldCheck size={15} /><span><strong>Inspect live consensus</strong><small>Settled TRUE and FALSE records from the reusable Studionet resolver.</small></span></Link>
      <a href="https://github.com/JWattjr/moment-grid-genlayer" target="_blank" rel="noreferrer"><ExternalLink size={15} /><span><strong>Review source and receipts</strong><small>Contracts, 46 direct tests, deployment manifests, and operating runbooks.</small></span></a>
    </section>
    <div className="prototype-note"><ShieldCheck size={15} /><span>Moment Grid V2 is testnet software, not an audited mainnet gambling product. Contract source, test vectors, and deployment records are public in the repository.</span></div>
  </PrototypeShell>;
}
