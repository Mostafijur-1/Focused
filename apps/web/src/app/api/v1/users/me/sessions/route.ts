import type { NextRequest } from "next/server";

import { getAuthService } from "@/features/auth/infrastructure/auth-container";
import { handleAuthRoute } from "@/features/auth/transport/auth-route";
import { bearerToken } from "@/features/auth/transport/request-security";
import { apiSuccess } from "@/lib/http/api-response";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  return handleAuthRoute(request, async (requestId) => {
    const service = getAuthService();
    const actor = await service.authenticateAccessToken(bearerToken(request));
    return apiSuccess({ data: await service.listSessions(actor) }, requestId);
  });
}
