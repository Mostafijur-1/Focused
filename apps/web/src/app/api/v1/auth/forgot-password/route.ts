import type { NextRequest } from "next/server";

import { getAuthService } from "@/features/auth/infrastructure/auth-container";
import {
  handleAuthRoute,
  parseJson,
} from "@/features/auth/transport/auth-route";
import { forgotPasswordRequestSchema } from "@/features/auth/transport/auth-schemas";
import { requestSecurityContext } from "@/features/auth/transport/request-security";
import { apiSuccess } from "@/lib/http/api-response";

export const runtime = "nodejs";

export function POST(request: NextRequest) {
  return handleAuthRoute(request, async (requestId) => {
    const input = await parseJson(request, forgotPasswordRequestSchema);
    const result = await getAuthService().requestPasswordReset(
      input.email,
      input.locale,
      requestSecurityContext(request),
    );
    return apiSuccess(result, requestId, { status: 202 });
  });
}
