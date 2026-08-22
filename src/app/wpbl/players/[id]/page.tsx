import { PlayerDetailClient } from "@/components/wpbl/PlayerDetailClient";

export default async function WpblPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <PlayerDetailClient playerId={id} />;
}
