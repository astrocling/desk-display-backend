import { Suspense } from "react";

import { GameDetailClient } from "@/components/wpbl/GameDetailClient";
import { wpblGameKey } from "@/lib/config";
import { normalizeWpblGameDetail } from "@/lib/fetchers/wpbl-v1/normalize-game-detail";
import { getRedis } from "@/lib/redis";
import type { WpblGameDetailResponse } from "@/lib/types/wpbl-display";

async function readCachedGame(
  id: string,
): Promise<WpblGameDetailResponse | null> {
  try {
    const blob = await getRedis().get<WpblGameDetailResponse>(wpblGameKey(id));
    return blob ? normalizeWpblGameDetail(blob) : null;
  } catch {
    return null;
  }
}

export default async function WpblGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialData = await readCachedGame(id);

  return (
    <Suspense fallback={<p className="mt-8 text-sm text-slate-500">Loading…</p>}>
      <GameDetailClient key={id} gameId={id} initialData={initialData} />
    </Suspense>
  );
}
