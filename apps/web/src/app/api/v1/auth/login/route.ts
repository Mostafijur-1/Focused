import type { NextRequest } from "next/server";

import { getAuthService } from "@/features/auth/infrastructure/auth-container";
import {
  handleAuthRoute,
  parseJson,
} from "@/features/auth/transport/auth-route";
import { loginRequestSchema } from "@/features/auth/transport/auth-schemas";
import { requestSecurityContext } from "@/features/auth/transport/request-security";
import { sessionResponse } from "@/features/auth/transport/session-response";

export const runtime = "nodejs";

export function POST(request: NextRequest) {
  return handleAuthRoute(request, async (requestId) => {
    const input = await parseJson(request, loginRequestSchema);
    const session = await getAuthService().login({
      email: input.email,
      password: input.password,
      context: requestSecurityContext(request, input.deviceName),
    });
    return sessionResponse(session, requestId);
  });
}
