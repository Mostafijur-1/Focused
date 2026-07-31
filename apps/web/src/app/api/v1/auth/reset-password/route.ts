import type { NextRequest } from "next/server";

import { getAuthService } from "@/features/auth/infrastructure/auth-container";
import {
  handleAuthRoute,
  parseJson,
} from "@/features/auth/transport/auth-route";
import { resetPasswordRequestSchema } from "@/features/auth/transport/auth-schemas";
import { requestSecurityContext } from "@/features/auth/transport/request-security";
import { apiSuccess } from "@/lib/http/api-response";

export const runtime = "nodejs";

export function POST(request: NextRequest) {
  return handleAuthRoute(request, async (requestId) => {
    const input = await parseJson(request, resetPasswordRequestSchema);
    return apiSuccess(
      await getAuthService().resetPassword(
        input.token,
        input.password,
        requestSecurityContext(request),
      ),
      requestId,
    );
  });
}
