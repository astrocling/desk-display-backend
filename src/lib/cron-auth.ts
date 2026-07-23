import { NextResponse } from "next/server";

import { getConfig } from "@/lib/config";

export function isCronAuthorized(request: Request): boolean {
  const { cronSecret } = getConfig();
  const authorization = request.headers.get("authorization");

  return authorization === `Bearer ${cronSecret}`;
}

export function authorizeCron(request: Request): NextResponse | null {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
