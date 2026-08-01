import { describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@/features/auth/domain/auth-types";
import { NotificationService } from "@/features/notifications/application/notification-service";
import type {
  NotificationRepository,
  WebPushResult,
  WebPushGateway,
} from "@/features/notifications/application/ports";
import { NotificationWorker } from "@/features/notifications/application/notification-worker";

const now = new Date("2026-08-01T12:00:00.000Z");
const actor = {
  id: "23238b54-ab60-4167-b760-e312b39a53af",
  email: "notifications@example.test",
  displayName: "Notification Owner",
  passwordHash: null,
  emailVerifiedAt: now,
  status: "ACTIVE",
  permissionVersion: 1,
  permissions: [
    "notifications:read:own",
    "notifications:write:own",
    "notifications:push:own",
  ],
} satisfies AuthUser;

describe("NotificationService", () => {
  it("runs owner-scoped catch-up before composing the overview", async () => {
    const repository = repositoryMock();
    const worker = {
      run: vi.fn().mockResolvedValue({
        claimed: 0,
        delivered: 0,
        deferred: 0,
        failed: 0,
      }),
    } as unknown as NotificationWorker;
    const service = serviceWith(repository, worker, push(false));
    const result = await service.overview(actor);
    expect(worker.run).toHaveBeenCalledWith({ userId: actor.id, limit: 20 });
    expect(result.inbox.unreadCount).toBe(0);
    expect(result.push.configured).toBe(false);
  });

  it("rejects Push registration when VAPID is unavailable before storing capabilities", async () => {
    const repository = repositoryMock();
    const service = serviceWith(
      repository,
      { run: vi.fn() } as unknown as NotificationWorker,
      push(false),
    );
    await expect(
      service.registerPush(actor, {
        endpoint: "https://push.example/1",
        expirationTime: null,
        keys: { p256dh: "p", auth: "a" },
        deviceName: null,
        locale: "bn-BD",
        userAgent: null,
      }),
    ).rejects.toMatchObject({ code: "DEPENDENCY_UNAVAILABLE" });
    expect(repository.upsertPushSubscription).not.toHaveBeenCalled();
  });

  it("turns optimistic concurrency misses into a stable conflict", async () => {
    const repository = repositoryMock();
    vi.mocked(repository.setNotificationState).mockResolvedValue("conflict");
    const service = serviceWith(
      repository,
      { run: vi.fn() } as unknown as NotificationWorker,
      push(false),
    );
    await expect(
      service.setState(actor, crypto.randomUUID(), "read", 1),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("bounds inbox pages and passes an optional cursor to persistence", async () => {
    const repository = repositoryMock();
    const service = serviceWith(
      repository,
      { run: vi.fn() } as unknown as NotificationWorker,
      push(false),
    );

    await service.inbox(actor, "3b85c332-7e56-4ed2-a469-cfeac5d15bdb", 500);

    expect(repository.listNotifications).toHaveBeenCalledWith({
      userId: actor.id,
      cursor: "3b85c332-7e56-4ed2-a469-cfeac5d15bdb",
      limit: 50,
    });
  });

  it("returns stable not-found and conflict errors for owned mutations", async () => {
    const repository = repositoryMock();
    const service = serviceWith(
      repository,
      { run: vi.fn() } as unknown as NotificationWorker,
      push(false),
    );
    vi.mocked(repository.setNotificationState).mockResolvedValue("not_found");
    await expect(
      service.setState(actor, crypto.randomUUID(), "archive", 1),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    vi.mocked(repository.updatePreferences).mockResolvedValue("conflict");
    await expect(
      service.updatePreferences(actor, {
        ...preferences(),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("registers an enabled Push capability and rejects cross-owner revocation", async () => {
    const repository = repositoryMock();
    const subscription = {
      id: "9c4dc15e-c6ad-4b61-90a8-b9035bf7ed8d",
      deviceName: "Chromium",
      locale: "en" as const,
      expiresAt: null,
      lastSuccessAt: null,
      createdAt: now.toISOString(),
    };
    vi.mocked(repository.upsertPushSubscription).mockResolvedValue(
      subscription,
    );
    vi.mocked(repository.revokePushSubscription).mockResolvedValue(false);
    const service = serviceWith(
      repository,
      { run: vi.fn() } as unknown as NotificationWorker,
      push(true),
    );

    await expect(
      service.registerPush(actor, {
        endpoint: "https://push.example/1",
        expirationTime: null,
        keys: { p256dh: "p", auth: "a" },
        deviceName: "Chromium",
        locale: "en",
        userAgent: "test",
      }),
    ).resolves.toEqual(subscription);
    await expect(
      service.revokePush(actor, subscription.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("records and retires an invalid subscription during a privacy-safe test", async () => {
    const repository = repositoryMock();
    const subscription = {
      id: "9c4dc15e-c6ad-4b61-90a8-b9035bf7ed8d",
      endpoint: "https://push.example/1",
      p256dh: "p",
      auth: "a",
      locale: "en" as const,
    };
    vi.mocked(repository.userContext).mockResolvedValue({
      locale: "en",
      timeZone: "UTC",
    });
    vi.mocked(repository.activePushSubscriptions).mockResolvedValue([
      subscription,
    ]);
    vi.mocked(repository.createTestNotification).mockResolvedValue({
      id: "c5817a4c-30cc-4baa-8c06-e24c11700e9a",
      deepLink: "/en/notifications",
      locale: "en",
      preferenceSnapshot: preferences(),
    });
    vi.mocked(repository.claimDeliveryAttempt).mockResolvedValue({
      id: "1e1b62ff-d7c7-43d4-a3f5-b8e6c6f3aa86",
      attempt: 1,
    });
    const gateway = push(true, {
      ok: false,
      statusCode: 410,
      errorCode: "subscription_invalid",
      retryable: false,
      invalidSubscription: true,
    });
    const service = serviceWith(
      repository,
      { run: vi.fn() } as unknown as NotificationWorker,
      gateway,
    );

    await service.testPush(actor);

    expect(gateway.send).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          title: "Focused Reminder",
          body: "It is time to review your next action.",
        }),
      }),
    );
    expect(repository.completeDeliveryAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PERMANENT_FAILURE" }),
    );
    expect(repository.revokePushSubscriptionById).toHaveBeenCalledWith(
      subscription.id,
      now,
    );
  });

  it("does not create a test notification without an active subscription", async () => {
    const repository = repositoryMock();
    const service = serviceWith(
      repository,
      { run: vi.fn() } as unknown as NotificationWorker,
      push(true),
    );
    await expect(service.testPush(actor)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(repository.createTestNotification).not.toHaveBeenCalled();
  });
});

function serviceWith(
  repository: NotificationRepository,
  worker: NotificationWorker,
  gateway: WebPushGateway,
) {
  return new NotificationService({
    repository,
    worker,
    push: gateway,
    cipher: { encrypt: vi.fn(), decrypt: vi.fn() },
    clock: { now: () => now },
  });
}

function repositoryMock(): NotificationRepository {
  return {
    listNotifications: vi.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
      unreadCount: 0,
    }),
    getPreferences: vi.fn().mockResolvedValue(preferences()),
    listReminders: vi.fn().mockResolvedValue({
      reminders: [],
      timeZone: "Asia/Dhaka",
    }),
    listPushSubscriptions: vi.fn().mockResolvedValue([]),
    upsertPushSubscription: vi.fn(),
    revokePushSubscription: vi.fn(),
    setNotificationState: vi.fn(),
    updatePreferences: vi.fn(),
    userContext: vi.fn().mockResolvedValue({
      locale: "en",
      timeZone: "UTC",
    }),
    activePushSubscriptions: vi.fn().mockResolvedValue([]),
    createTestNotification: vi.fn(),
    claimDeliveryAttempt: vi.fn(),
    completeDeliveryAttempt: vi.fn(),
    revokePushSubscriptionById: vi.fn(),
  } as unknown as NotificationRepository;
}

function push(configured: boolean, result?: WebPushResult): WebPushGateway {
  return {
    configured,
    publicKey: configured ? "public" : null,
    send: vi.fn().mockResolvedValue(result),
  };
}

function preferences() {
  return {
    categories: {
      reminder: { inApp: true, webPush: true },
      focus: { inApp: true, webPush: true },
      habit: { inApp: true, webPush: true },
      goal: { inApp: true, webPush: true },
      planning: { inApp: true, webPush: true },
      system: { inApp: true, webPush: false },
    },
    quietHours: {
      enabled: true,
      start: "22:00",
      end: "07:00",
      timeZone: "Asia/Dhaka",
    },
    previewPolicy: "MINIMAL" as const,
    version: 1,
    updatedAt: null,
  };
}
