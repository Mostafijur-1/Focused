import type { NextRequest } from "next/server";

import { getAuthService } from "@/features/auth/infrastructure/auth-container";
import { bearerToken } from "@/features/auth/transport/request-security";
import { getDashboardService } from "@/features/dashboard/infrastructure/dashboard-container";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute } from "@/lib/http/api-route";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const startedAt = performance.now();
      const actor = await getAuthService().authenticateAccessToken(
        bearerToken(request),
      );
      const snapshot = await getDashboardService().getSnapshot(actor.user);
      logger.info("Dashboard projection served", {
        requestId,
        freshness: snapshot.freshness,
        degradationCount: snapshot.degradations.length,
        durationMilliseconds: Math.round(performance.now() - startedAt),
      });
      const response = apiSuccess({ data: snapshot }, requestId);
      response.headers.set("cache-control", "private, no-store");
      response.headers.set("vary", "authorization");
      return response;
    },
    "Dashboard request failed",
  );
}
