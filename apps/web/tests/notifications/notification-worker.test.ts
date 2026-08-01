import { describe, expect, it, vi } from "vitest";

import { NotificationWorker } from "@/features/notifications/application/notification-worker";
import type {
  DeliveryContext,
  NotificationRepository,
  WebPushGateway,
} from "@/features/notifications/application/ports";
import { defaultPreferences } from "@/features/notifications/domain/notification-policy";

const now = new Date("2026-08-01T18:30:00.000Z");

describe("NotificationWorker delivery policy", () => {
  it("defers an occurrence during overnight quiet hours without materializing content", async () => {
    const repository = repositoryMock();
    vi.mocked(repository.claimDueOccurrences).mockResolvedValue([
      { id: "occ-1" },
    ]);
    vi.mocked(repository.deliveryContext).mockResolvedValue(context());
    const worker = workerWith(repository, pushMock());

    const result = await worker.run();

    expect(result).toMatchObject({ claimed: 1, deferred: 1, delivered: 0 });
    expect(repository.deferOccurrence).toHaveBeenCalledWith(
      expect.objectContaining({ occurrenceId: "occ-1" }),
    );
    expect(repository.materializeNotification).not.toHaveBeenCalled();
  });

  it("retires a permanently invalid subscription without exposing private copy", async () => {
    const repository = repositoryMock();
    const delivery = context({ quiet: false });
    vi.mocked(repository.claimDueOccurrences).mockResolvedValue([
      { id: "occ-1" },
    ]);
    vi.mocked(repository.deliveryContext).mockResolvedValue(delivery);
    vi.mocked(repository.materializeNotification).mockResolvedValue({
      id: "notif-1",
      deepLink: "/bn-BD/notifications",
      locale: "bn-BD",
      preferenceSnapshot: delivery.preferences,
    });
    vi.mocked(repository.activePushSubscriptions).mockResolvedValue([
      {
        id: "sub-1",
        endpoint: "https://push.example/1",
        p256dh: "p256dh",
        auth: "auth",
        locale: "bn-BD",
      },
    ]);
    vi.mocked(repository.claimDeliveryAttempt).mockResolvedValue({
      id: "attempt-1",
      attempt: 1,
    });
    const push = pushMock({
      ok: false,
      statusCode: 410,
      errorCode: "subscription_invalid",
      retryable: false,
      invalidSubscription: true,
    });

    const result = await workerWith(repository, push).run();

    expect(result.delivered).toBe(1);
    expect(push.send).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          title: "Focused Reminder",
          body: "পরবর্তী কাজটি দেখার সময় হয়েছে।",
        }),
      }),
    );
    expect(JSON.stringify(vi.mocked(push.send).mock.calls)).not.toContain(
      "Private goal title",
    );
    expect(repository.revokePushSubscriptionById).toHaveBeenCalledWith(
      "sub-1",
      now,
    );
  });

  it("requeues a retryable Push failure while preserving delivery dedupe", async () => {
    const repository = repositoryMock();
    const delivery = context({ quiet: false });
    vi.mocked(repository.claimDueOccurrences).mockResolvedValue([
      { id: "occ-1" },
    ]);
    vi.mocked(repository.deliveryContext).mockResolvedValue(delivery);
    vi.mocked(repository.materializeNotification).mockResolvedValue({
      id: "notif-1",
      deepLink: "/bn-BD/notifications",
      locale: "bn-BD",
      preferenceSnapshot: delivery.preferences,
    });
    vi.mocked(repository.activePushSubscriptions).mockResolvedValue([
      {
        id: "sub-1",
        endpoint: "https://push.example/1",
        p256dh: "p256dh",
        auth: "auth",
        locale: "bn-BD",
      },
    ]);
    vi.mocked(repository.claimDeliveryAttempt).mockResolvedValue({
      id: "attempt-1",
      attempt: 1,
    });
    const push = pushMock({
      ok: false,
      statusCode: 503,
      errorCode: "push_provider_retryable",
      retryable: true,
      invalidSubscription: false,
    });

    const result = await workerWith(repository, push).run();

    expect(result.deferred).toBe(1);
    expect(repository.completeDeliveryAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ status: "RETRYABLE_FAILURE" }),
    );
    expect(repository.deferOccurrence).toHaveBeenCalledWith(
      expect.objectContaining({ occurrenceId: "occ-1" }),
    );
  });
});

function workerWith(repository: NotificationRepository, push: WebPushGateway) {
  return new NotificationWorker({
    repository,
    push,
    cipher: { encrypt: vi.fn(), decrypt: vi.fn() },
    clock: { now: () => now },
  });
}

function context(options: { quiet?: boolean } = {}): DeliveryContext {
  const preferences = defaultPreferences("Asia/Dhaka");
  return {
    occurrenceId: "occ-1",
    userId: "user-1",
    category: "reminder",
    reminderTitle: "Private goal title",
    reminderBody: "Private details",
    scheduledFor: now,
    expiresAt: new Date("2026-08-02T18:30:00.000Z"),
    locale: "bn-BD",
    channels: { inApp: true, webPush: true },
    preferences: {
      ...preferences,
      quietHours: { ...preferences.quietHours, enabled: options.quiet ?? true },
    },
  };
}

function repositoryMock(): NotificationRepository {
  return {
    expandActiveReminders: vi.fn().mockResolvedValue(0),
    claimDueOccurrences: vi.fn().mockResolvedValue([]),
    deliveryContext: vi.fn().mockResolvedValue(null),
    deferOccurrence: vi.fn().mockResolvedValue(undefined),
    materializeNotification: vi.fn(),
    failOccurrence: vi.fn().mockResolvedValue(undefined),
    countRecentPushes: vi.fn().mockResolvedValue(0),
    activePushSubscriptions: vi.fn().mockResolvedValue([]),
    claimDeliveryAttempt: vi.fn().mockResolvedValue(null),
    completeDeliveryAttempt: vi.fn().mockResolvedValue(undefined),
    revokePushSubscriptionById: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationRepository;
}

function pushMock(
  result: Awaited<ReturnType<WebPushGateway["send"]>> = {
    ok: true,
    statusCode: 201,
    errorCode: null,
    retryable: false,
    invalidSubscription: false,
  },
): WebPushGateway {
  return {
    configured: true,
    publicKey: "public",
    send: vi.fn().mockResolvedValue(result),
  };
}
