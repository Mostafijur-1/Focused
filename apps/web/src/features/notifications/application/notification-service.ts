import type { Clock } from "@/application/ports/clock";
import { requirePermission } from "@/features/auth/application/authorization-policy";
import type { SecretCipher } from "@/features/auth/application/oauth-ports";
import type { AuthUser } from "@/features/auth/domain/auth-types";
import type {
  NotificationRepository,
  NotificationStateAction,
  PreferenceUpdateDraft,
  PushSubscriptionDraft,
  WebPushGateway,
} from "@/features/notifications/application/ports";
import type { NotificationWorker } from "@/features/notifications/application/notification-worker";
import {
  notificationLimits,
  safePushCopy,
} from "@/features/notifications/domain/notification-policy";
import type {
  NotificationItem,
  NotificationOverview,
  NotificationPage,
  NotificationPreferences,
  PushSubscriptionSummary,
} from "@/features/notifications/domain/notification-types";
import { AppError } from "@/lib/errors/app-error";

interface NotificationServiceDependencies {
  readonly repository: NotificationRepository;
  readonly push: WebPushGateway;
  readonly cipher: SecretCipher;
  readonly clock: Clock;
  readonly worker: NotificationWorker;
}

export class NotificationService {
  constructor(private readonly dependencies: NotificationServiceDependencies) {}

  async overview(
    user: AuthUser,
    cursor?: string,
  ): Promise<NotificationOverview> {
    requirePermission(user, "notifications:read:own");
    await this.dependencies.worker.run({ userId: user.id, limit: 20 });
    const [inbox, preferences, reminders, subscriptions] = await Promise.all([
      this.dependencies.repository.listNotifications({
        userId: user.id,
        ...(cursor ? { cursor } : {}),
        limit: notificationLimits.inboxPageSize,
      }),
      this.dependencies.repository.getPreferences(user.id),
      this.dependencies.repository.listReminders(
        user.id,
        this.dependencies.clock.now(),
      ),
      this.dependencies.repository.listPushSubscriptions(user.id),
    ]);
    return {
      inbox,
      preferences,
      reminders,
      push: {
        configured: this.dependencies.push.configured,
        publicKey: this.dependencies.push.publicKey,
        subscriptions,
      },
    };
  }

  async inbox(
    user: AuthUser,
    cursor?: string,
    limit: number = notificationLimits.inboxPageSize,
  ): Promise<NotificationPage> {
    requirePermission(user, "notifications:read:own");
    return this.dependencies.repository.listNotifications({
      userId: user.id,
      ...(cursor ? { cursor } : {}),
      limit: Math.min(limit, notificationLimits.maxInboxPageSize),
    });
  }

  async setState(
    user: AuthUser,
    notificationId: string,
    action: NotificationStateAction,
    expectedVersion: number,
  ): Promise<NotificationItem> {
    requirePermission(user, "notifications:write:own");
    const result = await this.dependencies.repository.setNotificationState({
      userId: user.id,
      notificationId,
      action,
      expectedVersion,
      now: this.dependencies.clock.now(),
    });
    return requireMutation(result, "Notification");
  }

  async preferences(user: AuthUser): Promise<NotificationPreferences> {
    requirePermission(user, "notifications:read:own");
    return this.dependencies.repository.getPreferences(user.id);
  }

  async updatePreferences(
    user: AuthUser,
    input: PreferenceUpdateDraft,
  ): Promise<NotificationPreferences> {
    requirePermission(user, "notifications:write:own");
    const result = await this.dependencies.repository.updatePreferences({
      userId: user.id,
      value: input,
      now: this.dependencies.clock.now(),
    });
    if (result === "conflict") throw conflict();
    return result;
  }

  async registerPush(
    user: AuthUser,
    input: PushSubscriptionDraft,
  ): Promise<PushSubscriptionSummary> {
    requirePermission(user, "notifications:push:own");
    if (!this.dependencies.push.configured) {
      throw new AppError({
        code: "DEPENDENCY_UNAVAILABLE",
        safeMessage: "Web Push is not configured for this environment.",
      });
    }
    return this.dependencies.repository.upsertPushSubscription({
      userId: user.id,
      value: input,
      cipher: this.dependencies.cipher,
      now: this.dependencies.clock.now(),
    });
  }

  async revokePush(user: AuthUser, subscriptionId: string): Promise<void> {
    requirePermission(user, "notifications:push:own");
    const revoked = await this.dependencies.repository.revokePushSubscription({
      userId: user.id,
      subscriptionId,
      now: this.dependencies.clock.now(),
    });
    if (!revoked) notFound("Push subscription");
  }

  async testPush(user: AuthUser): Promise<void> {
    requirePermission(user, "notifications:push:own");
    if (!this.dependencies.push.configured) {
      throw new AppError({
        code: "DEPENDENCY_UNAVAILABLE",
        safeMessage: "Web Push is not configured for this environment.",
      });
    }
    const now = this.dependencies.clock.now();
    const [context, preferences, subscriptions] = await Promise.all([
      this.dependencies.repository.userContext(user.id),
      this.dependencies.repository.getPreferences(user.id),
      this.dependencies.repository.activePushSubscriptions(
        user.id,
        this.dependencies.cipher,
      ),
    ]);
    if (subscriptions.length === 0) notFound("Active Push subscription");
    const notification =
      await this.dependencies.repository.createTestNotification({
        userId: user.id,
        locale: context.locale,
        preferences,
        now,
      });
    const copy = safePushCopy(context.locale, preferences.previewPolicy);
    for (const subscription of subscriptions) {
      const claim = await this.dependencies.repository.claimDeliveryAttempt({
        notificationId: notification.id,
        subscriptionId: subscription.id,
        now,
      });
      if (!claim) continue;
      const result = await this.dependencies.push.send({
        subscription,
        payload: {
          ...copy,
          notificationId: notification.id,
          deepLink: notification.deepLink,
          locale: context.locale,
        },
        topic: notification.id.replaceAll("-", "").slice(0, 32),
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      });
      await this.dependencies.repository.completeDeliveryAttempt({
        attemptId: claim.id,
        subscriptionId: subscription.id,
        status: result.ok
          ? "SENT"
          : result.invalidSubscription
            ? "PERMANENT_FAILURE"
            : result.retryable
              ? "RETRYABLE_FAILURE"
              : "PERMANENT_FAILURE",
        providerStatusCode: result.statusCode,
        errorCode: result.errorCode,
        now: this.dependencies.clock.now(),
      });
      if (result.invalidSubscription) {
        await this.dependencies.repository.revokePushSubscriptionById(
          subscription.id,
          this.dependencies.clock.now(),
        );
      }
    }
  }
}

function requireMutation<T>(
  value: T | "not_found" | "conflict",
  resource: string,
): T {
  if (value === "not_found") notFound(resource);
  if (value === "conflict") throw conflict();
  return value;
}

function notFound(resource: string): never {
  throw new AppError({
    code: "NOT_FOUND",
    safeMessage: `${resource} was not found.`,
  });
}

function conflict(): AppError {
  return new AppError({
    code: "CONFLICT",
    safeMessage: "The item changed in another session. Reload and try again.",
  });
}
