import type { NextRequest } from "next/server";

import { getAdminService } from "@/features/admin/infrastructure/admin-container";
import {
  adminContext,
  adminStepUpToken,
  assertAdminMutationOrigin,
} from "@/features/admin/transport/admin-route";
import { retryAdminJobSchema } from "@/features/admin/transport/admin-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(
  request: NextRequest,
  route: { params: Promise<{ jobId: string }> },
) {
  return handleApiRoute(
    request,
    async (requestId) => {
      assertAdminMutationOrigin(request);
      const [context, body, params] = await Promise.all([
        adminContext(request),
        parseJson(request, retryAdminJobSchema),
        route.params,
      ]);
      return apiSuccess(
        {
          data: await getAdminService().retryJob(context, {
            ...body,
            jobId: params.jobId,
            stepUpToken: adminStepUpToken(request),
          }),
        },
        requestId,
      );
    },
    "Admin job retry failed",
  );
}
