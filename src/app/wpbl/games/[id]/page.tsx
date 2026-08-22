import { Suspense } from "react";

import { GameDetailClient } from "@/components/wpbl/GameDetailClient";

export default async function WpblGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense fallback={<p className="mt-8 text-sm text-slate-500">Loading…</p>}>
      <GameDetailClient gameId={id} />
    </Suspense>
  );
}
