import type { NextRequest } from "next/server";

import { getAuthService } from "@/features/auth/infrastructure/auth-container";
import { handleAuthRoute } from "@/features/auth/transport/auth-route";
import {
  assertCsrf,
  assertTrustedOrigin,
  refreshCookieName,
  requestSecurityContext,
} from "@/features/auth/transport/request-security";
import { sessionResponse } from "@/features/auth/transport/session-response";
import { getServerEnvironment } from "@/lib/config/server-env";
import { AppError } from "@/lib/errors/app-error";

export const runtime = "nodejs";

export function POST(request: NextRequest) {
  return handleAuthRoute(request, async (requestId) => {
    assertTrustedOrigin(
      request,
      new URL(getServerEnvironment().NEXT_PUBLIC_APP_URL).origin,
    );
    assertCsrf(request);
    const refreshToken = request.cookies.get(refreshCookieName)?.value;
    if (!refreshToken) {
      throw new AppError({
        code: "AUTH_INVALID_CREDENTIALS",
        safeMessage: "The credentials or session are not valid.",
      });
    }
    const session = await getAuthService().refresh(
      refreshToken,
      requestSecurityContext(request),
    );
    return sessionResponse(session, requestId);
  });
}
