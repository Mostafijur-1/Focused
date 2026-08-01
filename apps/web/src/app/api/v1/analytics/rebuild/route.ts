import type { NextRequest } from "next/server";

import { getAnalyticsService } from "@/features/analytics/infrastructure/analytics-container";
import { analyticsActor } from "@/features/analytics/transport/analytics-route";
import { analyticsRangeSchema } from "@/features/analytics/transport/analytics-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, range] = await Promise.all([
        analyticsActor(request),
        parseJson(request, analyticsRangeSchema),
      ]);
      return apiSuccess(
        { data: await getAnalyticsService().rebuild(actor, range) },
        requestId,
      );
    },
    "Analytics rebuild failed",
  );
}
