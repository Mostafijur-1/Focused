import type { Clock } from "@/application/ports/clock";
import { requirePermission } from "@/features/auth/application/authorization-policy";
import type { AuthUser } from "@/features/auth/domain/auth-types";
import {
  defaultDashboardLayout,
  snapshotFreshness,
  validateDashboardLayout,
} from "@/features/dashboard/domain/dashboard-policy";
import {
  localDateAt,
  utcDayRange,
} from "@/features/dashboard/domain/dashboard-time";
import type {
  DashboardData,
  DashboardDegradation,
  DashboardSnapshot,
  DashboardSource,
  DashboardWidgetSetting,
  FocusSessionSummary,
  GoalSummary,
  HabitSummary,
  ReminderSummary,
  StoredDashboardSnapshot,
  TodayFocusSummary,
  WeeklyProgressSummary,
} from "@/features/dashboard/domain/dashboard-types";
import { AppError } from "@/lib/errors/app-error";

import type { DashboardRepository } from "./ports";

const snapshotTtlMilliseconds = 5 * 60_000;

interface DashboardServiceDependencies {
  readonly repository: DashboardRepository;
  readonly clock: Clock;
}

export class DashboardService {
  constructor(private readonly dependencies: DashboardServiceDependencies) {}

  async getSnapshot(user: AuthUser): Promise<DashboardSnapshot> {
    requirePermission(user, "dashboard:read:own");
    const now = this.dependencies.clock.now();
    const identity = await this.dependencies.repository.getIdentity(user.id);
    const localDate = localDateAt(now, identity.timeZone);
    const [cached, storedLayout] = await Promise.all([
      this.dependencies.repository.findSnapshot(user.id, localDate),
      this.dependencies.repository.getWidgetLayout(user.id),
    ]);
    const layout = storedLayout ?? defaultDashboardLayout;

    if (cached && snapshotFreshness(cached.staleAfter, now) === "fresh") {
      return toSnapshot(cached, layout, now);
    }

    const dayRange = utcDayRange(localDate, identity.timeZone);
    const week = localWeek(localDate, identity.weekStartsOn, identity.timeZone);
    const results = await Promise.allSettled([
      this.dependencies.repository.readTodayFocus(user.id, localDate),
      this.dependencies.repository.readFocusSession(user.id),
      this.dependencies.repository.readWeeklyProgress(
        user.id,
        week.startDate,
        week.endDate,
        week.range,
      ),
      this.dependencies.repository.readHabits(user.id, localDate),
      this.dependencies.repository.readGoals(user.id),
      this.dependencies.repository.readReminders(user.id, dayRange, now),
    ] as const);

    if (cached && results.every((result) => result.status === "rejected")) {
      return {
        ...toSnapshot(cached, layout, now),
        freshness: "stale",
        degradations: [
          { source: "today_focus", code: "source_unavailable" },
          { source: "focus_sessions", code: "source_unavailable" },
          { source: "weekly_progress", code: "source_unavailable" },
          { source: "habits", code: "source_unavailable" },
          { source: "goals", code: "source_unavailable" },
          { source: "reminders", code: "source_unavailable" },
        ],
      };
    }

    const degradations: DashboardDegradation[] = [];
    const data: DashboardData = {
      displayName: identity.displayName,
      todayFocus: settled(
        results[0],
        "today_focus",
        {
          state: "unavailable",
          priorities: [],
          completedCount: 0,
          totalCount: 0,
        },
        degradations,
      ),
      focusSession: settled(
        results[1],
        "focus_sessions",
        { state: "unavailable", session: null },
        degradations,
      ),
      weeklyProgress: settled(
        results[2],
        "weekly_progress",
        {
          state: "unavailable",
          completedPriorities: 0,
          totalPriorities: 0,
          focusedSeconds: 0,
        },
        degradations,
      ),
      habits: settled(
        results[3],
        "habits",
        { state: "unavailable", completedCount: 0, dueCount: 0 },
        degradations,
      ),
      goals: settled(
        results[4],
        "goals",
        { state: "unavailable", activeCount: 0, nextGoal: null },
        degradations,
      ),
      reminders: settled(
        results[5],
        "reminders",
        { state: "unavailable", dueCount: 0, nextReminder: null },
        degradations,
      ),
      aiCoach: { state: "coming_soon" },
    };
    const staleAfter = new Date(now.getTime() + snapshotTtlMilliseconds);
    try {
      await this.dependencies.repository.saveSnapshot({
        userId: user.id,
        localDate,
        timeZone: identity.timeZone,
        data,
        degradations,
        computedAt: now,
        sourceThrough: now,
        staleAfter,
      });
    } catch {
      degradations.push({
        source: "projection_persistence",
        code: "projection_not_persisted",
      });
    }

    return {
      schemaVersion: 1,
      localDate,
      timeZone: identity.timeZone,
      computedAt: now.toISOString(),
      sourceThrough: now.toISOString(),
      staleAfter: staleAfter.toISOString(),
      freshness: "fresh",
      data,
      layout,
      degradations,
    };
  }

  async updateWidgetLayout(
    user: AuthUser,
    widgets: readonly DashboardWidgetSetting[],
    expectedVersion: number,
  ): Promise<DashboardWidgetLayoutResult> {
    requirePermission(user, "dashboard:widgets:update:own");
    const validation = validateDashboardLayout(widgets);
    if (!validation.ok) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        status: 422,
        safeMessage: "Review the Dashboard widget layout and try again.",
        details: {
          errors: [
            {
              pointer: "/widgets",
              code: validation.error,
              message: validation.error,
            },
          ],
        },
      });
    }
    const next = await this.dependencies.repository.updateWidgetLayout(
      user.id,
      { version: expectedVersion + 1, widgets: validation.value },
      expectedVersion,
      this.dependencies.clock.now(),
    );
    if (next === "conflict") {
      throw new AppError({
        code: "CONFLICT",
        safeMessage:
          "Dashboard settings changed on another device. Refresh and try again.",
      });
    }
    return { layout: next };
  }
}

export interface DashboardWidgetLayoutResult {
  readonly layout: Readonly<{
    version: number;
    widgets: readonly DashboardWidgetSetting[];
  }>;
}

function settled<TValue>(
  result: PromiseSettledResult<TValue>,
  source: DashboardSource,
  fallback: TValue,
  degradations: DashboardDegradation[],
): TValue {
  if (result.status === "fulfilled") return result.value;
  degradations.push({ source, code: "source_unavailable" });
  return fallback;
}

function toSnapshot(
  stored: StoredDashboardSnapshot,
  layout: DashboardSnapshot["layout"],
  now: Date,
): DashboardSnapshot {
  return {
    schemaVersion: 1,
    localDate: stored.localDate,
    timeZone: stored.timeZone,
    computedAt: stored.computedAt.toISOString(),
    sourceThrough: stored.sourceThrough.toISOString(),
    staleAfter: stored.staleAfter.toISOString(),
    freshness: snapshotFreshness(stored.staleAfter, now),
    data: stored.data,
    layout,
    degradations: stored.degradations,
  };
}

function localWeek(localDate: string, weekStartsOn: number, timeZone: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  if (!year || !month || !day || weekStartsOn < 0 || weekStartsOn > 6) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      safeMessage: "The Dashboard date boundary could not be calculated.",
    });
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  const daysSinceStart = (date.getUTCDay() - weekStartsOn + 7) % 7;
  const start = new Date(date.getTime() - daysSinceStart * 86_400_000);
  const endInclusive = new Date(start.getTime() + 6 * 86_400_000);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = endInclusive.toISOString().slice(0, 10);
  return {
    startDate,
    endDate,
    range: {
      start: utcDayRange(startDate, timeZone).start,
      end: utcDayRange(endDate, timeZone).end,
    },
  };
}

export type {
  FocusSessionSummary,
  GoalSummary,
  HabitSummary,
  ReminderSummary,
  TodayFocusSummary,
  WeeklyProgressSummary,
};
