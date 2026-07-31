import type { NextRequest } from "next/server";

import { getAuthService } from "@/features/auth/infrastructure/auth-container";
import { handleAuthRoute } from "@/features/auth/transport/auth-route";
import {
  bearerToken,
  requestSecurityContext,
} from "@/features/auth/transport/request-security";
import { apiSuccess } from "@/lib/http/api-response";

export const runtime = "nodejs";

export function POST(request: NextRequest) {
  return handleAuthRoute(request, async (requestId) => {
    const service = getAuthService();
    const actor = await service.authenticateAccessToken(bearerToken(request));
    const revoked = await service.revokeOtherSessions(
      actor,
      requestSecurityContext(request),
    );
    return apiSuccess({ revoked }, requestId);
  });
}
