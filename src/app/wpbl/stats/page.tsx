import { Suspense } from "react";

import { WpblStatsClient } from "@/components/wpbl/WpblStatsClient";

export default function WpblStatsPage() {
  return (
    <Suspense
      fallback={<p className="mt-8 text-sm text-[var(--wpbl-muted)]">Loading…</p>}
    >
      <WpblStatsClient />
    </Suspense>
  );
}
