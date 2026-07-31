import { describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@/features/auth/domain/auth-types";
import { HabitService } from "@/features/habits/application/habit-service";
import type { HabitRepository } from "@/features/habits/application/ports";
import type { HabitSummary } from "@/features/habits/domain/habit-types";

const now = new Date("2026-08-01T06:00:00.000Z");
const user: AuthUser = {
  id: "23238b54-ab60-4167-b760-e312b39a53af",
  email: "habit@example.test",
  displayName: "Habit Owner",
  passwordHash: null,
  emailVerifiedAt: now,
  status: "ACTIVE",
  permissionVersion: 1,
  permissions: ["habits:read:own", "habits:write:own"],
};

describe("HabitService", () => {
  it("expands a bounded member-local window before listing", async () => {
    const repository = repositoryDouble();
    const service = buildService(repository);
    await service.list(user);
    expect(repository.expandOccurrences).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        from: "2026-06-21",
        through: "2026-08-15",
      }),
    );
    expect(repository.list).toHaveBeenCalledWith(user.id, "2026-08-01");
  });

  it("validates target semantics and active habit limits before creation", async () => {
    const repository = repositoryDouble();
    const service = buildService(repository);
    await expect(
      service.create(user, {
        title: "Read",
        kind: "boolean",
        target: { value: 1, unit: "page" },
        schedule: { type: "daily" },
        startsOn: "2026-08-01",
        clientCommandId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 422 });
    repository.countActive.mockResolvedValue(100);
    await expect(
      service.create(user, {
        title: "Read",
        kind: "boolean",
        target: { value: null, unit: null },
        schedule: { type: "daily" },
        startsOn: "2026-08-01",
        clientCommandId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("derives quantified completion and keeps retries in the repository boundary", async () => {
    const repository = repositoryDouble();
    const habit = summary({ kind: "count", targetValue: 8 });
    repository.findSummary.mockResolvedValue(habit);
    repository.recordEntry.mockResolvedValue(habit);
    const service = buildService(repository);
    await service.checkIn(user, habit.id, {
      localDate: "2026-08-01",
      value: 9,
      completed: null,
      skippedReason: null,
      note: "  good return  ",
      evidenceRef: null,
      clientCommandId: crypto.randomUUID(),
    });
    expect(repository.recordEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        completed: true,
        note: "good return",
        timeZone: "Asia/Dhaka",
      }),
    );
  });

  it("maps not-due and optimistic conflicts to safe API errors", async () => {
    const repository = repositoryDouble();
    repository.findSummary.mockResolvedValue(summary());
    repository.recordEntry.mockResolvedValue("not_due");
    const service = buildService(repository);
    await expect(
      service.checkIn(user, "d8df8a00-9c65-4d82-b3d7-8826d2472366", {
        localDate: "2026-08-01",
        value: null,
        completed: true,
        skippedReason: null,
        note: null,
        evidenceRef: null,
        clientCommandId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 422 });
    repository.setArchived.mockResolvedValue("conflict");
    await expect(
      service.setArchived(
        user,
        "d8df8a00-9c65-4d82-b3d7-8826d2472366",
        1,
        true,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("enforces least privilege", async () => {
    const service = buildService(repositoryDouble());
    await expect(
      service.list({ ...user, permissions: [] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      service.pause(
        { ...user, permissions: ["habits:read:own"] },
        crypto.randomUUID(),
        1,
        null,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

function buildService(repository: ReturnType<typeof repositoryDouble>) {
  return new HabitService({ repository, clock: { now: () => now } });
}

function repositoryDouble() {
  return {
    listExpansionCandidates: vi
      .fn<HabitRepository["listExpansionCandidates"]>()
      .mockResolvedValue([]),
    getProfile: vi
      .fn<HabitRepository["getProfile"]>()
      .mockResolvedValue({ timeZone: "Asia/Dhaka" }),
    countActive: vi.fn<HabitRepository["countActive"]>().mockResolvedValue(0),
    expandOccurrences: vi
      .fn<HabitRepository["expandOccurrences"]>()
      .mockResolvedValue(0),
    list: vi.fn<HabitRepository["list"]>().mockResolvedValue({
      localDate: "2026-08-01",
      timeZone: "Asia/Dhaka",
      active: [],
      archived: [],
      syncToken: now.toISOString(),
    }),
    findSummary: vi
      .fn<HabitRepository["findSummary"]>()
      .mockResolvedValue(summary()),
    create: vi.fn<HabitRepository["create"]>().mockResolvedValue(summary()),
    update: vi.fn<HabitRepository["update"]>().mockResolvedValue(summary()),
    setArchived: vi
      .fn<HabitRepository["setArchived"]>()
      .mockResolvedValue(summary()),
    pause: vi.fn<HabitRepository["pause"]>().mockResolvedValue(summary()),
    resume: vi.fn<HabitRepository["resume"]>().mockResolvedValue(summary()),
    recordEntry: vi
      .fn<HabitRepository["recordEntry"]>()
      .mockResolvedValue(summary()),
    undoEntry: vi
      .fn<HabitRepository["undoEntry"]>()
      .mockResolvedValue(summary()),
    history: vi.fn<HabitRepository["history"]>().mockResolvedValue({
      habit: summary(),
      occurrences: [],
      nextCursor: null,
    }),
  } satisfies HabitRepository;
}

function summary(
  options: Readonly<{
    kind?: "boolean" | "count";
    targetValue?: number | null;
  }> = {},
): HabitSummary {
  return {
    id: "d8df8a00-9c65-4d82-b3d7-8826d2472366",
    title: "Read",
    kind: options.kind ?? "boolean",
    startsOn: "2026-08-01",
    paused: false,
    archived: false,
    version: 1,
    scheduleVersion: {
      id: "ec852f58-a764-4a34-beb5-3f6d1775b5cd",
      revision: 1,
      schedule: { type: "daily" },
      target: {
        value: options.targetValue ?? null,
        unit: options.targetValue ? "pages" : null,
      },
      timeZone: "Asia/Dhaka",
      effectiveFrom: "2026-08-01",
      effectiveTo: null,
    },
    today: null,
    consistency: {
      dueCount: 0,
      completedCount: 0,
      percentage: 0,
      currentStreak: 0,
    },
  };
}
