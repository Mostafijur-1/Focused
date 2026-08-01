import type { NextRequest } from "next/server";

import { getAuthService } from "@/features/auth/infrastructure/auth-container";
import {
  assertTrustedOrigin,
  bearerToken,
  requestSecurityContext,
} from "@/features/auth/transport/request-security";
import { getServerEnvironment } from "@/lib/config/server-env";
import { AppError } from "@/lib/errors/app-error";

export async function adminContext(request: NextRequest) {
  const actor = await getAuthService().authenticateAccessToken(
    bearerToken(request),
  );
  return { actor, request: requestSecurityContext(request) };
}

export function assertAdminMutationOrigin(request: NextRequest): void {
  assertTrustedOrigin(request, getServerEnvironment().NEXT_PUBLIC_APP_URL);
}

export function adminStepUpToken(request: NextRequest): string {
  const token = request.headers.get("x-admin-step-up")?.trim();
  if (!token) {
    throw new AppError({
      code: "FORBIDDEN",
      safeMessage: "A fresh step-up grant is required.",
      details: { reason: "step_up_required" },
    });
  }
  return token;
}
