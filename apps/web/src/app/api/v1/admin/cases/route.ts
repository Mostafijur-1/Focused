import type { NextRequest } from "next/server";

import { getAdminService } from "@/features/admin/infrastructure/admin-container";
import { adminContext } from "@/features/admin/transport/admin-route";
import { openAdminCaseSchema } from "@/features/admin/transport/admin-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const context = await adminContext(request);
      return privateResponse(
        apiSuccess(
          { data: await getAdminService().listCases(context) },
          requestId,
        ),
      );
    },
    "Admin case list failed",
  );
}

export function POST(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [context, body] = await Promise.all([
        adminContext(request),
        parseJson(request, openAdminCaseSchema),
      ]);
      return privateResponse(
        apiSuccess(
          { data: await getAdminService().openCase(context, body) },
          requestId,
          { status: 201 },
        ),
      );
    },
    "Admin case creation failed",
  );
}

function privateResponse(response: Response): Response {
  response.headers.set("vary", "authorization");
  return response;
}
