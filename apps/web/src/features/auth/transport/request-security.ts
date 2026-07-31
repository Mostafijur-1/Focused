import { createHash, timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import type { RequestSecurityContext } from "@/features/auth/domain/auth-types";
import { AppError } from "@/lib/errors/app-error";
import { getRequestId } from "@/lib/http/request-context";

export const refreshCookieName = "focused_refresh";
export const csrfCookieName = "focused_csrf";
export const csrfHeaderName = "x-csrf-token";

export function oauthStateCookieName(provider: string): string {
  return `focused_oauth_${provider}`;
}

export function assertOAuthState(
  expected: string | undefined,
  received: string,
): void {
  if (!expected || !safeEqual(expected, received)) {
    throw new AppError({
      code: "AUTH_INVALID_CREDENTIALS",
      safeMessage: "The OAuth transaction is invalid or has expired.",
    });
  }
}

export function requestSecurityContext(
  request: NextRequest,
  deviceName?: string,
): RequestSecurityContext {
  const userAgent = request.headers.get("user-agent");
  return {
    requestId: getRequestId(request.headers),
    ipPrefix: anonymizeIp(
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    ),
    userAgentHash: userAgent ? digest(userAgent) : null,
    deviceName: deviceName?.trim() || inferDeviceName(userAgent),
  };
}

export function assertTrustedOrigin(
  request: NextRequest,
  allowedOrigin: string,
): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== allowedOrigin) {
    throw new AppError({
      code: "FORBIDDEN",
      safeMessage: "The request origin is not allowed.",
    });
  }
}

export function assertCsrf(request: NextRequest): void {
  const cookieToken = request.cookies.get(csrfCookieName)?.value;
  const headerToken = request.headers.get(csrfHeaderName);
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    throw new AppError({
      code: "FORBIDDEN",
      safeMessage:
        "The security token is invalid. Refresh the page and try again.",
    });
  }
}

export function bearerToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError({
      code: "UNAUTHORIZED",
      safeMessage: "Authentication is required.",
    });
  }
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    throw new AppError({
      code: "UNAUTHORIZED",
      safeMessage: "Authentication is required.",
    });
  }
  return token;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function anonymizeIp(ip: string | undefined): string | null {
  if (!ip) return null;
  if (ip.includes(".")) {
    const segments = ip.split(".");
    return segments.length === 4
      ? `${segments.slice(0, 3).join(".")}.0/24`
      : null;
  }
  if (ip.includes(":")) {
    return `${ip.split(":").slice(0, 4).join(":")}::/64`;
  }
  return null;
}

function inferDeviceName(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const browser = /Edg\//u.test(userAgent)
    ? "Edge"
    : /Firefox\//u.test(userAgent)
      ? "Firefox"
      : /Chrome\//u.test(userAgent)
        ? "Chrome"
        : /Safari\//u.test(userAgent)
          ? "Safari"
          : "Browser";
  const platform = /Android/u.test(userAgent)
    ? "Android"
    : /iPhone|iPad/u.test(userAgent)
      ? "iOS"
      : /Windows/u.test(userAgent)
        ? "Windows"
        : /Mac OS/u.test(userAgent)
          ? "macOS"
          : /Linux/u.test(userAgent)
            ? "Linux"
            : "device";
  return `${browser} on ${platform}`;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
