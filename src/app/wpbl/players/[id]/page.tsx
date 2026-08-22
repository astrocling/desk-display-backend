import { PlayerDetailClient } from "@/components/wpbl/PlayerDetailClient";
import { wpblPlayerKey } from "@/lib/config";
import { getRedis } from "@/lib/redis";
import type { WpblPlayerDetailResponse } from "@/lib/types/wpbl-display";

async function readCachedPlayer(
  id: string,
): Promise<WpblPlayerDetailResponse | null> {
  try {
    return await getRedis().get<WpblPlayerDetailResponse>(wpblPlayerKey(id));
  } catch {
    return null;
  }
}

export default async function WpblPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialData = await readCachedPlayer(id);

  return <PlayerDetailClient key={id} playerId={id} initialData={initialData} />;
}
