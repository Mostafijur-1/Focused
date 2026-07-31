import "server-only";

import { getPrismaClient } from "@focused/database";

import { DashboardService } from "@/features/dashboard/application/dashboard-service";
import { PrismaDashboardRepository } from "@/features/dashboard/infrastructure/persistence/prisma-dashboard-repository";
import { addDays } from "@/features/habits/domain/habit-schedule";
import { PrismaHabitRepository } from "@/features/habits/infrastructure/persistence/prisma-habit-repository";
import { SystemClock } from "@/infrastructure/time/system-clock";
import { getServerEnvironment } from "@/lib/config/server-env";
import { AppError } from "@/lib/errors/app-error";

let dashboardService: DashboardService | undefined;

export function getDashboardService(): DashboardService {
  if (dashboardService) return dashboardService;
  const connectionString = getServerEnvironment().DATABASE_URL;
  if (!connectionString) {
    throw new AppError({
      code: "DEPENDENCY_UNAVAILABLE",
      safeMessage: "Dashboard data is not configured for this environment.",
    });
  }
  const prisma = getPrismaClient(connectionString);
  const habitRepository = new PrismaHabitRepository(prisma);
  const clock = new SystemClock();
  dashboardService = new DashboardService({
    repository: new PrismaDashboardRepository(
      prisma,
      async (userId, localDate) => {
        await habitRepository.expandOccurrences({
          userId,
          from: localDate,
          through: addDays(localDate, 14),
          now: clock.now(),
        });
      },
    ),
    clock,
  });
  return dashboardService;
}
