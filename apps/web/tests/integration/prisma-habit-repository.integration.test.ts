/** @vitest-environment node */

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@focused/database/generated/client";

import { PrismaHabitRepository } from "@/features/habits/infrastructure/persistence/prisma-habit-repository";

const connectionString = process.env.INTEGRATION_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("PrismaHabitRepository against PostgreSQL", () => {
  const ownerId = randomUUID();
  const otherId = randomUUID();
  const habitIdempotencyKey = randomUUID();
  const now = new Date("2026-08-01T06:00:00.000Z");
  let prisma: PrismaClient;
  let repository: PrismaHabitRepository;

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: connectionString! }),
    });
    repository = new PrismaHabitRepository(prisma);
    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          email: `habit-${ownerId}@example.test`,
          status: "ACTIVE",
        },
        {
          id: otherId,
          email: `habit-${otherId}@example.test`,
          status: "ACTIVE",
        },
      ],
    });
    await prisma.userProfile.createMany({
      data: [
        {
          userId: ownerId,
          displayName: "Habit Owner",
          locale: "bn-BD",
          timeZone: "Asia/Dhaka",
        },
        {
          userId: otherId,
          displayName: "Other Owner",
          locale: "en",
          timeZone: "UTC",
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    await prisma.$disconnect();
  });

  it("creates one schedule and one occurrence per local date on replay", async () => {
    const command = {
      userId: ownerId,
      title: "Read",
      kind: "count" as const,
      target: { value: 8, unit: "pages" },
      schedule: { type: "daily" as const },
      startsOn: "2026-08-01",
      timeZone: "Asia/Dhaka",
      clientCommandId: habitIdempotencyKey,
      now,
    };
    const first = await repository.create(command);
    const replay = await repository.create(command);
    expect(replay.id).toBe(first.id);
    expect(await prisma.habit.count({ where: { userId: ownerId } })).toBe(1);
    expect(
      await prisma.habitScheduleVersion.count({ where: { habitId: first.id } }),
    ).toBe(1);
    const rows = await prisma.habitOccurrence.groupBy({
      by: ["localDate"],
      where: { habitId: first.id },
      _count: true,
    });
    expect(rows.every((row) => row._count === 1)).toBe(true);
  });

  it("keeps owner data private and records an idempotent correction ledger", async () => {
    const owner = await repository.list(ownerId, "2026-08-01");
    const habit = owner.active[0]!;
    await expect(
      repository.findSummary(otherId, habit.id, "2026-08-01"),
    ).resolves.toBeNull();
    const command = {
      userId: ownerId,
      habitId: habit.id,
      localDate: "2026-08-01",
      value: 8,
      completed: true,
      skippedReason: null,
      note: "steady",
      evidenceRef: null,
      clientCommandId: randomUUID(),
      timeZone: "Asia/Dhaka",
      now,
    };
    const checked = await repository.recordEntry(command);
    const replay = await repository.recordEntry(command);
    expect(checked).not.toBeNull();
    expect(replay).not.toBeNull();
    expect(
      await prisma.habitEntry.count({ where: { habitId: habit.id } }),
    ).toBe(1);
    expect(
      await prisma.habitEntryRevision.count({
        where: { entry: { habitId: habit.id } },
      }),
    ).toBe(1);
  });

  it("preserves historical schedule truth and excludes a pause from due work", async () => {
    const habit = (await repository.list(ownerId, "2026-08-01")).active[0]!;
    const updated = await repository.update({
      userId: ownerId,
      habitId: habit.id,
      title: habit.title,
      kind: "count",
      target: { value: 10, unit: "pages" },
      schedule: { type: "weekdays", weekdays: [1, 3, 5] },
      effectiveOn: "2026-08-02",
      expectedVersion: habit.version,
      timeZone: "Asia/Dhaka",
      now: new Date(now.getTime() + 1_000),
    });
    expect(updated).not.toBe("conflict");
    expect(
      await prisma.habitScheduleVersion.count({ where: { habitId: habit.id } }),
    ).toBe(2);
    const latest = await repository.findSummary(
      ownerId,
      habit.id,
      "2026-08-02",
    );
    const paused = await repository.pause({
      userId: ownerId,
      habitId: habit.id,
      expectedVersion: latest!.version,
      localDate: "2026-08-02",
      reason: null,
      now: new Date(now.getTime() + 2_000),
    });
    expect(paused).not.toBe("conflict");
    const history = await repository.history(ownerId, habit.id, "2026-08-02");
    expect(
      history?.occurrences.find((item) => item.localDate === "2026-08-01")
        ?.target.value,
    ).toBe(8);
    expect(history?.habit.paused).toBe(true);
  });
});
