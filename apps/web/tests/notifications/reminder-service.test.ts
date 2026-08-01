import { describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@/features/auth/domain/auth-types";
import type {
  NotificationRepository,
  ReminderJobScheduler,
} from "@/features/notifications/application/ports";
import { ReminderService } from "@/features/notifications/application/reminder-service";
import type { ReminderSummary } from "@/features/notifications/domain/notification-types";

const now = new Date("2026-08-01T12:00:00.000Z");
const actor = {
  id: "23238b54-ab60-4167-b760-e312b39a53af",
  email: "reminders@example.test",
  displayName: "Reminder Owner",
  passwordHash: null,
  emailVerifiedAt: now,
  status: "ACTIVE",
  permissionVersion: 1,
  permissions: ["reminders:read:own", "reminders:write:own"],
} satisfies AuthUser;

describe("ReminderService", () => {
  it("persists and expands a reminder before requesting an optional queue tick", async () => {
    const reminder = summary();
    const repository = {
      countActiveReminders: vi.fn().mockResolvedValue(1),
      createReminder: vi.fn().mockResolvedValue(reminder),
      expandReminder: vi.fn().mockResolvedValue(31),
      listReminders: vi.fn().mockResolvedValue({
        reminders: [reminder],
        timeZone: "Asia/Dhaka",
      }),
    } as unknown as NotificationRepository;
    const scheduler: ReminderJobScheduler = {
      configured: true,
      requestTick: vi.fn().mockResolvedValue(undefined),
    };
    const service = new ReminderService({
      repository,
      scheduler,
      clock: { now: () => now },
    });

    const result = await service.create(actor, {
      title: "Start focus",
      body: null,
      timeZone: "Asia/Dhaka",
      schedule: {
        kind: "daily",
        startsOn: "2026-08-02",
        localTime: "09:00",
        interval: 1,
      },
      channels: { inApp: true, webPush: false },
      clientCommandId: crypto.randomUUID(),
    });

    expect(repository.createReminder).toHaveBeenCalled();
    expect(repository.expandReminder).toHaveBeenCalledWith(
      expect.objectContaining({ reminderId: reminder.id }),
    );
    expect(scheduler.requestTick).toHaveBeenCalledOnce();
    expect(result.id).toBe(reminder.id);
  });

  it("does not roll back user intent when QStash is temporarily unavailable", async () => {
    const reminder = summary();
    const repository = {
      countActiveReminders: vi.fn().mockResolvedValue(0),
      createReminder: vi.fn().mockResolvedValue(reminder),
      expandReminder: vi.fn().mockResolvedValue(1),
      listReminders: vi.fn().mockResolvedValue({
        reminders: [reminder],
        timeZone: "UTC",
      }),
    } as unknown as NotificationRepository;
    const service = new ReminderService({
      repository,
      scheduler: {
        configured: true,
        requestTick: vi.fn().mockRejectedValue(new Error("queue unavailable")),
      },
      clock: { now: () => now },
    });
    await expect(
      service.create(actor, {
        title: "One-time",
        body: null,
        timeZone: "UTC",
        schedule: { kind: "once", at: "2099-01-01T00:00:00.000Z" },
        channels: { inApp: true, webPush: true },
        clientCommandId: crypto.randomUUID(),
      }),
    ).resolves.toMatchObject({ id: reminder.id });
  });

  it("enforces ownership permission before repository access", async () => {
    const repository = {
      listReminders: vi.fn(),
    } as unknown as NotificationRepository;
    const service = new ReminderService({
      repository,
      scheduler: { configured: false, requestTick: vi.fn() },
      clock: { now: () => now },
    });
    await expect(
      service.list({ ...actor, permissions: [] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repository.listReminders).not.toHaveBeenCalled();
  });

  it("validates one-time schedules against the injected authoritative clock", async () => {
    const repository = {
      countActiveReminders: vi.fn(),
      createReminder: vi.fn(),
    } as unknown as NotificationRepository;
    const service = new ReminderService({
      repository,
      scheduler: { configured: false, requestTick: vi.fn() },
      clock: { now: () => now },
    });

    await expect(
      service.create(actor, {
        title: "Already due",
        body: null,
        timeZone: "UTC",
        schedule: { kind: "once", at: now.toISOString() },
        channels: { inApp: true, webPush: false },
        clientCommandId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(repository.countActiveReminders).not.toHaveBeenCalled();
    expect(repository.createReminder).not.toHaveBeenCalled();
  });
});

function summary(): ReminderSummary {
  return {
    id: "12afdc35-e6ac-470f-b6f8-44338084760a",
    title: "Start focus",
    body: null,
    status: "ACTIVE",
    timeZone: "Asia/Dhaka",
    schedule: {
      kind: "daily",
      startsOn: "2026-08-02",
      localTime: "09:00",
      interval: 1,
    },
    channels: { inApp: true, webPush: false },
    nextOccurrenceAt: null,
    nextOccurrence: null,
    lastOutcome: null,
    ruleVersion: 1,
    version: 1,
    createdAt: now.toISOString(),
  };
}
