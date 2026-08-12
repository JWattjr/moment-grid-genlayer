import type { Metadata } from "next";
import { PrototypeShell } from "@/components/prototype-shell";
import { RoundsClient } from "@/components/rounds-client";

export const metadata: Metadata = { title: "Rounds — Moment Grid", description: "Live and settled Moment Grid rounds on GenLayer." };

export default function RoundsPage() {
  return <PrototypeShell eyebrow="On-chain lobby" title="Choose the match." intro="Every card is read from the game contract. Underfilled rounds void automatically; no fabricated fixtures or balances."><RoundsClient /></PrototypeShell>;
}
