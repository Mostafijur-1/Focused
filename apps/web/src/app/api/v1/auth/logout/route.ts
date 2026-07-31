import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getAuthService } from "@/features/auth/infrastructure/auth-container";
import { clearSessionCookies } from "@/features/auth/transport/auth-cookies";
import { handleAuthRoute } from "@/features/auth/transport/auth-route";
import {
  assertCsrf,
  assertTrustedOrigin,
  refreshCookieName,
  requestSecurityContext,
} from "@/features/auth/transport/request-security";
import { getServerEnvironment } from "@/lib/config/server-env";

export const runtime = "nodejs";

export function POST(request: NextRequest) {
  return handleAuthRoute(request, async (requestId) => {
    const environment = getServerEnvironment();
    assertTrustedOrigin(
      request,
      new URL(environment.NEXT_PUBLIC_APP_URL).origin,
    );
    assertCsrf(request);
    const refreshToken = request.cookies.get(refreshCookieName)?.value;
    if (refreshToken) {
      await getAuthService().logout(
        refreshToken,
        requestSecurityContext(request),
      );
    }
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("x-request-id", requestId);
    response.headers.set("cache-control", "no-store");
    clearSessionCookies(response, environment.NODE_ENV === "production");
    return response;
  });
}
