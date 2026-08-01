import type { NextRequest } from "next/server";
import { z } from "zod";

import { getAuthService } from "@/features/auth/infrastructure/auth-container";
import { bearerToken } from "@/features/auth/transport/request-security";
import { AppError } from "@/lib/errors/app-error";

export async function notificationActor(request: NextRequest) {
  const actor = await getAuthService().authenticateAccessToken(
    bearerToken(request),
  );
  return actor.user;
}

export function notificationId(value: string): string {
  return identifier(value, "/notificationId", "notification");
}

export function reminderId(value: string): string {
  return identifier(value, "/reminderId", "reminder");
}

export function occurrenceId(value: string): string {
  return identifier(value, "/occurrenceId", "occurrence");
}

export function subscriptionId(value: string): string {
  return identifier(value, "/subscriptionId", "subscription");
}

function identifier(value: string, pointer: string, label: string): string {
  if (z.uuid().safeParse(value).success) return value;
  throw new AppError({
    code: "VALIDATION_ERROR",
    safeMessage: `The ${label} identifier is invalid.`,
    details: { errors: [{ pointer, code: "invalid_uuid" }] },
  });
}
