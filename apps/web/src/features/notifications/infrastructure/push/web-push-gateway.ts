import webPush from "web-push";

import type {
  WebPushGateway,
  WebPushResult,
} from "@/features/notifications/application/ports";
import { notificationLimits } from "@/features/notifications/domain/notification-policy";

interface WebPushGatewayOptions {
  readonly subject: string | undefined;
  readonly publicKey: string | undefined;
  readonly privateKey: string | undefined;
}

export class NodeWebPushGateway implements WebPushGateway {
  readonly configured: boolean;
  readonly publicKey: string | null;
  private readonly options: WebPushGatewayOptions;

  constructor(options: WebPushGatewayOptions) {
    this.options = options;
    this.configured = Boolean(
      options.subject && options.publicKey && options.privateKey,
    );
    this.publicKey = this.configured ? options.publicKey! : null;
  }

  async send(
    input: Parameters<WebPushGateway["send"]>[0],
  ): Promise<WebPushResult> {
    if (!this.configured) {
      return failure(null, "push_not_configured", false, false);
    }
    const ttl = input.expiresAt
      ? Math.max(
          0,
          Math.min(
            notificationLimits.pushTtlSeconds,
            Math.floor((input.expiresAt.getTime() - Date.now()) / 1000),
          ),
        )
      : notificationLimits.pushTtlSeconds;
    if (ttl === 0) return failure(null, "notification_expired", false, false);
    try {
      const response = await webPush.sendNotification(
        {
          endpoint: input.subscription.endpoint,
          keys: {
            p256dh: input.subscription.p256dh,
            auth: input.subscription.auth,
          },
        },
        JSON.stringify(input.payload),
        {
          vapidDetails: {
            subject: this.options.subject!,
            publicKey: this.options.publicKey!,
            privateKey: this.options.privateKey!,
          },
          TTL: ttl,
          urgency: "normal",
          topic: input.topic,
          timeout: 10_000,
        },
      );
      return {
        ok: response.statusCode >= 200 && response.statusCode < 300,
        statusCode: response.statusCode,
        errorCode: null,
        retryable: false,
        invalidSubscription: false,
      };
    } catch (error) {
      const statusCode = statusCodeOf(error);
      const invalid = statusCode === 404 || statusCode === 410;
      const retryable =
        statusCode === 408 ||
        statusCode === 429 ||
        (statusCode !== null && statusCode >= 500);
      return failure(
        statusCode,
        invalid
          ? "subscription_invalid"
          : retryable
            ? "push_provider_retryable"
            : "push_provider_rejected",
        retryable,
        invalid,
      );
    }
  }
}

function failure(
  statusCode: number | null,
  errorCode: string,
  retryable: boolean,
  invalidSubscription: boolean,
): WebPushResult {
  return { ok: false, statusCode, errorCode, retryable, invalidSubscription };
}

function statusCodeOf(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("statusCode" in error))
    return null;
  return typeof error.statusCode === "number" ? error.statusCode : null;
}
