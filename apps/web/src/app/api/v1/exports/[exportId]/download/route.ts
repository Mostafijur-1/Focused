import type { NextRequest } from "next/server";

import { getAnalyticsService } from "@/features/analytics/infrastructure/analytics-container";
import {
  analyticsActor,
  analyticsIdentifier,
} from "@/features/analytics/transport/analytics-route";
import { handleApiRoute } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ exportId: string }> },
) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, params] = await Promise.all([
        analyticsActor(request),
        context.params,
      ]);
      const data = await getAnalyticsService().downloadExport(
        actor,
        analyticsIdentifier(params.exportId, "/exportId"),
      );
      return new Response(data.content, {
        headers: {
          "cache-control": "private, no-store",
          "content-disposition": `attachment; filename="${data.fileName}"`,
          "content-type": data.contentType,
          "x-content-sha256": data.checksum,
          "x-request-id": requestId,
          "x-content-type-options": "nosniff",
        },
      });
    },
    "Export download failed",
  );
}
