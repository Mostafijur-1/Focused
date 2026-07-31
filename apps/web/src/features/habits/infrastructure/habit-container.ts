import "server-only";

import { getPrismaClient } from "@focused/database";

import { HabitService } from "@/features/habits/application/habit-service";
import { HabitOccurrenceWorker } from "@/features/habits/application/habit-occurrence-worker";
import { PrismaHabitRepository } from "@/features/habits/infrastructure/persistence/prisma-habit-repository";
import { SystemClock } from "@/infrastructure/time/system-clock";
import { AppError } from "@/lib/errors/app-error";
import { getServerEnvironment } from "@/lib/config/server-env";

let service: HabitService | undefined;
let worker: HabitOccurrenceWorker | undefined;

export function getHabitService(): HabitService {
  if (service) return service;
  const environment = getServerEnvironment();
  if (!environment.DATABASE_URL) {
    throw new AppError({
      code: "DEPENDENCY_UNAVAILABLE",
      safeMessage: "Habit tracking is temporarily unavailable.",
    });
  }
  service = new HabitService({
    repository: new PrismaHabitRepository(
      getPrismaClient(environment.DATABASE_URL),
    ),
    clock: new SystemClock(),
  });
  return service;
}

export function getHabitOccurrenceWorker(): HabitOccurrenceWorker {
  if (worker) return worker;
  const environment = getServerEnvironment();
  if (!environment.DATABASE_URL) {
    throw new AppError({
      code: "DEPENDENCY_UNAVAILABLE",
      safeMessage: "Habit occurrence expansion is unavailable.",
    });
  }
  worker = new HabitOccurrenceWorker({
    repository: new PrismaHabitRepository(
      getPrismaClient(environment.DATABASE_URL),
    ),
    clock: new SystemClock(),
  });
  return worker;
}
