import type { NextRequest } from "next/server";

import { getAdminService } from "@/features/admin/infrastructure/admin-container";
import { adminContext } from "@/features/admin/transport/admin-route";
import { auditQuerySchema } from "@/features/admin/transport/admin-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const context = await adminContext(request);
      const query = auditQuerySchema.parse(
        Object.fromEntries(request.nextUrl.searchParams),
      );
      const response = apiSuccess(
        {
          data: await getAdminService().listAuditEvents(context, query.caseId, {
            ...(query.cursor ? { cursor: query.cursor } : {}),
            limit: query.limit,
          }),
        },
        requestId,
      );
      response.headers.set("vary", "authorization");
      return response;
    },
    "Admin audit list failed",
  );
}
