import type { NextRequest } from "next/server";

import { getAnalyticsService } from "@/features/analytics/infrastructure/analytics-container";
import { analyticsActor } from "@/features/analytics/transport/analytics-route";
import { analyticsQuerySchema } from "@/features/analytics/transport/analytics-schemas";
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
      const actor = await analyticsActor(request);
      const query = analyticsQuerySchema.parse(
        Object.fromEntries(request.nextUrl.searchParams),
      );
      const data = await getAnalyticsService().getAnalytics(actor, {
        ...(query.start ? { start: query.start } : {}),
        ...(query.end ? { end: query.end } : {}),
      });
      logger.info("Analytics projection served", {
        requestId,
        rangeDays: data.range.days,
        freshness: data.freshness,
        durationMilliseconds: Math.round(performance.now() - startedAt),
      });
      const response = apiSuccess({ data }, requestId);
      response.headers.set("cache-control", "private, no-store");
      response.headers.set("vary", "authorization");
      return response;
    },
    "Analytics request failed",
  );
}
