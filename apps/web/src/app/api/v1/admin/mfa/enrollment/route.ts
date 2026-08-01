import type { NextRequest } from "next/server";

import { getAdminSecurityService } from "@/features/admin/infrastructure/admin-container";
import { adminContext } from "@/features/admin/transport/admin-route";
import { assertAdminMutationOrigin } from "@/features/admin/transport/admin-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      assertAdminMutationOrigin(request);
      const context = await adminContext(request);
      return apiSuccess(
        { data: await getAdminSecurityService().beginMfaEnrollment(context) },
        requestId,
        { status: 201 },
      );
    },
    "Admin MFA enrollment failed",
  );
}
