import type { NextRequest } from "next/server";
import { z } from "zod";

import { getAuthService } from "@/features/auth/infrastructure/auth-container";
import { bearerToken } from "@/features/auth/transport/request-security";
import { AppError } from "@/lib/errors/app-error";

export async function habitActor(request: NextRequest) {
  const actor = await getAuthService().authenticateAccessToken(
    bearerToken(request),
  );
  return actor.user;
}

export function habitId(value: string): string {
  if (z.uuid().safeParse(value).success) return value;
  throw new AppError({
    code: "VALIDATION_ERROR",
    safeMessage: "The habit identifier is invalid.",
    details: { errors: [{ pointer: "/habitId", code: "invalid_uuid" }] },
  });
}

export function habitHistoryCursor(value: string | null): string | undefined {
  if (value === null) return undefined;
  if (z.iso.date().safeParse(value).success) return value;
  throw new AppError({
    code: "VALIDATION_ERROR",
    safeMessage: "The history cursor is invalid.",
    details: { errors: [{ pointer: "/cursor", code: "invalid_date" }] },
  });
}
