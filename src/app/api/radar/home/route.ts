/** Dayton-area defaults matching firmware kRadarHomeLat/Lon. */
const DEFAULT_HOME = { lat: 40.03353, lon: -84.19588 };

/**
 * Public home center for the web radar fixture.
 * Uses HOME_LAT / HOME_LON when set; otherwise Dayton defaults.
 */
export async function GET() {
  const latRaw = process.env.HOME_LAT;
  const lonRaw = process.env.HOME_LON;
  const lat = latRaw != null ? Number(latRaw) : NaN;
  const lon = lonRaw != null ? Number(lonRaw) : NaN;

  if (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  ) {
    return Response.json(
      { lat, lon, source: "env" as const },
      {
        headers: {
          "Cache-Control": "public, max-age=3600",
        },
      },
    );
  }

  return Response.json(
    { ...DEFAULT_HOME, source: "default" as const },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
