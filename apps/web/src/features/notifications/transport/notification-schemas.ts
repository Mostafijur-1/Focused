import { z } from "zod";

import { notificationCategories } from "@/features/notifications/domain/notification-types";

const uuid = z.uuid();
const isoDate = z.iso.date();
const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const locale = z.enum(["bn-BD", "en"]);
const channelPreference = z
  .object({ inApp: z.boolean(), webPush: z.boolean() })
  .strict();

export const inboxQuerySchema = z.object({
  cursor: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export const notificationStateSchema = z
  .object({
    action: z.enum(["read", "unread", "archive", "restore"]),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const preferenceUpdateSchema = z
  .object({
    categories: z.object(
      Object.fromEntries(
        notificationCategories.map((category) => [category, channelPreference]),
      ) as Record<
        (typeof notificationCategories)[number],
        typeof channelPreference
      >,
    ),
    quietHours: z
      .object({
        enabled: z.boolean(),
        start: localTime,
        end: localTime,
        timeZone: z.string().trim().min(1).max(80),
      })
      .strict(),
    previewPolicy: z.enum(["MINIMAL", "HIDDEN"]),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

const reminderSchedule = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("once"), at: z.iso.datetime({ offset: true }) })
    .strict(),
  z
    .object({
      kind: z.literal("daily"),
      startsOn: isoDate,
      localTime,
      interval: z.number().int().min(1).max(30),
    })
    .strict(),
  z
    .object({
      kind: z.literal("weekly"),
      startsOn: isoDate,
      localTime,
      weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    })
    .strict()
    .transform((value) => ({
      ...value,
      weekdays: [...new Set(value.weekdays)].sort(
        (left, right) => left - right,
      ),
    })),
]);

const reminderFields = {
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(500).nullable().default(null),
  timeZone: z.string().trim().min(1).max(80),
  schedule: reminderSchedule,
  channels: channelPreference,
};

export const createReminderSchema = z
  .object({
    ...reminderFields,
    clientCommandId: uuid,
  })
  .strict();

export const updateReminderSchema = z
  .object({
    ...reminderFields,
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const reminderStateSchema = z
  .object({
    action: z.enum(["pause", "resume", "complete", "cancel"]),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const deleteReminderQuerySchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
});

export const occurrenceActionSchema = z
  .object({
    action: z.enum(["snooze", "skip", "complete"]),
    expectedVersion: z.number().int().positive(),
    snoozedUntil: z.iso.datetime({ offset: true }).nullable().default(null),
  })
  .strict();

export const pushSubscriptionSchema = z
  .object({
    endpoint: z.url().max(4096),
    expirationTime: z.number().nonnegative().nullable(),
    keys: z
      .object({
        p256dh: z.string().min(20).max(256),
        auth: z.string().min(10).max(128),
      })
      .strict(),
    deviceName: z.string().trim().max(120).nullable().default(null),
    locale,
  })
  .strict()
  .refine(
    (value) => {
      const protocol = new URL(value.endpoint).protocol;
      return protocol === "https:";
    },
    { path: ["endpoint"], message: "Push endpoint must use HTTPS." },
  );

export const workerTickSchema = z
  .object({
    reason: z.enum(["schedule", "reminder_changed", "reconcile"]),
    schemaVersion: z.literal(1),
  })
  .strict();

const notificationItemSchema = z.object({
  id: uuid,
  category: z.enum(notificationCategories),
  title: z.string(),
  body: z.string().nullable(),
  deepLink: z.string().nullable(),
  readAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  version: z.number().int().positive(),
});

const preferenceSchema = z.object({
  categories: z.object(
    Object.fromEntries(
      notificationCategories.map((category) => [category, channelPreference]),
    ) as Record<
      (typeof notificationCategories)[number],
      typeof channelPreference
    >,
  ),
  quietHours: z.object({
    enabled: z.boolean(),
    start: localTime,
    end: localTime,
    timeZone: z.string(),
  }),
  previewPolicy: z.enum(["MINIMAL", "HIDDEN"]),
  version: z.number().int().positive(),
  updatedAt: z.string().nullable(),
});

const reminderSchema = z.object({
  id: uuid,
  title: z.string(),
  body: z.string().nullable(),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]),
  timeZone: z.string(),
  schedule: reminderSchedule,
  channels: channelPreference,
  nextOccurrenceAt: z.string().nullable(),
  nextOccurrence: z
    .object({
      id: uuid,
      scheduledFor: z.string(),
      version: z.number().int().positive(),
    })
    .nullable(),
  lastOutcome: z
    .enum([
      "PENDING",
      "DEFERRED",
      "ENQUEUED",
      "DELIVERED",
      "COMPLETED",
      "MISSED",
      "CANCELLED",
      "FAILED",
    ])
    .nullable(),
  ruleVersion: z.number().int().positive(),
  version: z.number().int().positive(),
  createdAt: z.string(),
});

const pushSubscriptionSummarySchema = z.object({
  id: uuid,
  deviceName: z.string().nullable(),
  locale,
  expiresAt: z.string().nullable(),
  lastSuccessAt: z.string().nullable(),
  createdAt: z.string(),
});

export const notificationOverviewResponseSchema = z.object({
  data: z.object({
    inbox: z.object({
      items: z.array(notificationItemSchema),
      nextCursor: uuid.nullable(),
      unreadCount: z.number().int().nonnegative(),
    }),
    preferences: preferenceSchema,
    reminders: z.object({
      reminders: z.array(reminderSchema),
      timeZone: z.string(),
    }),
    push: z.object({
      configured: z.boolean(),
      publicKey: z.string().nullable(),
      subscriptions: z.array(pushSubscriptionSummarySchema),
    }),
  }),
});

export const notificationResponseSchema = z.object({
  data: notificationItemSchema,
});
export const preferenceResponseSchema = z.object({ data: preferenceSchema });
export const reminderResponseSchema = z.object({ data: reminderSchema });
export const pushSubscriptionResponseSchema = z.object({
  data: pushSubscriptionSummarySchema,
});
