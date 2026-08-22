/** Branded subdomain → app path. */
export function brandPathForHost(host: string): "/radar" | "/wpbl" | null {
  if (host.startsWith("radar.theclingans.com")) return "/radar";
  if (host.startsWith("wpbl.theclingans.com")) return "/wpbl";
  return null;
}

/** Root favicon / apple-touch fallbacks browsers request without reading page metadata. */
export function iconRewritePath(
  brandPath: "/radar" | "/wpbl",
  pathname: string,
): string | null {
  if (pathname === "/favicon.ico" || pathname === "/icon") {
    return `${brandPath}/icon`;
  }
  if (
    pathname === "/apple-icon" ||
    pathname === "/apple-icon.png" ||
    pathname === "/apple-touch-icon" ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/apple-touch-icon-precomposed.png"
  ) {
    return `${brandPath}/apple-icon`;
  }
  return null;
}

/** Path to rewrite for a branded host, or null when the request should pass through. */
export function brandedSubdomainRewrite(
  host: string,
  pathname: string,
): string | null {
  const brandPath = brandPathForHost(host);
  if (!brandPath) return null;
  if (pathname === "/") return brandPath;
  return iconRewritePath(brandPath, pathname);
}
