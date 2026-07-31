import { NextResponse } from "next/server";

import type { IssuedSession } from "@/features/auth/domain/auth-types";
import { getServerEnvironment } from "@/lib/config/server-env";

import { setSessionCookies } from "./auth-cookies";

export function sessionResponse(
  session: IssuedSession,
  requestId: string,
): NextResponse {
  const response = NextResponse.json({
    accessToken: session.accessToken,
    tokenType: "Bearer" as const,
    expiresIn: session.accessTokenExpiresInSeconds,
    sessionId: session.sessionId,
    user: session.user,
  });
  response.headers.set("x-request-id", requestId);
  response.headers.set("cache-control", "no-store, private");
  setSessionCookies(
    response,
    session,
    getServerEnvironment().NODE_ENV === "production",
  );
  return response;
}
