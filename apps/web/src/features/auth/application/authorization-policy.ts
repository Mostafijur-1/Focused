import type { AuthUser } from "@/features/auth/domain/auth-types";
import { AppError } from "@/lib/errors/app-error";

export function requirePermission(user: AuthUser, permission: string): void {
  if (!user.permissions.includes(permission)) {
    throw new AppError({
      code: "FORBIDDEN",
      safeMessage: "You do not have permission to perform this action.",
    });
  }
}

export function requireOwnership(
  actorUserId: string,
  resourceUserId: string,
): void {
  if (actorUserId !== resourceUserId) {
    throw new AppError({
      code: "NOT_FOUND",
      safeMessage: "Resource not found.",
    });
  }
}
