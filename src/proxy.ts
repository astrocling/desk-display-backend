import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Serve app routes at the root of branded subdomains. */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (request.nextUrl.pathname !== "/") {
    return NextResponse.next();
  }

  let pathname: string | null = null;
  if (host.startsWith("radar.theclingans.com")) {
    pathname = "/radar";
  } else if (host.startsWith("wpbl.theclingans.com")) {
    pathname = "/wpbl";
  }

  if (pathname) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
