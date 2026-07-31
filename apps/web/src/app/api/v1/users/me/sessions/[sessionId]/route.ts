import type { NextRequest } from "next/server";

import { getAuthService } from "@/features/auth/infrastructure/auth-container";
import { handleAuthRoute } from "@/features/auth/transport/auth-route";
import { sessionIdSchema } from "@/features/auth/transport/auth-schemas";
import {
  bearerToken,
  requestSecurityContext,
} from "@/features/auth/transport/request-security";
import { AppError } from "@/lib/errors/app-error";
import { apiSuccess } from "@/lib/http/api-response";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ readonly sessionId: string }>;
}

export function DELETE(request: NextRequest, context: RouteContext) {
  return handleAuthRoute(request, async (requestId) => {
    const parsed = sessionIdSchema.safeParse((await context.params).sessionId);
    if (!parsed.success) {
      throw new AppError({
        code: "NOT_FOUND",
        safeMessage: "Session not found.",
      });
    }
    const service = getAuthService();
    const actor = await service.authenticateAccessToken(bearerToken(request));
    const revoked = await service.revokeSession(
      actor,
      parsed.data,
      requestSecurityContext(request),
    );
    if (!revoked) {
      throw new AppError({
        code: "NOT_FOUND",
        safeMessage: "Session not found.",
      });
    }
    return apiSuccess({ revoked: true }, requestId);
  });
}
