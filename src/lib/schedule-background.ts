import { after } from "next/server";

/**
 * Run work after the HTTP response is sent (Next.js `after`).
 * Soft-fails if scheduling is unavailable so routes still return.
 */
export function scheduleBackground(work: () => Promise<void> | void): void {
  try {
    after(() => {
      void Promise.resolve()
        .then(work)
        .catch(() => {
          // Background refresh failures must not surface to the client.
        });
    });
  } catch {
    // Outside a request context (tests): run fire-and-forget.
    void Promise.resolve()
      .then(work)
      .catch(() => {});
  }
}
