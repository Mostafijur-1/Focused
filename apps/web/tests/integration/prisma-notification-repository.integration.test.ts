/** @vitest-environment node */

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@focused/database/generated/client";

import { PrismaNotificationRepository } from "@/features/notifications/infrastructure/persistence/prisma-notification-repository";

const connectionString = process.env.INTEGRATION_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("PrismaNotificationRepository against PostgreSQL", () => {
  const ownerId = randomUUID();
  const otherId = randomUUID();
  const commandId = randomUUID();
  const now = new Date("2026-08-01T06:00:00.000Z");
  let prisma: PrismaClient;
  let repository: PrismaNotificationRepository;

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: connectionString! }),
    });
    repository = new PrismaNotificationRepository(prisma);
    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          email: `notification-${ownerId}@example.test`,
          status: "ACTIVE",
        },
        {
          id: otherId,
          email: `notification-${otherId}@example.test`,
          status: "ACTIVE",
        },
      ],
    });
    await prisma.userProfile.createMany({
      data: [
        {
          userId: ownerId,
          displayName: "Reminder Owner",
          locale: "bn-BD",
          timeZone: "Asia/Dhaka",
        },
        {
          userId: otherId,
          displayName: "Other Member",
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

  it("replays reminder creation and keeps generated occurrences owner-scoped", async () => {
    const input = {
      userId: ownerId,
      title: "Start focused work",
      body: "Private context",
      timeZone: "Asia/Dhaka",
      schedule: {
        kind: "daily" as const,
        startsOn: "2026-08-02",
        localTime: "09:00",
        interval: 1,
      },
      channels: { inApp: true, webPush: false },
      clientCommandId: commandId,
      now,
    };
    const first = await repository.createReminder(input);
    const replay = await repository.createReminder(input);
    expect(replay.id).toBe(first.id);
    expect(await prisma.reminder.count({ where: { userId: ownerId } })).toBe(1);

    await repository.expandReminder({
      userId: ownerId,
      reminderId: first.id,
      from: now,
      through: new Date("2026-08-04T06:00:00.000Z"),
      now,
    });
    const owner = await repository.listReminders(ownerId, now);
    const other = await repository.listReminders(otherId, now);
    expect(owner.reminders[0]).toMatchObject({
      id: first.id,
      nextOccurrence: { version: 1 },
    });
    expect(other.reminders).toEqual([]);
  });

  it("rejects a cross-owner occurrence action and applies an owned snooze once", async () => {
    const occurrence = await prisma.reminderOccurrence.findFirstOrThrow({
      where: { reminder: { userId: ownerId }, status: "PENDING" },
      orderBy: { scheduledFor: "asc" },
    });
    await expect(
      repository.actOnOccurrence({
        userId: otherId,
        occurrenceId: occurrence.id,
        action: "skip",
        expectedVersion: occurrence.version,
        snoozedUntil: null,
        now,
      }),
    ).resolves.toBe("not_found");

    const snoozedUntil = new Date(occurrence.scheduledFor.getTime() + 600_000);
    await expect(
      repository.actOnOccurrence({
        userId: ownerId,
        occurrenceId: occurrence.id,
        action: "snooze",
        expectedVersion: occurrence.version,
        snoozedUntil,
        now,
      }),
    ).resolves.toBe("DEFERRED");
    await expect(
      repository.actOnOccurrence({
        userId: ownerId,
        occurrenceId: occurrence.id,
        action: "snooze",
        expectedVersion: occurrence.version,
        snoozedUntil,
        now,
      }),
    ).resolves.toBe("conflict");
  });
});
