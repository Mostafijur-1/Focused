import type { NextRequest } from "next/server";

import { getAdminService } from "@/features/admin/infrastructure/admin-container";
import { adminContext } from "@/features/admin/transport/admin-route";
import { caseBoundQuerySchema } from "@/features/admin/transport/admin-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const context = await adminContext(request);
      const query = caseBoundQuerySchema.parse(
        Object.fromEntries(request.nextUrl.searchParams),
      );
      return apiSuccess(
        { data: await getAdminService().listJobs(context, query.caseId) },
        requestId,
      );
    },
    "Admin job list failed",
  );
}
