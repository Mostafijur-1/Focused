import type { NextRequest } from "next/server";
import { z } from "zod";

import { getAuthService } from "@/features/auth/infrastructure/auth-container";
import { bearerToken } from "@/features/auth/transport/request-security";
import { AppError } from "@/lib/errors/app-error";

export async function goalActor(request: NextRequest) {
  return (await getAuthService().authenticateAccessToken(bearerToken(request)))
    .user;
}

export function resourceId(value: string, pointer = "/id"): string {
  if (z.uuid().safeParse(value).success) return value;
  throw new AppError({
    code: "VALIDATION_ERROR",
    safeMessage: "The resource identifier is invalid.",
    details: { errors: [{ pointer, code: "invalid_uuid" }] },
  });
}

export function optionalUuid(
  value: string | null,
  pointer: string,
): string | undefined {
  if (value === null) return undefined;
  return resourceId(value, pointer);
}
