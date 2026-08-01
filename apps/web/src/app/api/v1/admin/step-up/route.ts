import type { NextRequest } from "next/server";

import { getAdminSecurityService } from "@/features/admin/infrastructure/admin-container";
import {
  adminContext,
  assertAdminMutationOrigin,
} from "@/features/admin/transport/admin-route";
import { createAdminStepUpSchema } from "@/features/admin/transport/admin-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      assertAdminMutationOrigin(request);
      const [context, body] = await Promise.all([
        adminContext(request),
        parseJson(request, createAdminStepUpSchema),
      ]);
      return apiSuccess(
        { data: await getAdminSecurityService().grantStepUp(context, body) },
        requestId,
        { status: 201 },
      );
    },
    "Admin step-up failed",
  );
}
