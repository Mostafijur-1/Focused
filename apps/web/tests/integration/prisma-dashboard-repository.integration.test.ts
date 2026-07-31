/** @vitest-environment node */

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@focused/database/generated/client";

import { defaultDashboardLayout } from "@/features/dashboard/domain/dashboard-policy";
import type { DashboardData } from "@/features/dashboard/domain/dashboard-types";
import { PrismaDashboardRepository } from "@/features/dashboard/infrastructure/persistence/prisma-dashboard-repository";

const connectionString = process.env.INTEGRATION_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("PrismaDashboardRepository against PostgreSQL", () => {
  const ownerId = randomUUID();
  const otherUserId = randomUUID();
  const localDate = "2026-07-31";
  const now = new Date("2026-07-31T12:00:00.000Z");
  let prisma: PrismaClient;
  let repository: PrismaDashboardRepository;

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: connectionString! }),
    });
    repository = new PrismaDashboardRepository(prisma);
    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          email: `dashboard-${ownerId}@example.test`,
          status: "ACTIVE",
        },
        {
          id: otherUserId,
          email: `dashboard-${otherUserId}@example.test`,
          status: "ACTIVE",
        },
      ],
    });
    await prisma.userProfile.createMany({
      data: [
        {
          userId: ownerId,
          displayName: "Dashboard Owner",
          locale: "bn-BD",
          timeZone: "Asia/Dhaka",
        },
        {
          userId: otherUserId,
          displayName: "Other Member",
          locale: "en",
          timeZone: "UTC",
        },
      ],
    });
    await prisma.plan.create({
      data: {
        userId: ownerId,
        type: "DAILY",
        periodStart: new Date("2026-07-31T00:00:00.000Z"),
        periodEnd: new Date("2026-07-31T00:00:00.000Z"),
        timeZone: "Asia/Dhaka",
        status: "ACTIVE",
        items: {
          create: [
            {
              title: "Milestone 4 যাচাই",
              isPrimary: true,
              position: 0,
              status: "IN_PROGRESS",
            },
            {
              title: "অপ্রয়োজনীয় গোপন লেখা নয়",
              isPrimary: false,
              position: 1,
            },
          ],
        },
      },
    });
    await prisma.goal.create({
      data: {
        userId: ownerId,
        title: "Focused alpha",
        horizon: "QUARTER",
        status: "ACTIVE",
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, otherUserId] } },
    });
    await prisma.$disconnect();
  });

  it("reads bounded owner data without leaking another member's records", async () => {
    await expect(repository.getIdentity(ownerId)).resolves.toMatchObject({
      displayName: "Dashboard Owner",
      timeZone: "Asia/Dhaka",
    });
    const ownerFocus = await repository.readTodayFocus(ownerId, localDate);
    const otherFocus = await repository.readTodayFocus(otherUserId, localDate);
    const ownerGoals = await repository.readGoals(ownerId);
    const otherGoals = await repository.readGoals(otherUserId);

    expect(ownerFocus).toMatchObject({ state: "ready", totalCount: 1 });
    expect(ownerFocus.priorities[0]?.title).toBe("Milestone 4 যাচাই");
    expect(otherFocus).toMatchObject({ state: "empty", totalCount: 0 });
    expect(ownerGoals).toMatchObject({ state: "ready", activeCount: 1 });
    expect(otherGoals).toMatchObject({
      state: "not_configured",
      activeCount: 0,
    });
  });

  it("persists a versioned snapshot and uses the owner/date index", async () => {
    await repository.saveSnapshot({
      userId: ownerId,
      localDate,
      timeZone: "Asia/Dhaka",
      data: emptyData,
      degradations: [],
      computedAt: now,
      sourceThrough: now,
      staleAfter: new Date(now.getTime() + 300_000),
    });
    await expect(
      repository.findSnapshot(ownerId, localDate),
    ).resolves.toMatchObject({
      localDate,
      timeZone: "Asia/Dhaka",
      data: { displayName: "Dashboard Owner" },
    });
    await expect(
      repository.findSnapshot(otherUserId, localDate),
    ).resolves.toBeNull();

    const plan = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
      return transaction.$queryRaw<Array<{ "QUERY PLAN": string }>>`
        EXPLAIN (COSTS OFF)
        SELECT "payload" FROM "dashboard_snapshots"
        WHERE "userId" = ${ownerId}::uuid AND "localDate" = ${localDate}::date
      `;
    });
    expect(plan.map((row) => row["QUERY PLAN"]).join(" ")).toContain(
      "dashboard_snapshots_userId_localDate_key",
    );
  });

  it("updates widget preferences with optimistic concurrency", async () => {
    const changed = {
      version: 2,
      widgets: defaultDashboardLayout.widgets.map((widget) =>
        widget.key === "ai_coach" ? { ...widget, visible: false } : widget,
      ),
    };
    await expect(
      repository.updateWidgetLayout(ownerId, changed, 1, now),
    ).resolves.toEqual(changed);
    await expect(
      repository.updateWidgetLayout(ownerId, changed, 1, now),
    ).resolves.toBe("conflict");
    await expect(repository.getWidgetLayout(ownerId)).resolves.toEqual(changed);
  });

  it("invalidates cached projections once for an ordered domain event", async () => {
    const event = {
      userId: ownerId,
      eventId: randomUUID(),
      occurredAt: new Date("2026-07-31T12:01:00.000Z"),
    };

    await expect(repository.invalidateForEvent(event)).resolves.toBe(
      "advanced",
    );
    const invalidated = await prisma.dashboardSnapshot.findUniqueOrThrow({
      where: {
        userId_localDate: {
          userId: ownerId,
          localDate: new Date("2026-07-31T00:00:00.000Z"),
        },
      },
      select: { staleAfter: true, version: true },
    });
    await expect(repository.invalidateForEvent(event)).resolves.toBe(
      "replayed",
    );
    const replayed = await prisma.dashboardSnapshot.findUniqueOrThrow({
      where: {
        userId_localDate: {
          userId: ownerId,
          localDate: new Date("2026-07-31T00:00:00.000Z"),
        },
      },
      select: { staleAfter: true, version: true },
    });

    expect(invalidated.staleAfter).toEqual(event.occurredAt);
    expect(replayed).toEqual(invalidated);
  });
});

const emptyData: DashboardData = {
  displayName: "Dashboard Owner",
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
