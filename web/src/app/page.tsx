import { GameShell } from "@/components/game-shell";

export default async function Home({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const { round } = await searchParams;
  return <GameShell roundId={round} />;
}
