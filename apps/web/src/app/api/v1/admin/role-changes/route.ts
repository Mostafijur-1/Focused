import type { NextRequest } from "next/server";

import { getAdminService } from "@/features/admin/infrastructure/admin-container";
import {
  adminContext,
  adminStepUpToken,
  assertAdminMutationOrigin,
} from "@/features/admin/transport/admin-route";
import {
  caseBoundQuerySchema,
  requestRoleChangeSchema,
} from "@/features/admin/transport/admin-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

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
        { data: await getAdminService().listApprovals(context, query.caseId) },
        requestId,
      );
    },
    "Admin role approval list failed",
  );
}

export function POST(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      assertAdminMutationOrigin(request);
      const [context, body] = await Promise.all([
        adminContext(request),
        parseJson(request, requestRoleChangeSchema),
      ]);
      const { expiresAt, ...command } = body;
      return apiSuccess(
        {
          data: await getAdminService().requestRoleChange(context, {
            ...command,
            stepUpToken: adminStepUpToken(request),
            ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
          }),
        },
        requestId,
        { status: 201 },
      );
    },
    "Admin role change request failed",
  );
}
