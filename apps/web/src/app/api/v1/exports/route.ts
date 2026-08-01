import type { NextRequest } from "next/server";

import { getAnalyticsService } from "@/features/analytics/infrastructure/analytics-container";
import { analyticsActor } from "@/features/analytics/transport/analytics-route";
import { createExportSchema } from "@/features/analytics/transport/analytics-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const actor = await analyticsActor(request);
      return apiSuccess(
        { data: await getAnalyticsService().listExports(actor) },
        requestId,
      );
    },
    "Export list failed",
  );
}

export function POST(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, body] = await Promise.all([
        analyticsActor(request),
        parseJson(request, createExportSchema),
      ]);
      return apiSuccess(
        {
          data: await getAnalyticsService().createExport(
            actor,
            body.range,
            body.format,
            body.clientCommandId,
          ),
        },
        requestId,
        { status: 201 },
      );
    },
    "Export creation failed",
  );
}
