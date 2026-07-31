import { describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@/features/auth/domain/auth-types";
import { DashboardService } from "@/features/dashboard/application/dashboard-service";
import type { DashboardRepository } from "@/features/dashboard/application/ports";
import { defaultDashboardLayout } from "@/features/dashboard/domain/dashboard-policy";
import type {
  DashboardData,
  StoredDashboardSnapshot,
} from "@/features/dashboard/domain/dashboard-types";
import { AppError } from "@/lib/errors/app-error";

const now = new Date("2026-07-31T12:00:00.000Z");
const actor: AuthUser = {
  id: "9b523680-d60a-40e9-889b-ded3c417944b",
  email: "dashboard@example.test",
  displayName: "Mostafijur",
  passwordHash: null,
  emailVerifiedAt: now,
  status: "ACTIVE",
  permissionVersion: 1,
  permissions: ["dashboard:read:own", "dashboard:widgets:update:own"],
};

describe("DashboardService", () => {
  it("returns a fresh owner-scoped snapshot without reading raw sources again", async () => {
    const repository = repositoryDouble();
    repository.findSnapshot.mockResolvedValue(
      storedSnapshot({
        staleAfter: new Date(now.getTime() + 60_000),
      }),
    );
    const service = new DashboardService({
      repository,
      clock: { now: () => now },
    });

    const result = await service.getSnapshot(actor);

    expect(result.freshness).toBe("fresh");
    expect(result.localDate).toBe("2026-07-31");
    expect(repository.readTodayFocus).not.toHaveBeenCalled();
    expect(repository.getIdentity).toHaveBeenCalledWith(actor.id);
  });

  it("keeps healthy widgets when one noncritical source fails", async () => {
    const repository = repositoryDouble();
    repository.readHabits.mockRejectedValue(new Error("dependency down"));
    const service = new DashboardService({
      repository,
      clock: { now: () => now },
    });

    const result = await service.getSnapshot(actor);

    expect(result.data.todayFocus.state).toBe("empty");
    expect(result.data.habits.state).toBe("unavailable");
    expect(result.degradations).toContainEqual({
      source: "habits",
      code: "source_unavailable",
    });
    expect(repository.saveSnapshot).toHaveBeenCalledOnce();
  });

  it("falls back to a stale projection when every source is unavailable", async () => {
    const repository = repositoryDouble();
    repository.findSnapshot.mockResolvedValue(
      storedSnapshot({
        staleAfter: new Date(now.getTime() - 60_000),
      }),
    );
    for (const method of [
      repository.readTodayFocus,
      repository.readFocusSession,
      repository.readWeeklyProgress,
      repository.readHabits,
      repository.readGoals,
      repository.readReminders,
    ]) {
      method.mockRejectedValue(new Error("unavailable"));
    }
    const service = new DashboardService({
      repository,
      clock: { now: () => now },
    });

    const result = await service.getSnapshot(actor);

    expect(result.freshness).toBe("stale");
    expect(result.data.displayName).toBe("Cached member");
    expect(result.degradations).toHaveLength(6);
    expect(repository.saveSnapshot).not.toHaveBeenCalled();
  });

  it("surfaces projection persistence failure without losing composed data", async () => {
    const repository = repositoryDouble();
    repository.saveSnapshot.mockRejectedValue(new Error("write failed"));
    const service = new DashboardService({
      repository,
      clock: { now: () => now },
    });

    const result = await service.getSnapshot(actor);

    expect(result.freshness).toBe("fresh");
    expect(result.degradations).toContainEqual({
      source: "projection_persistence",
      code: "projection_not_persisted",
    });
  });

  it("validates layout updates and converts optimistic concurrency failure", async () => {
    const repository = repositoryDouble();
    const service = new DashboardService({
      repository,
      clock: { now: () => now },
    });
    const invalid = defaultDashboardLayout.widgets.map((widget) => ({
      ...widget,
      visible: widget.key !== "today_focus",
    }));
    await expect(
      service.updateWidgetLayout(actor, invalid, 1),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 422,
    });

    repository.updateWidgetLayout.mockResolvedValue("conflict");
    await expect(
      service.updateWidgetLayout(actor, defaultDashboardLayout.widgets, 1),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("requires the least-privilege Dashboard permission", async () => {
    const service = new DashboardService({
      repository: repositoryDouble(),
      clock: { now: () => now },
    });
    await expect(
      service.getSnapshot({ ...actor, permissions: [] }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

function repositoryDouble() {
  return {
    getIdentity: vi.fn(async () => ({
      displayName: "Mostafijur",
      timeZone: "Asia/Dhaka",
      weekStartsOn: 1,
    })),
    findSnapshot: vi.fn<DashboardRepository["findSnapshot"]>(async () => null),
    saveSnapshot: vi.fn<DashboardRepository["saveSnapshot"]>(
      async () => undefined,
    ),
    invalidateForEvent: vi.fn<DashboardRepository["invalidateForEvent"]>(
      async () => "advanced",
    ),
    getWidgetLayout: vi.fn<DashboardRepository["getWidgetLayout"]>(
      async () => null,
    ),
    updateWidgetLayout: vi.fn<DashboardRepository["updateWidgetLayout"]>(
      async (_userId, layout) => layout,
    ),
    readTodayFocus: vi.fn<DashboardRepository["readTodayFocus"]>(async () => ({
      state: "empty",
      priorities: [],
      completedCount: 0,
      totalCount: 0,
    })),
    readFocusSession: vi.fn<DashboardRepository["readFocusSession"]>(
      async () => ({
        state: "not_configured",
        session: null,
      }),
    ),
    readWeeklyProgress: vi.fn<DashboardRepository["readWeeklyProgress"]>(
      async () => ({
        state: "empty",
        completedPriorities: 0,
        totalPriorities: 0,
        focusedSeconds: 0,
      }),
    ),
    readHabits: vi.fn<DashboardRepository["readHabits"]>(async () => ({
      state: "not_configured",
      completedCount: 0,
      dueCount: 0,
    })),
    readGoals: vi.fn<DashboardRepository["readGoals"]>(async () => ({
      state: "not_configured",
      activeCount: 0,
      nextGoal: null,
    })),
    readReminders: vi.fn<DashboardRepository["readReminders"]>(async () => ({
      state: "not_configured",
      dueCount: 0,
      nextReminder: null,
    })),
  } satisfies DashboardRepository;
}

function storedSnapshot(
  overrides: Partial<StoredDashboardSnapshot> = {},
): StoredDashboardSnapshot {
  return {
    data: emptyData("Cached member"),
    localDate: "2026-07-31",
    timeZone: "Asia/Dhaka",
    computedAt: new Date(now.getTime() - 300_000),
    sourceThrough: new Date(now.getTime() - 300_000),
    staleAfter: new Date(now.getTime() - 1),
    degradations: [],
    ...overrides,
  };
}

function emptyData(displayName: string): DashboardData {
  return {
    displayName,
    todayFocus: {
      state: "empty",
      priorities: [],
      completedCount: 0,
      totalCount: 0,
    },
    focusSession: { state: "not_configured", session: null },
    weeklyProgress: {
      state: "empty",
      completedPriorities: 0,
      totalPriorities: 0,
      focusedSeconds: 0,
    },
    habits: { state: "not_configured", completedCount: 0, dueCount: 0 },
    goals: { state: "not_configured", activeCount: 0, nextGoal: null },
    reminders: { state: "not_configured", dueCount: 0, nextReminder: null },
    aiCoach: { state: "coming_soon" },
  };
}
