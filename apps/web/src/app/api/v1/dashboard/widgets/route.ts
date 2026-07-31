import type { NextRequest } from "next/server";

import { getAuthService } from "@/features/auth/infrastructure/auth-container";
import { bearerToken } from "@/features/auth/transport/request-security";
import { getDashboardService } from "@/features/dashboard/infrastructure/dashboard-container";
import { updateDashboardWidgetsSchema } from "@/features/dashboard/transport/dashboard-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";

export function PATCH(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const actor = await getAuthService().authenticateAccessToken(
        bearerToken(request),
      );
      const input = await parseJson(request, updateDashboardWidgetsSchema);
      const result = await getDashboardService().updateWidgetLayout(
        actor.user,
        input.widgets,
        input.expectedVersion,
      );
      const response = apiSuccess({ data: result.layout }, requestId);
      response.headers.set("cache-control", "private, no-store");
      response.headers.set("vary", "authorization");
      return response;
    },
    "Dashboard widget update failed",
  );
}
