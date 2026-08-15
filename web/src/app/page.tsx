import { GameShell } from "@/components/game-shell";

export default async function Home({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const { round } = await searchParams;
  return <GameShell key={round ?? "default-round"} roundId={round} />;
}
