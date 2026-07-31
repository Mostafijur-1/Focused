import type { NextResponse } from "next/server";

import type { IssuedSession } from "@/features/auth/domain/auth-types";

import { csrfCookieName, refreshCookieName } from "./request-security";

export function setSessionCookies(
  response: NextResponse,
  session: IssuedSession,
  production: boolean,
): void {
  response.cookies.set(refreshCookieName, session.refreshToken, {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/api/v1/auth",
    expires: session.refreshTokenExpiresAt,
    priority: "high",
  });
  response.cookies.set(csrfCookieName, session.csrfToken, {
    httpOnly: false,
    secure: production,
    sameSite: "strict",
    path: "/",
    expires: session.refreshTokenExpiresAt,
    priority: "high",
  });
}

export function clearSessionCookies(
  response: NextResponse,
  production: boolean,
): void {
  response.cookies.set(refreshCookieName, "", {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge: 0,
  });
  response.cookies.set(csrfCookieName, "", {
    httpOnly: false,
    secure: production,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
