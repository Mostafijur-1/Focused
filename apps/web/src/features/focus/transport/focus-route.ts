import type { NextRequest } from "next/server";
import { z } from "zod";

import { getAuthService } from "@/features/auth/infrastructure/auth-container";
import { bearerToken } from "@/features/auth/transport/request-security";
import { AppError } from "@/lib/errors/app-error";

export async function focusActor(request: NextRequest) {
  return (await getAuthService().authenticateAccessToken(bearerToken(request)))
    .user;
}

export function focusResourceId(value: string): string {
  if (z.uuid().safeParse(value).success) return value;
  throw new AppError({
    code: "VALIDATION_ERROR",
    safeMessage: "The Focus Session identifier is invalid.",
  });
}
