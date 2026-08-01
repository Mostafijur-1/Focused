import webPush from "web-push";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NodeWebPushGateway } from "@/features/notifications/infrastructure/push/web-push-gateway";

vi.mock("web-push", () => ({
  default: { sendNotification: vi.fn() },
}));

const subscription = {
  id: "sub-1",
  endpoint: "https://push.example/subscription",
  p256dh: "p256dh",
  auth: "auth",
  locale: "bn-BD" as const,
};

describe("NodeWebPushGateway", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports configuration availability without making a network call", async () => {
    const gateway = new NodeWebPushGateway({
      subject: undefined,
      publicKey: undefined,
      privateKey: undefined,
    });
    expect(gateway.configured).toBe(false);
    await expect(
      gateway.send({
        subscription,
        payload: payload(),
        topic: "topic",
        expiresAt: null,
      }),
    ).resolves.toMatchObject({ ok: false, errorCode: "push_not_configured" });
    expect(webPush.sendNotification).not.toHaveBeenCalled();
  });

  it("encrypts and sends a bounded, coalesced payload with VAPID", async () => {
    vi.mocked(webPush.sendNotification).mockResolvedValue({
      statusCode: 201,
      body: "",
      headers: {},
    });
    const gateway = configured();
    const result = await gateway.send({
      subscription,
      payload: payload(),
      topic: "notification-topic",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    expect(result).toMatchObject({ ok: true, statusCode: 201 });
    expect(webPush.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: subscription.endpoint }),
      JSON.stringify(payload()),
      expect.objectContaining({
        TTL: expect.any(Number),
        topic: "notification-topic",
        vapidDetails: expect.objectContaining({ publicKey: "public" }),
      }),
    );
  });

  it.each([
    [410, "subscription_invalid", false, true],
    [429, "push_provider_retryable", true, false],
    [503, "push_provider_retryable", true, false],
    [400, "push_provider_rejected", false, false],
  ])(
    "normalizes provider status %i",
    async (statusCode, errorCode, retryable, invalidSubscription) => {
      vi.mocked(webPush.sendNotification).mockRejectedValue({ statusCode });
      await expect(
        configured().send({
          subscription,
          payload: payload(),
          topic: "topic",
          expiresAt: null,
        }),
      ).resolves.toMatchObject({
        ok: false,
        statusCode,
        errorCode,
        retryable,
        invalidSubscription,
      });
    },
  );
});

function configured() {
  return new NodeWebPushGateway({
    subject: "mailto:notifications@example.com",
    publicKey: "public",
    privateKey: "private",
  });
}

function payload() {
  return {
    title: "Focused Reminder",
    body: "A safe preview",
    notificationId: "notification-1",
    deepLink: "/bn-BD/notifications",
    locale: "bn-BD" as const,
  };
}
