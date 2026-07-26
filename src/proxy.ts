import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Serve /radar at the root of radar.theclingans.com. */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (
    host.startsWith("radar.theclingans.com") &&
    request.nextUrl.pathname === "/"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/radar";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
