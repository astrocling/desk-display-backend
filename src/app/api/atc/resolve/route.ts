import {
  getFeedById,
  liveAtcListenUrl,
  liveAtcPlsUrl,
  liveAtcStreamUrls,
} from "@/lib/atc/feeds";

/**
 * Resolve an allowlisted LiveATC mount to playback URLs.
 * Returns HTTPS Icecast stream URLs for HTML5 <audio> (iframe is blocked
 * by LiveATC X-Frame-Options: SAMEORIGIN).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const feedId = searchParams.get("feed")?.trim() ?? "";

  if (!feedId) {
    return Response.json(
      { error: "missing or invalid feed" },
      { status: 400 },
    );
  }

  const feed = getFeedById(feedId);
  if (!feed) {
    return Response.json({ error: "unknown feed" }, { status: 404 });
  }

  const streamUrls = liveAtcStreamUrls(feed.id);

  return Response.json(
    {
      feed,
      streamUrl: streamUrls[0],
      streamUrls,
      listenUrl: liveAtcListenUrl(feed.id),
      plsUrl: liveAtcPlsUrl(feed.id),
      playback: "audio" as const,
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
