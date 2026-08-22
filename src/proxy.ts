import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { brandedSubdomainRewrite } from "@/lib/branded-subdomain";

/** Serve app routes (and brand icons) at the root of branded subdomains. */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const rewriteTo = brandedSubdomainRewrite(host, request.nextUrl.pathname);
  if (!rewriteTo) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = rewriteTo;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/",
    "/favicon.ico",
    "/icon",
    "/apple-icon",
    "/apple-icon.png",
    "/apple-touch-icon",
    "/apple-touch-icon.png",
    "/apple-touch-icon-precomposed.png",
  ],
};
