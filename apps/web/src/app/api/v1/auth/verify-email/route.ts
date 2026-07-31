import type { NextRequest } from "next/server";

import { getAuthService } from "@/features/auth/infrastructure/auth-container";
import {
  handleAuthRoute,
  parseJson,
} from "@/features/auth/transport/auth-route";
import { oneTimeTokenRequestSchema } from "@/features/auth/transport/auth-schemas";
import { requestSecurityContext } from "@/features/auth/transport/request-security";
import { apiSuccess } from "@/lib/http/api-response";

export const runtime = "nodejs";

export function POST(request: NextRequest) {
  return handleAuthRoute(request, async (requestId) => {
    const { token } = await parseJson(request, oneTimeTokenRequestSchema);
    return apiSuccess(
      await getAuthService().verifyEmail(
        token,
        requestSecurityContext(request),
      ),
      requestId,
    );
  });
}
