import type { Clock } from "@/application/ports/clock";
import type { SecretCipher } from "@/features/auth/application/oauth-ports";
import type {
  DeliveryContext,
  NotificationRepository,
  WebPushGateway,
} from "@/features/notifications/application/ports";
import {
  isInQuietHours,
  nextQuietHoursEnd,
  notificationLimits,
  safePushCopy,
} from "@/features/notifications/domain/notification-policy";

interface NotificationWorkerDependencies {
  readonly repository: NotificationRepository;
  readonly push: WebPushGateway;
  readonly cipher: SecretCipher;
  readonly clock: Clock;
}

export interface NotificationWorkerResult {
  readonly claimed: number;
  readonly delivered: number;
  readonly deferred: number;
  readonly failed: number;
}

export class NotificationWorker {
  constructor(private readonly dependencies: NotificationWorkerDependencies) {}

  async run(
    input: {
      readonly userId?: string;
      readonly limit?: number;
    } = {},
  ): Promise<NotificationWorkerResult> {
    const now = this.dependencies.clock.now();
    await this.dependencies.repository.expandActiveReminders({
      through: new Date(
        now.getTime() + notificationLimits.expansionDays * 86_400_000,
      ),
      now,
      limit: input.userId ? 1 : 50,
      ...(input.userId ? { userId: input.userId } : {}),
    });
    const occurrences = await this.dependencies.repository.claimDueOccurrences({
      now,
      limit: input.limit ?? notificationLimits.workerBatchSize,
      ...(input.userId ? { userId: input.userId } : {}),
    });
    const result = {
      claimed: occurrences.length,
      delivered: 0,
      deferred: 0,
      failed: 0,
    };
    for (const occurrence of occurrences) {
      try {
        const outcome = await this.deliver(occurrence.id, now);
        result[outcome] += 1;
      } catch {
        await this.dependencies.repository.failOccurrence(
          occurrence.id,
          this.dependencies.clock.now(),
        );
        result.failed += 1;
      }
    }
    return result;
  }

  private async deliver(
    occurrenceId: string,
    now: Date,
  ): Promise<"delivered" | "deferred"> {
    const context =
      await this.dependencies.repository.deliveryContext(occurrenceId);
    if (!context) return "delivered";
    if (isInQuietHours(now, context.preferences.quietHours)) {
      await this.dependencies.repository.deferOccurrence({
        occurrenceId,
        until: nextQuietHoursEnd(now, context.preferences.quietHours),
        now,
      });
      return "deferred";
    }
    const notification =
      await this.dependencies.repository.materializeNotification({
        context,
        now,
      });
    if (!context.channels.webPush || !this.dependencies.push.configured) {
      return "delivered";
    }
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (
      (await this.dependencies.repository.countRecentPushes(
        context.userId,
        since,
      )) >= notificationLimits.maxPushesPerDay
    ) {
      return "delivered";
    }
    const retryable = await this.deliverPush(context, notification, now);
    if (retryable) {
      await this.dependencies.repository.deferOccurrence({
        occurrenceId: context.occurrenceId,
        until: new Date(this.dependencies.clock.now().getTime() + 60_000),
        now: this.dependencies.clock.now(),
      });
      return "deferred";
    }
    return "delivered";
  }

  private async deliverPush(
    context: DeliveryContext,
    notification: Awaited<
      ReturnType<NotificationRepository["materializeNotification"]>
    >,
    now: Date,
  ): Promise<boolean> {
    const subscriptions =
      await this.dependencies.repository.activePushSubscriptions(
        context.userId,
        this.dependencies.cipher,
      );
    const copy = safePushCopy(
      context.locale,
      context.preferences.previewPolicy,
    );
    let retryable = false;
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
          locale: subscription.locale,
        },
        topic: notification.id.replaceAll("-", "").slice(0, 32),
        expiresAt: context.expiresAt,
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
      retryable ||= result.retryable;
      if (result.invalidSubscription) {
        await this.dependencies.repository.revokePushSubscriptionById(
          subscription.id,
          this.dependencies.clock.now(),
        );
      }
    }
    return retryable;
  }
}
