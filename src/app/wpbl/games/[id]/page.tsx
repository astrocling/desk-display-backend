import { GameDetailClient } from "@/components/wpbl/GameDetailClient";

export default async function WpblGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <GameDetailClient gameId={id} />;
}
