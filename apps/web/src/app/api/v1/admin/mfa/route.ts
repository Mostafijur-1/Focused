import type { NextRequest } from "next/server";

import { getAdminSecurityService } from "@/features/admin/infrastructure/admin-container";
import { adminContext } from "@/features/admin/transport/admin-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const context = await adminContext(request);
      const response = apiSuccess(
        { data: await getAdminSecurityService().getMfaState(context) },
        requestId,
      );
      response.headers.set("vary", "authorization");
      return response;
    },
    "Admin MFA state failed",
  );
}
