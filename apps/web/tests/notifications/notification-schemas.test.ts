import { describe, expect, it } from "vitest";

import {
  createReminderSchema,
  preferenceUpdateSchema,
  pushSubscriptionSchema,
} from "@/features/notifications/transport/notification-schemas";

describe("notification transport validation", () => {
  it("normalizes duplicate weekdays and rejects unbounded recurrence", () => {
    const result = createReminderSchema.parse({
      title: "Plan the week",
      body: null,
      timeZone: "Asia/Dhaka",
      schedule: {
        kind: "weekly",
        startsOn: "2026-08-03",
        localTime: "09:00",
        weekdays: [3, 1, 3],
      },
      channels: { inApp: true, webPush: false },
      clientCommandId: crypto.randomUUID(),
    });
    expect(result.schedule).toMatchObject({ weekdays: [1, 3] });
    expect(
      createReminderSchema.safeParse({
        ...result,
        schedule: {
          kind: "daily",
          startsOn: "2026-08-03",
          localTime: "09:00",
          interval: 31,
        },
      }).success,
    ).toBe(false);
  });

  it("requires HTTPS Push capability endpoints", () => {
    const base = {
      endpoint: "http://push.example/subscription",
      expirationTime: null,
      keys: { p256dh: "p".repeat(65), auth: "a".repeat(20) },
      deviceName: "Test",
      locale: "bn-BD",
    };
    expect(pushSubscriptionSchema.safeParse(base).success).toBe(false);
    expect(
      pushSubscriptionSchema.safeParse({
        ...base,
        endpoint: "https://push.example/subscription",
      }).success,
    ).toBe(true);
  });

  it("requires an explicit preference for every category", () => {
    expect(
      preferenceUpdateSchema.safeParse({
        categories: {},
        quietHours: {
          enabled: true,
          start: "22:00",
          end: "07:00",
          timeZone: "Asia/Dhaka",
        },
        previewPolicy: "MINIMAL",
        expectedVersion: 1,
      }).success,
    ).toBe(false);
  });
});
