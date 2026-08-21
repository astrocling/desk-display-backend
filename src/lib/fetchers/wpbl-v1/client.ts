export const WPBL_API_BASE = "https://stats.womensprobaseballleague.com";

export async function fetchWpblJson<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${WPBL_API_BASE}${path}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`WPBL ${path} failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
