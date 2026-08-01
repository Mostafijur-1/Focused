import "server-only";

import { getPrismaClient } from "@focused/database";

import { GoalService } from "@/features/goals/application/goal-service";
import { PrismaGoalRepository } from "@/features/goals/infrastructure/persistence/prisma-goal-repository";
import { SystemClock } from "@/infrastructure/time/system-clock";
import { getServerEnvironment } from "@/lib/config/server-env";
import { AppError } from "@/lib/errors/app-error";

let service: GoalService | undefined;

export function getGoalService(): GoalService {
  if (service) return service;
  const { DATABASE_URL: databaseUrl } = getServerEnvironment();
  if (!databaseUrl) {
    throw new AppError({
      code: "DEPENDENCY_UNAVAILABLE",
      safeMessage: "Goal planning is temporarily unavailable.",
    });
  }
  service = new GoalService({
    repository: new PrismaGoalRepository(getPrismaClient(databaseUrl)),
    clock: new SystemClock(),
  });
  return service;
}
