import type { NextRequest } from "next/server";
import { z } from "zod";

import { getAuthService } from "@/features/auth/infrastructure/auth-container";
import { bearerToken } from "@/features/auth/transport/request-security";
import { AppError } from "@/lib/errors/app-error";

export async function analyticsActor(request: NextRequest) {
  const actor = await getAuthService().authenticateAccessToken(
    bearerToken(request),
  );
  return actor.user;
}

export function analyticsQuery(request: NextRequest) {
  return {
    start: request.nextUrl.searchParams.get("start") ?? undefined,
    end: request.nextUrl.searchParams.get("end") ?? undefined,
  };
}

export function analyticsIdentifier(value: string, pointer = "/id") {
  if (z.uuid().safeParse(value).success) return value;
  throw new AppError({
    code: "VALIDATION_ERROR",
    status: 422,
    safeMessage: "The resource identifier is invalid.",
    details: { errors: [{ pointer, code: "invalid_uuid" }] },
  });
}
