import type { Metadata } from "next";
import { EntriesClient } from "@/components/entries-client";
import { PrototypeShell } from "@/components/prototype-shell";

export const metadata: Metadata = { title: "My entries — Moment Grid", description: "Recover and claim every Moment Grid position held by your wallet." };

export default function EntriesPage() {
  return <PrototypeShell eyebrow="Wallet positions" title="Your entries survive the replay." intro="Return at any time to see what is pending, refundable, settled, or ready to claim."><EntriesClient /></PrototypeShell>;
}
