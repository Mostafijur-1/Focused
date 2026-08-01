import "server-only";

import { getPrismaClient } from "@focused/database";

import { FocusService } from "@/features/focus/application/focus-service";
import { PrismaFocusRepository } from "@/features/focus/infrastructure/persistence/prisma-focus-repository";
import { SystemClock } from "@/infrastructure/time/system-clock";
import { getServerEnvironment } from "@/lib/config/server-env";
import { AppError } from "@/lib/errors/app-error";

let service: FocusService | undefined;

export function getFocusService(): FocusService {
  if (service) return service;
  const { DATABASE_URL: databaseUrl } = getServerEnvironment();
  if (!databaseUrl)
    throw new AppError({
      code: "DEPENDENCY_UNAVAILABLE",
      safeMessage: "Focus Timer is temporarily unavailable.",
    });
  service = new FocusService({
    repository: new PrismaFocusRepository(getPrismaClient(databaseUrl)),
    clock: new SystemClock(),
  });
  return service;
}
