import type { FocusedPrismaClient } from "@focused/database";
import { Prisma } from "@focused/database/generated/client";

import type {
  DashboardIdentity,
  DashboardProjectionEvent,
  DashboardRepository,
  DashboardSnapshotWrite,
} from "@/features/dashboard/application/ports";
import {
  defaultDashboardLayout,
  isDashboardWidgetKey,
  validateDashboardLayout,
} from "@/features/dashboard/domain/dashboard-policy";
import type { UtcDayRange } from "@/features/dashboard/domain/dashboard-time";
import type {
  DashboardData,
  DashboardDegradation,
  DashboardWidgetLayout,
  FocusSessionSummary,
  GoalSummary,
  HabitSummary,
  ReminderSummary,
  StoredDashboardSnapshot,
  TodayFocusSummary,
  WeeklyProgressSummary,
} from "@/features/dashboard/domain/dashboard-types";
import { AppError } from "@/lib/errors/app-error";

export class PrismaDashboardRepository implements DashboardRepository {
  constructor(private readonly prisma: FocusedPrismaClient) {}

  async getIdentity(userId: string): Promise<DashboardIdentity> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE", deletedAt: null },
      select: {
        profile: {
          select: { displayName: true, timeZone: true, weekStartsOn: true },
        },
      },
    });
    if (!user?.profile) {
      throw new AppError({
        code: "NOT_FOUND",
        safeMessage: "Dashboard profile not found.",
      });
    }
    return user.profile;
  }

  async findSnapshot(
    userId: string,
    localDate: string,
  ): Promise<StoredDashboardSnapshot | null> {
    const snapshot = await this.prisma.dashboardSnapshot.findUnique({
      where: {
        userId_localDate: { userId, localDate: databaseDate(localDate) },
      },
    });
    if (!snapshot) return null;
    return {
      data: snapshot.payload as unknown as DashboardData,
      localDate: isoDate(snapshot.localDate),
      timeZone: snapshot.timeZone,
      computedAt: snapshot.computedAt,
      sourceThrough: snapshot.sourceThrough,
      staleAfter: snapshot.staleAfter,
      degradations:
        snapshot.degradations as unknown as readonly DashboardDegradation[],
    };
  }

  async saveSnapshot(snapshot: DashboardSnapshotWrite): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.dashboardSnapshot.upsert({
        where: {
          userId_localDate: {
            userId: snapshot.userId,
            localDate: databaseDate(snapshot.localDate),
          },
        },
        create: {
          userId: snapshot.userId,
          localDate: databaseDate(snapshot.localDate),
          timeZone: snapshot.timeZone,
          payload: snapshot.data as unknown as Prisma.InputJsonValue,
          sourceVersions: sourceVersions,
          degradations:
            snapshot.degradations as unknown as Prisma.InputJsonValue,
          computedAt: snapshot.computedAt,
          sourceThrough: snapshot.sourceThrough,
          staleAfter: snapshot.staleAfter,
        },
        update: {
          timeZone: snapshot.timeZone,
          payload: snapshot.data as unknown as Prisma.InputJsonValue,
          sourceVersions,
          degradations:
            snapshot.degradations as unknown as Prisma.InputJsonValue,
          computedAt: snapshot.computedAt,
          sourceThrough: snapshot.sourceThrough,
          staleAfter: snapshot.staleAfter,
          version: { increment: 1 },
        },
      });
      await transaction.dashboardProjectionCursor.upsert({
        where: { userId: snapshot.userId },
        create: { userId: snapshot.userId, reconciledAt: snapshot.computedAt },
        update: {
          reconciledAt: snapshot.computedAt,
          version: { increment: 1 },
        },
      });
    });
  }

  async invalidateForEvent(
    event: DashboardProjectionEvent,
  ): Promise<"advanced" | "replayed"> {
    return this.prisma.$transaction(async (transaction) => {
      const advanced = await transaction.$queryRaw<Array<{ userId: string }>>`
        INSERT INTO "dashboard_projection_cursors" (
          "userId", "lastEventOccurredAt", "lastEventId", "reconciledAt", "updatedAt", "version"
        ) VALUES (
          ${event.userId}::uuid,
          ${event.occurredAt},
          ${event.eventId}::uuid,
          TIMESTAMPTZ '1970-01-01 00:00:00+00',
          CURRENT_TIMESTAMP,
          1
        )
        ON CONFLICT ("userId") DO UPDATE SET
          "lastEventOccurredAt" = EXCLUDED."lastEventOccurredAt",
          "lastEventId" = EXCLUDED."lastEventId",
          "updatedAt" = CURRENT_TIMESTAMP,
          "version" = "dashboard_projection_cursors"."version" + 1
        WHERE "dashboard_projection_cursors"."lastEventOccurredAt" IS NULL
           OR ("dashboard_projection_cursors"."lastEventOccurredAt", "dashboard_projection_cursors"."lastEventId")
              < (EXCLUDED."lastEventOccurredAt", EXCLUDED."lastEventId")
        RETURNING "userId"
      `;
      if (advanced.length === 0) return "replayed";

      await transaction.dashboardSnapshot.updateMany({
        where: {
          userId: event.userId,
          staleAfter: { gt: event.occurredAt },
        },
        data: {
          staleAfter: event.occurredAt,
          version: { increment: 1 },
        },
      });
      return "advanced";
    });
  }

  async getWidgetLayout(userId: string): Promise<DashboardWidgetLayout | null> {
    const preference = await this.prisma.dashboardWidgetPreference.findUnique({
      where: { userId },
      select: { layout: true, version: true },
    });
    if (!preference) return null;
    const widgets = parseWidgetLayout(preference.layout);
    return widgets
      ? { version: preference.version, widgets }
      : defaultDashboardLayout;
  }

  async updateWidgetLayout(
    userId: string,
    layout: DashboardWidgetLayout,
    expectedVersion: number,
    now: Date,
  ): Promise<DashboardWidgetLayout | "conflict"> {
    if (expectedVersion === defaultDashboardLayout.version) {
      const existing = await this.prisma.dashboardWidgetPreference.findUnique({
        where: { userId },
        select: { version: true },
      });
      if (!existing) {
        try {
          const created = await this.prisma.dashboardWidgetPreference.create({
            data: {
              userId,
              layout: layout.widgets as unknown as Prisma.InputJsonValue,
              version: layout.version,
              updatedAt: now,
            },
            select: { version: true },
          });
          return { ...layout, version: created.version };
        } catch (error) {
          if (isUniqueConstraintError(error)) return "conflict";
          throw error;
        }
      }
    }

    const result = await this.prisma.dashboardWidgetPreference.updateMany({
      where: { userId, version: expectedVersion },
      data: {
        layout: layout.widgets as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
        updatedAt: now,
      },
    });
    return result.count === 1 ? layout : "conflict";
  }

  async readTodayFocus(
    userId: string,
    localDate: string,
  ): Promise<TodayFocusSummary> {
    const plan = await this.prisma.plan.findUnique({
      where: {
        userId_type_periodStart: {
          userId,
          type: "DAILY",
          periodStart: databaseDate(localDate),
        },
      },
      select: {
        items: {
          where: { parentItemId: null, isPrimary: true },
          orderBy: { position: "asc" },
          take: 3,
          select: { id: true, title: true, status: true },
        },
      },
    });
    if (!plan || plan.items.length === 0) {
      return {
        state: "empty",
        priorities: [],
        completedCount: 0,
        totalCount: 0,
      };
    }
    const priorities = plan.items.map((item) => ({
      id: item.id,
      title: item.title,
      status: planItemStatus(item.status),
    }));
    return {
      state: "ready",
      priorities,
      completedCount: priorities.filter((item) => item.status === "completed")
        .length,
      totalCount: priorities.length,
    };
  }

  async readFocusSession(userId: string): Promise<FocusSessionSummary> {
    const active = await this.prisma.focusSession.findFirst({
      where: { userId, status: { in: ["RUNNING", "PAUSED"] } },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        intent: true,
        kind: true,
        status: true,
        plannedSeconds: true,
        startedAt: true,
      },
    });
    if (!active) {
      return { state: "not_configured", session: null };
    }
    return {
      state: "active",
      session: {
        id: active.id,
        intent: active.intent,
        kind: active.kind.toLowerCase() as "deep_work" | "pomodoro" | "custom",
        status: active.status.toLowerCase() as "running" | "paused",
        plannedSeconds: active.plannedSeconds,
        startedAt: active.startedAt.toISOString(),
      },
    };
  }

  async readWeeklyProgress(
    userId: string,
    localDateStart: string,
    localDateEnd: string,
    range: UtcDayRange,
  ): Promise<WeeklyProgressSummary> {
    const [items, sessions] = await Promise.all([
      this.prisma.planItem.groupBy({
        by: ["status"],
        where: {
          isPrimary: true,
          plan: {
            userId,
            type: "DAILY",
            periodStart: {
              gte: databaseDate(localDateStart),
              lte: databaseDate(localDateEnd),
            },
          },
        },
        _count: { _all: true },
      }),
      this.prisma.focusSession.findMany({
        where: {
          userId,
          status: "COMPLETED",
          startedAt: { gte: range.start, lt: range.end },
        },
        select: { startedAt: true, completedAt: true },
        take: 500,
      }),
    ]);
    const totalPriorities = items.reduce(
      (total, item) => total + item._count._all,
      0,
    );
    const completedPriorities =
      items.find((item) => item.status === "COMPLETED")?._count._all ?? 0;
    const focusedSeconds = sessions.reduce((total, session) => {
      if (!session.completedAt) return total;
      return (
        total +
        Math.max(
          0,
          (session.completedAt.getTime() - session.startedAt.getTime()) / 1000,
        )
      );
    }, 0);
    return {
      state: totalPriorities === 0 && sessions.length === 0 ? "empty" : "ready",
      completedPriorities,
      totalPriorities,
      focusedSeconds: Math.round(focusedSeconds),
    };
  }

  async readHabits(userId: string, localDate: string): Promise<HabitSummary> {
    const date = databaseDate(localDate);
    const habits = await this.prisma.habit.findMany({
      where: {
        userId,
        archivedAt: null,
        pausedAt: null,
        startsOn: { lte: date },
      },
      select: {
        entries: {
          where: { localDate: date },
          take: 1,
          select: { completed: true },
        },
      },
      take: 50,
    });
    if (habits.length === 0) {
      return { state: "not_configured", completedCount: 0, dueCount: 0 };
    }
    return {
      state: "ready",
      completedCount: habits.filter(
        (habit) => habit.entries[0]?.completed === true,
      ).length,
      dueCount: habits.length,
    };
  }

  async readGoals(userId: string): Promise<GoalSummary> {
    const [activeCount, nextGoal] = await Promise.all([
      this.prisma.goal.count({
        where: { userId, status: "ACTIVE", deletedAt: null },
      }),
      this.prisma.goal.findFirst({
        where: { userId, status: "ACTIVE", deletedAt: null },
        orderBy: [{ targetDate: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true },
      }),
    ]);
    return activeCount === 0
      ? { state: "not_configured", activeCount: 0, nextGoal: null }
      : { state: "ready", activeCount, nextGoal };
  }

  async readReminders(
    userId: string,
    range: UtcDayRange,
    now: Date,
  ): Promise<ReminderSummary> {
    const where = {
      reminder: { userId, status: "ACTIVE" as const },
      status: { in: ["PENDING" as const, "DEFERRED" as const] },
      scheduledFor: { gte: now, lt: range.end },
    };
    const [dueCount, next] = await Promise.all([
      this.prisma.reminderOccurrence.count({ where }),
      this.prisma.reminderOccurrence.findFirst({
        where,
        orderBy: [{ scheduledFor: "asc" }, { id: "asc" }],
        select: {
          id: true,
          scheduledFor: true,
          reminder: { select: { title: true } },
        },
      }),
    ]);
    const configured = await this.prisma.reminder.count({
      where: { userId, status: "ACTIVE" },
      take: 1,
    });
    if (configured === 0) {
      return { state: "not_configured", dueCount: 0, nextReminder: null };
    }
    return {
      state: "ready",
      dueCount,
      nextReminder: next
        ? {
            id: next.id,
            title: next.reminder.title,
            scheduledFor: next.scheduledFor.toISOString(),
          }
        : null,
    };
  }
}

const sourceVersions = {
  dashboard: 1,
  plans: 1,
  focusSessions: 1,
  habits: 1,
  goals: 1,
  reminders: 1,
} satisfies Prisma.InputJsonObject;

function databaseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseWidgetLayout(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) return null;
  const widgets = value.flatMap((item) => {
    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item) ||
      typeof item.key !== "string" ||
      typeof item.visible !== "boolean" ||
      !isDashboardWidgetKey(item.key)
    ) {
      return [];
    }
    return [{ key: item.key, visible: item.visible }];
  });
  const validation = validateDashboardLayout(widgets);
  return validation.ok ? validation.value : null;
}

function planItemStatus(
  status: string,
): "planned" | "in_progress" | "completed" {
  if (status === "COMPLETED") return "completed";
  if (status === "IN_PROGRESS") return "in_progress";
  return "planned";
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
