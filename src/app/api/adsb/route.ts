const ADSB_BASE = "https://api.adsb.lol/v2";
const FETCH_TIMEOUT_MS = 8_000;

function parseNumber(value: string | null): number | null {
  if (value == null || value.trim() === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampRadiusNm(radiusNm: number): number {
  if (radiusNm < 1) {
    return 1;
  }
  if (radiusNm > 250) {
    return 250;
  }
  return radiusNm;
}

/**
 * Thin browser-facing proxy for adsb.lol (no CORS on upstream).
 * Does not cache — mirrors firmware's direct poll pattern.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseNumber(searchParams.get("lat"));
  const lon = parseNumber(searchParams.get("lon"));
  const distRaw = parseNumber(searchParams.get("dist"));

  if (lat == null || lon == null) {
    return Response.json(
      { error: "missing or invalid lat/lon" },
      { status: 400 },
    );
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return Response.json({ error: "lat/lon out of range" }, { status: 400 });
  }

  const dist = clampRadiusNm(distRaw ?? 25);
  const url = `${ADSB_BASE}/lat/${lat}/lon/${lon}/dist/${dist}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return Response.json(
        { error: `adsb upstream ${upstream.status}` },
        { status: 502 },
      );
    }

    const body = await upstream.text();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "adsb proxy failed";
    return Response.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
