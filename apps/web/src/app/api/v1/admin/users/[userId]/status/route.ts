import type { NextRequest } from "next/server";

import { getAdminService } from "@/features/admin/infrastructure/admin-container";
import {
  adminContext,
  adminStepUpToken,
  assertAdminMutationOrigin,
} from "@/features/admin/transport/admin-route";
import { changeAdminUserStatusSchema } from "@/features/admin/transport/admin-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function PATCH(
  request: NextRequest,
  route: { params: Promise<{ userId: string }> },
) {
  return handleApiRoute(
    request,
    async (requestId) => {
      assertAdminMutationOrigin(request);
      const [context, body, params] = await Promise.all([
        adminContext(request),
        parseJson(request, changeAdminUserStatusSchema),
        route.params,
      ]);
      return apiSuccess(
        {
          data: await getAdminService().changeUserStatus(context, {
            ...body,
            targetUserId: params.userId,
            stepUpToken: adminStepUpToken(request),
          }),
        },
        requestId,
      );
    },
    "Admin status change failed",
  );
}
