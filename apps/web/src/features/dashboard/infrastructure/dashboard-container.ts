import "server-only";

import { getPrismaClient } from "@focused/database";

import { DashboardService } from "@/features/dashboard/application/dashboard-service";
import { PrismaDashboardRepository } from "@/features/dashboard/infrastructure/persistence/prisma-dashboard-repository";
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
  dashboardService = new DashboardService({
    repository: new PrismaDashboardRepository(
      getPrismaClient(connectionString),
    ),
    clock: new SystemClock(),
  });
  return dashboardService;
}
