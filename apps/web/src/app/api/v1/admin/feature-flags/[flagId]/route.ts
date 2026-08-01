import type { NextRequest } from "next/server";

import { getAdminService } from "@/features/admin/infrastructure/admin-container";
import {
  adminContext,
  adminStepUpToken,
  assertAdminMutationOrigin,
} from "@/features/admin/transport/admin-route";
import { updateAdminFeatureFlagSchema } from "@/features/admin/transport/admin-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function PATCH(
  request: NextRequest,
  route: { params: Promise<{ flagId: string }> },
) {
  return handleApiRoute(
    request,
    async (requestId) => {
      assertAdminMutationOrigin(request);
      const [context, body, params] = await Promise.all([
        adminContext(request),
        parseJson(request, updateAdminFeatureFlagSchema),
        route.params,
      ]);
      const { reviewAt, expiresAt, ...command } = body;
      return apiSuccess(
        {
          data: await getAdminService().updateFeatureFlag(context, {
            ...command,
            flagId: params.flagId,
            stepUpToken: adminStepUpToken(request),
            ...(reviewAt ? { reviewAt: new Date(reviewAt) } : {}),
            ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
          }),
        },
        requestId,
      );
    },
    "Admin Feature Flag update failed",
  );
}
