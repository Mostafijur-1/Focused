import { createHash, randomUUID } from "node:crypto";

import type { FocusedPrismaClient } from "@focused/database";
import { Prisma } from "@focused/database/generated/client";

import type {
  DeliveryAttemptClaim,
  DeliveryContext,
  NotificationRepository,
  PreferenceUpdateDraft,
} from "@/features/notifications/application/ports";
import { defaultPreferences } from "@/features/notifications/domain/notification-policy";
import {
  deserializeSchedule,
  expandSchedule,
  serializeSchedule,
} from "@/features/notifications/domain/reminder-schedule";
import type {
  ChannelPreference,
  NotificationCategory,
  NotificationItem,
  NotificationLocale,
  NotificationPreferences,
  OccurrenceStatus,
  ReminderSchedule,
  ReminderSummary,
} from "@/features/notifications/domain/notification-types";
import { AppError } from "@/lib/errors/app-error";

type TransactionClient = Parameters<
  Parameters<FocusedPrismaClient["$transaction"]>[0]
>[0];

const notificationSelect = {
  id: true,
  category: true,
  title: true,
  body: true,
  deepLink: true,
  readAt: true,
  archivedAt: true,
  expiresAt: true,
  createdAt: true,
  version: true,
} satisfies Prisma.NotificationSelect;

type NotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: FocusedPrismaClient) {}

  async userContext(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timeZone: true, locale: true },
    });
    if (!profile) {
      throw new AppError({
        code: "NOT_FOUND",
        safeMessage: "Profile was not found.",
      });
    }
    return {
      timeZone: profile.timeZone,
      locale: applicationLocale(profile.locale),
    };
  }

  async listNotifications(input: {
    readonly userId: string;
    readonly cursor?: string;
    readonly limit: number;
  }) {
    const now = new Date();
    const where = {
      userId: input.userId,
      archivedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    } satisfies Prisma.NotificationWhereInput;
    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: notificationSelect,
      }),
      this.prisma.notification.count({
        where: { ...where, readAt: null },
      }),
    ]);
    const page = rows.slice(0, input.limit);
    return {
      items: page.map(toNotification),
      nextCursor: rows.length > input.limit ? page.at(-1)!.id : null,
      unreadCount,
    };
  }

  async setNotificationState(input: {
    readonly userId: string;
    readonly notificationId: string;
    readonly action: "read" | "unread" | "archive" | "restore";
    readonly expectedVersion: number;
    readonly now: Date;
  }) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: input.notificationId, userId: input.userId },
      select: { id: true },
    });
    if (!existing) return "not_found" as const;
    const data =
      input.action === "read"
        ? { readAt: input.now }
        : input.action === "unread"
          ? { readAt: null }
          : input.action === "archive"
            ? { archivedAt: input.now }
            : { archivedAt: null };
    const updated = await this.prisma.notification.updateMany({
      where: {
        id: input.notificationId,
        userId: input.userId,
        version: input.expectedVersion,
      },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count === 0) return "conflict" as const;
    const row = await this.prisma.notification.findUniqueOrThrow({
      where: { id: input.notificationId },
      select: notificationSelect,
    });
    return toNotification(row);
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const [row, context] = await Promise.all([
      this.prisma.notificationPreference.findUnique({ where: { userId } }),
      this.userContext(userId),
    ]);
    return row
      ? toPreferences(row, context.timeZone)
      : defaultPreferences(context.timeZone);
  }

  async updatePreferences(input: {
    readonly userId: string;
    readonly value: PreferenceUpdateDraft;
    readonly now: Date;
  }) {
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { userId: input.userId },
      select: { version: true },
    });
    const data = {
      categories: input.value.categories as unknown as Prisma.InputJsonValue,
      quietHours: input.value.quietHours as unknown as Prisma.InputJsonValue,
      digestPolicy: {},
      previewPolicy: input.value.previewPolicy,
    };
    if (!existing) {
      if (input.value.expectedVersion !== 1) return "conflict" as const;
      try {
        const created = await this.prisma.notificationPreference.create({
          data: { userId: input.userId, ...data },
        });
        return toPreferences(created, input.value.quietHours.timeZone);
      } catch (error) {
        if (isUniqueViolation(error)) return "conflict" as const;
        throw error;
      }
    }
    const updated = await this.prisma.notificationPreference.updateMany({
      where: { userId: input.userId, version: input.value.expectedVersion },
      data: { ...data, version: { increment: 1 }, updatedAt: input.now },
    });
    if (updated.count === 0) return "conflict" as const;
    const row = await this.prisma.notificationPreference.findUniqueOrThrow({
      where: { userId: input.userId },
    });
    return toPreferences(row, input.value.quietHours.timeZone);
  }

  async listReminders(userId: string, now: Date) {
    const [context, reminders, nextOccurrences, lastOccurrences] =
      await Promise.all([
        this.userContext(userId),
        this.prisma.reminder.findMany({
          where: { userId, status: { not: "CANCELLED" } },
          orderBy: [{ status: "asc" }, { updatedAt: "desc" }, { id: "desc" }],
        }),
        this.prisma.reminderOccurrence.findMany({
          where: {
            reminder: { userId },
            status: { in: ["PENDING", "DEFERRED", "ENQUEUED"] },
            OR: [
              { scheduledFor: { gte: now } },
              { snoozedUntil: { gte: now } },
            ],
          },
          orderBy: [{ scheduledFor: "asc" }, { id: "asc" }],
          select: {
            id: true,
            reminderId: true,
            scheduledFor: true,
            snoozedUntil: true,
            version: true,
          },
        }),
        this.prisma.reminderOccurrence.findMany({
          where: { reminder: { userId }, scheduledFor: { lte: now } },
          orderBy: [{ scheduledFor: "desc" }, { id: "desc" }],
          distinct: ["reminderId"],
          select: { reminderId: true, status: true },
        }),
      ]);
    const nextByReminder = new Map<
      string,
      { id: string; scheduledFor: Date; version: number }
    >();
    for (const row of nextOccurrences) {
      const effectiveAt = row.snoozedUntil ?? row.scheduledFor;
      const current = nextByReminder.get(row.reminderId);
      if (!current || effectiveAt < current.scheduledFor) {
        nextByReminder.set(row.reminderId, {
          id: row.id,
          scheduledFor: effectiveAt,
          version: row.version,
        });
      }
    }
    const lastByReminder = new Map(
      lastOccurrences.map((row) => [row.reminderId, row.status]),
    );
    return {
      reminders: reminders.map((reminder) =>
        toReminder(
          reminder,
          nextByReminder.get(reminder.id) ?? null,
          lastByReminder.get(reminder.id) ?? null,
        ),
      ),
      timeZone: context.timeZone,
    };
  }

  countActiveReminders(userId: string) {
    return this.prisma.reminder.count({ where: { userId, status: "ACTIVE" } });
  }

  async createReminder(
    input: Parameters<NotificationRepository["createReminder"]>[0],
  ) {
    const replay = await this.prisma.reminder.findUnique({
      where: {
        userId_createdByCommandId: {
          userId: input.userId,
          createdByCommandId: input.clientCommandId,
        },
      },
    });
    if (replay) return toReminder(replay, null, null);
    const stored = serializeSchedule(input.schedule);
    try {
      const row = await this.prisma.reminder.create({
        data: {
          userId: input.userId,
          createdByCommandId: input.clientCommandId,
          title: input.title.trim(),
          body: input.body?.trim() || null,
          timeZone: input.timeZone,
          startsOn: stored.startsOn ? databaseDate(stored.startsOn) : null,
          localTime: stored.localTime,
          rrule: stored.rrule,
          oneTimeAt: stored.oneTimeAt,
          quietHoursPolicy: {},
          deliveryPolicy: {
            channels: input.channels,
          } as unknown as Prisma.InputJsonValue,
          createdAt: input.now,
          updatedAt: input.now,
        },
      });
      return toReminder(row, null, null);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const row = await this.prisma.reminder.findUniqueOrThrow({
        where: {
          userId_createdByCommandId: {
            userId: input.userId,
            createdByCommandId: input.clientCommandId,
          },
        },
      });
      return toReminder(row, null, null);
    }
  }

  async updateReminder(
    input: Parameters<NotificationRepository["updateReminder"]>[0],
  ) {
    const existing = await this.prisma.reminder.findFirst({
      where: { id: input.reminderId, userId: input.userId },
      select: { id: true },
    });
    if (!existing) return "not_found" as const;
    const stored = serializeSchedule(input.schedule);
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.reminder.updateMany({
        where: {
          id: input.reminderId,
          userId: input.userId,
          version: input.expectedVersion,
        },
        data: {
          title: input.title.trim(),
          body: input.body?.trim() || null,
          timeZone: input.timeZone,
          startsOn: stored.startsOn ? databaseDate(stored.startsOn) : null,
          localTime: stored.localTime,
          rrule: stored.rrule,
          oneTimeAt: stored.oneTimeAt,
          deliveryPolicy: {
            channels: input.channels,
          } as unknown as Prisma.InputJsonValue,
          ruleVersion: { increment: 1 },
          version: { increment: 1 },
          expandedThrough: null,
          updatedAt: input.now,
        },
      });
      if (updated.count === 0) return "conflict" as const;
      const reminder = await transaction.reminder.findUniqueOrThrow({
        where: { id: input.reminderId },
      });
      await transaction.reminderOccurrence.updateMany({
        where: {
          reminderId: reminder.id,
          ruleVersion: { lt: reminder.ruleVersion },
          status: { in: ["PENDING", "DEFERRED", "ENQUEUED"] },
        },
        data: {
          status: "CANCELLED",
          updatedAt: input.now,
          version: { increment: 1 },
        },
      });
      return toReminder(reminder, null, null);
    });
  }

  async setReminderState(
    input: Parameters<NotificationRepository["setReminderState"]>[0],
  ) {
    const existing = await this.prisma.reminder.findFirst({
      where: { id: input.reminderId, userId: input.userId },
      select: { id: true },
    });
    if (!existing) return "not_found" as const;
    const status = {
      pause: "PAUSED",
      resume: "ACTIVE",
      complete: "COMPLETED",
      cancel: "CANCELLED",
    }[input.action] as "PAUSED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.reminder.updateMany({
        where: {
          id: input.reminderId,
          userId: input.userId,
          version: input.expectedVersion,
        },
        data: { status, version: { increment: 1 }, updatedAt: input.now },
      });
      if (updated.count === 0) return "conflict" as const;
      if (status !== "ACTIVE") {
        await transaction.reminderOccurrence.updateMany({
          where: {
            reminderId: input.reminderId,
            status: { in: ["PENDING", "DEFERRED", "ENQUEUED"] },
          },
          data: {
            status: "CANCELLED",
            updatedAt: input.now,
            version: { increment: 1 },
          },
        });
      }
      const reminder = await transaction.reminder.findUniqueOrThrow({
        where: { id: input.reminderId },
      });
      return toReminder(reminder, null, null);
    });
  }

  async deleteReminder(
    input: Parameters<NotificationRepository["deleteReminder"]>[0],
  ) {
    const existing = await this.prisma.reminder.findFirst({
      where: { id: input.reminderId, userId: input.userId },
      select: { version: true },
    });
    if (!existing) return "not_found" as const;
    if (existing.version !== input.expectedVersion) return "conflict" as const;
    const deleted = await this.prisma.reminder.deleteMany({
      where: {
        id: input.reminderId,
        userId: input.userId,
        version: input.expectedVersion,
      },
    });
    return deleted.count === 1 ? ("deleted" as const) : ("conflict" as const);
  }

  async actOnOccurrence(
    input: Parameters<NotificationRepository["actOnOccurrence"]>[0],
  ) {
    const existing = await this.prisma.reminderOccurrence.findFirst({
      where: { id: input.occurrenceId, reminder: { userId: input.userId } },
      select: { id: true },
    });
    if (!existing) return "not_found" as const;
    const status =
      input.action === "snooze"
        ? "DEFERRED"
        : input.action === "skip"
          ? "CANCELLED"
          : "COMPLETED";
    const updated = await this.prisma.reminderOccurrence.updateMany({
      where: {
        id: input.occurrenceId,
        version: input.expectedVersion,
        reminder: { userId: input.userId },
      },
      data: {
        status,
        snoozedUntil: input.snoozedUntil,
        completedAt: input.action === "complete" ? input.now : null,
        updatedAt: input.now,
        version: { increment: 1 },
      },
    });
    return updated.count === 0
      ? ("conflict" as const)
      : (status as OccurrenceStatus);
  }

  async expandReminder(
    input: Parameters<NotificationRepository["expandReminder"]>[0],
  ) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: input.reminderId, userId: input.userId, status: "ACTIVE" },
    });
    if (!reminder) return 0;
    return this.expandRecord(
      this.prisma,
      reminder,
      input.from,
      input.through,
      input.now,
    );
  }

  async expandActiveReminders(
    input: Parameters<NotificationRepository["expandActiveReminders"]>[0],
  ) {
    const reminders = await this.prisma.reminder.findMany({
      where: {
        status: "ACTIVE",
        ...(input.userId ? { userId: input.userId } : {}),
        OR: [
          { expandedThrough: null },
          { expandedThrough: { lt: input.through } },
        ],
      },
      orderBy: [{ expandedThrough: "asc" }, { id: "asc" }],
      take: input.limit,
    });
    let created = 0;
    for (const reminder of reminders) {
      created += await this.expandRecord(
        this.prisma,
        reminder,
        input.now,
        input.through,
        input.now,
      );
    }
    return created;
  }

  async claimDueOccurrences(
    input: Parameters<NotificationRepository["claimDueOccurrences"]>[0],
  ) {
    await this.prisma.reminderOccurrence.updateMany({
      where: {
        status: { in: ["PENDING", "DEFERRED"] },
        expiresAt: { lte: input.now },
        ...(input.userId ? { reminder: { userId: input.userId } } : {}),
      },
      data: {
        status: "MISSED",
        updatedAt: input.now,
        version: { increment: 1 },
      },
    });
    const userClause = input.userId
      ? Prisma.sql`AND reminder."userId" = ${input.userId}::uuid`
      : Prisma.empty;
    return this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<readonly { id: string }[]>`
        WITH candidates AS (
          SELECT occurrence.id
          FROM reminder_occurrences occurrence
          JOIN reminders reminder ON reminder.id = occurrence."reminderId"
          WHERE reminder.status = 'ACTIVE'::"ReminderStatus"
            AND occurrence.status IN ('PENDING'::"OccurrenceStatus", 'DEFERRED'::"OccurrenceStatus")
            AND COALESCE(occurrence."snoozedUntil", occurrence."scheduledFor") <= ${input.now}
            AND (occurrence."expiresAt" IS NULL OR occurrence."expiresAt" > ${input.now})
            ${userClause}
          ORDER BY COALESCE(occurrence."snoozedUntil", occurrence."scheduledFor"), occurrence.id
          FOR UPDATE OF occurrence SKIP LOCKED
          LIMIT ${input.limit}
        )
        UPDATE reminder_occurrences occurrence
        SET status = 'ENQUEUED'::"OccurrenceStatus",
            "updatedAt" = ${input.now},
            version = occurrence.version + 1
        FROM candidates
        WHERE occurrence.id = candidates.id
        RETURNING occurrence.id
      `;
      return rows.map((row) => ({ id: row.id }));
    });
  }

  async deliveryContext(occurrenceId: string): Promise<DeliveryContext | null> {
    const row = await this.prisma.reminderOccurrence.findFirst({
      where: {
        id: occurrenceId,
        status: "ENQUEUED",
        reminder: { status: "ACTIVE" },
      },
      include: {
        reminder: {
          include: {
            user: {
              include: { profile: true, notificationPreference: true },
            },
          },
        },
      },
    });
    if (!row || !row.reminder.user.profile) return null;
    const profile = row.reminder.user.profile;
    const preferences = row.reminder.user.notificationPreference
      ? toPreferences(
          row.reminder.user.notificationPreference,
          profile.timeZone,
        )
      : defaultPreferences(profile.timeZone);
    return {
      occurrenceId: row.id,
      userId: row.reminder.userId,
      category: "reminder",
      reminderTitle: row.reminder.title,
      reminderBody: row.reminder.body,
      scheduledFor: row.scheduledFor,
      expiresAt: row.expiresAt,
      locale: applicationLocale(profile.locale),
      channels: effectiveChannels(
        channelsFrom(row.reminder.deliveryPolicy),
        preferences.categories.reminder,
      ),
      preferences,
    };
  }

  async deferOccurrence(
    input: Parameters<NotificationRepository["deferOccurrence"]>[0],
  ) {
    await this.prisma.reminderOccurrence.updateMany({
      where: {
        id: input.occurrenceId,
        status: { in: ["ENQUEUED", "DELIVERED"] },
      },
      data: {
        status: "DEFERRED",
        snoozedUntil: input.until,
        updatedAt: input.now,
        version: { increment: 1 },
      },
    });
  }

  async materializeNotification(
    input: Parameters<NotificationRepository["materializeNotification"]>[0],
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const deduplicationKey = `reminder:${input.context.occurrenceId}`;
      const notification = await transaction.notification.upsert({
        where: {
          userId_deduplicationKey: {
            userId: input.context.userId,
            deduplicationKey,
          },
        },
        create: {
          userId: input.context.userId,
          occurrenceId: input.context.occurrenceId,
          category: input.context.category,
          title: input.context.reminderTitle,
          body: input.context.reminderBody,
          deepLink: `/${input.context.locale}/notifications`,
          deduplicationKey,
          locale: input.context.locale,
          templateKey: "reminder.due",
          templateVersion: 1,
          preferenceSnapshot: input.context
            .preferences as unknown as Prisma.InputJsonValue,
          archivedAt: input.context.channels.inApp ? null : input.now,
          expiresAt: input.context.expiresAt,
          createdAt: input.now,
          updatedAt: input.now,
        },
        update: {},
      });
      if (input.context.channels.inApp) {
        await transaction.deliveryAttempt.createMany({
          data: [
            {
              notificationId: notification.id,
              channel: "IN_APP",
              targetKey: "in_app",
              provider: "focused",
              attempt: 1,
              status: "SENT",
              attemptedAt: input.now,
              completedAt: input.now,
            },
          ],
          skipDuplicates: true,
        });
      }
      await transaction.reminderOccurrence.updateMany({
        where: { id: input.context.occurrenceId, status: "ENQUEUED" },
        data: {
          status: "DELIVERED",
          updatedAt: input.now,
          version: { increment: 1 },
        },
      });
      return {
        id: notification.id,
        deepLink: notification.deepLink!,
        locale: applicationLocale(notification.locale),
        preferenceSnapshot: input.context.preferences,
      };
    });
  }

  async failOccurrence(occurrenceId: string, now: Date) {
    await this.prisma.reminderOccurrence.updateMany({
      where: { id: occurrenceId, status: "ENQUEUED" },
      data: { status: "FAILED", updatedAt: now, version: { increment: 1 } },
    });
  }

  async listPushSubscriptions(userId: string) {
    const rows = await this.prisma.pushSubscription.findMany({
      where: { userId, revokedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        deviceName: true,
        locale: true,
        expiresAt: true,
        lastSuccessAt: true,
        createdAt: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      deviceName: row.deviceName,
      locale: applicationLocale(row.locale),
      expiresAt: iso(row.expiresAt),
      lastSuccessAt: iso(row.lastSuccessAt),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async activePushSubscriptions(
    userId: string,
    cipher: Parameters<NotificationRepository["activePushSubscriptions"]>[1],
  ) {
    const now = new Date();
    const rows = await this.prisma.pushSubscription.findMany({
      where: {
        userId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      endpoint: cipher.decrypt(row.endpointEncrypted),
      p256dh: cipher.decrypt(row.p256dhEncrypted),
      auth: cipher.decrypt(row.authEncrypted),
      locale: applicationLocale(row.locale),
    }));
  }

  async upsertPushSubscription(
    input: Parameters<NotificationRepository["upsertPushSubscription"]>[0],
  ) {
    const endpointHash = createHash("sha256")
      .update(input.value.endpoint)
      .digest("hex");
    const row = await this.prisma.pushSubscription.upsert({
      where: { endpointHash },
      create: {
        userId: input.userId,
        endpointHash,
        endpointEncrypted: input.cipher.encrypt(input.value.endpoint),
        p256dhEncrypted: input.cipher.encrypt(input.value.keys.p256dh),
        authEncrypted: input.cipher.encrypt(input.value.keys.auth),
        locale: input.value.locale,
        userAgent: input.value.userAgent,
        deviceName: input.value.deviceName,
        expiresAt: expirationDate(input.value.expirationTime),
        createdAt: input.now,
        updatedAt: input.now,
      },
      update: {
        userId: input.userId,
        endpointEncrypted: input.cipher.encrypt(input.value.endpoint),
        p256dhEncrypted: input.cipher.encrypt(input.value.keys.p256dh),
        authEncrypted: input.cipher.encrypt(input.value.keys.auth),
        locale: input.value.locale,
        userAgent: input.value.userAgent,
        deviceName: input.value.deviceName,
        expiresAt: expirationDate(input.value.expirationTime),
        revokedAt: null,
        failureCount: 0,
        updatedAt: input.now,
      },
    });
    return {
      id: row.id,
      deviceName: row.deviceName,
      locale: applicationLocale(row.locale),
      expiresAt: iso(row.expiresAt),
      lastSuccessAt: iso(row.lastSuccessAt),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async revokePushSubscription(
    input: Parameters<NotificationRepository["revokePushSubscription"]>[0],
  ) {
    const result = await this.prisma.pushSubscription.updateMany({
      where: {
        id: input.subscriptionId,
        userId: input.userId,
        revokedAt: null,
      },
      data: { revokedAt: input.now, updatedAt: input.now },
    });
    return result.count === 1;
  }

  async revokePushSubscriptionById(subscriptionId: string, now: Date) {
    await this.prisma.pushSubscription.updateMany({
      where: { id: subscriptionId, revokedAt: null },
      data: { revokedAt: now, lastFailureAt: now, updatedAt: now },
    });
  }

  async countRecentPushes(userId: string, since: Date) {
    const rows = await this.prisma.deliveryAttempt.findMany({
      where: {
        channel: "WEB_PUSH",
        status: "SENT",
        completedAt: { gte: since },
        notification: { userId },
      },
      distinct: ["notificationId"],
      select: { notificationId: true },
    });
    return rows.length;
  }

  async claimDeliveryAttempt(
    input: Parameters<NotificationRepository["claimDeliveryAttempt"]>[0],
  ): Promise<DeliveryAttemptClaim | null> {
    return this.prisma.$transaction(async (transaction) => {
      const previous = await transaction.deliveryAttempt.findFirst({
        where: {
          notificationId: input.notificationId,
          channel: "WEB_PUSH",
          targetKey: input.subscriptionId,
        },
        orderBy: { attempt: "desc" },
        select: { attempt: true, status: true },
      });
      if (
        previous &&
        [
          "PENDING",
          "SENT",
          "ACKNOWLEDGED",
          "PERMANENT_FAILURE",
          "EXPIRED",
        ].includes(previous.status)
      ) {
        return null;
      }
      const attempt = (previous?.attempt ?? 0) + 1;
      try {
        const created = await transaction.deliveryAttempt.create({
          data: {
            notificationId: input.notificationId,
            pushSubscriptionId: input.subscriptionId,
            channel: "WEB_PUSH",
            targetKey: input.subscriptionId,
            provider: "web-push",
            attempt,
            status: "PENDING",
            attemptedAt: input.now,
          },
          select: { id: true, attempt: true },
        });
        return created;
      } catch (error) {
        if (isUniqueViolation(error)) return null;
        throw error;
      }
    });
  }

  async completeDeliveryAttempt(
    input: Parameters<NotificationRepository["completeDeliveryAttempt"]>[0],
  ) {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.deliveryAttempt.updateMany({
        where: { id: input.attemptId, status: "PENDING" },
        data: {
          status: input.status,
          providerStatusCode: input.providerStatusCode,
          errorCode: input.errorCode,
          completedAt: input.now,
          nextAttemptAt:
            input.status === "RETRYABLE_FAILURE"
              ? new Date(input.now.getTime() + 60_000)
              : null,
        },
      });
      await transaction.pushSubscription.updateMany({
        where: { id: input.subscriptionId },
        data:
          input.status === "SENT"
            ? {
                lastSuccessAt: input.now,
                failureCount: 0,
                updatedAt: input.now,
              }
            : {
                lastFailureAt: input.now,
                failureCount: { increment: 1 },
                updatedAt: input.now,
              },
      });
    });
  }

  async createTestNotification(
    input: Parameters<NotificationRepository["createTestNotification"]>[0],
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        category: "system",
        title:
          input.locale === "bn-BD" ? "Test Notification" : "Test notification",
        body:
          input.locale === "bn-BD"
            ? "Web Push ঠিকভাবে কাজ করছে।"
            : "Web Push is working correctly.",
        deepLink: `/${input.locale}/notifications`,
        deduplicationKey: `push-test:${randomUUID()}`,
        locale: input.locale,
        templateKey: "push.test",
        templateVersion: 1,
        preferenceSnapshot:
          input.preferences as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(input.now.getTime() + 60 * 60 * 1000),
        createdAt: input.now,
        updatedAt: input.now,
      },
    });
    return {
      id: notification.id,
      deepLink: notification.deepLink!,
      locale: input.locale,
      preferenceSnapshot: input.preferences,
    };
  }

  private async expandRecord(
    client: FocusedPrismaClient | TransactionClient,
    reminder: Prisma.ReminderGetPayload<Record<string, never>>,
    from: Date,
    through: Date,
    now: Date,
  ): Promise<number> {
    const schedule = storedSchedule(reminder);
    const values = expandSchedule({
      schedule,
      timeZone: reminder.timeZone,
      ruleVersion: reminder.ruleVersion,
      from,
      through,
    });
    const created = await client.reminderOccurrence.createMany({
      data: values.map((value) => ({
        reminderId: reminder.id,
        occurrenceKey: value.occurrenceKey,
        scheduledFor: value.scheduledFor,
        localDate: databaseDate(value.localDate),
        ruleVersion: reminder.ruleVersion,
        expiresAt: value.expiresAt,
        createdAt: now,
        updatedAt: now,
      })),
      skipDuplicates: true,
    });
    await client.reminder.updateMany({
      where: { id: reminder.id, ruleVersion: reminder.ruleVersion },
      data: { expandedThrough: through, updatedAt: now },
    });
    return created.count;
  }
}

function toNotification(row: NotificationRecord): NotificationItem {
  return {
    id: row.id,
    category: applicationCategory(row.category),
    title: row.title,
    body: row.body,
    deepLink: row.deepLink,
    readAt: iso(row.readAt),
    archivedAt: iso(row.archivedAt),
    expiresAt: iso(row.expiresAt),
    createdAt: row.createdAt.toISOString(),
    version: row.version,
  };
}

function toPreferences(
  row: Readonly<{
    categories: Prisma.JsonValue;
    quietHours: Prisma.JsonValue;
    previewPolicy: string;
    version: number;
    updatedAt: Date;
  }>,
  fallbackTimeZone: string,
): NotificationPreferences {
  const defaults = defaultPreferences(fallbackTimeZone);
  const rawCategories = jsonObject(row.categories);
  const categories = Object.fromEntries(
    Object.entries(defaults.categories).map(([key, fallback]) => {
      const raw = jsonObject(rawCategories[key]);
      return [
        key,
        {
          inApp: typeof raw.inApp === "boolean" ? raw.inApp : fallback.inApp,
          webPush:
            typeof raw.webPush === "boolean" ? raw.webPush : fallback.webPush,
        },
      ];
    }),
  ) as NotificationPreferences["categories"];
  const rawQuiet = jsonObject(row.quietHours);
  return {
    categories,
    quietHours: {
      enabled:
        typeof rawQuiet.enabled === "boolean"
          ? rawQuiet.enabled
          : defaults.quietHours.enabled,
      start:
        typeof rawQuiet.start === "string"
          ? rawQuiet.start
          : defaults.quietHours.start,
      end:
        typeof rawQuiet.end === "string"
          ? rawQuiet.end
          : defaults.quietHours.end,
      timeZone:
        typeof rawQuiet.timeZone === "string"
          ? rawQuiet.timeZone
          : fallbackTimeZone,
    },
    previewPolicy: row.previewPolicy === "HIDDEN" ? "HIDDEN" : "MINIMAL",
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toReminder(
  reminder: Prisma.ReminderGetPayload<Record<string, never>>,
  nextOccurrence: Readonly<{
    id: string;
    scheduledFor: Date;
    version: number;
  }> | null,
  lastOutcome: string | null,
): ReminderSummary {
  return {
    id: reminder.id,
    title: reminder.title,
    body: reminder.body,
    status: reminder.status,
    timeZone: reminder.timeZone,
    schedule: storedSchedule(reminder),
    channels: channelsFrom(reminder.deliveryPolicy),
    nextOccurrenceAt: iso(nextOccurrence?.scheduledFor ?? null),
    nextOccurrence: nextOccurrence
      ? {
          id: nextOccurrence.id,
          scheduledFor: nextOccurrence.scheduledFor.toISOString(),
          version: nextOccurrence.version,
        }
      : null,
    lastOutcome: lastOutcome as OccurrenceStatus | null,
    ruleVersion: reminder.ruleVersion,
    version: reminder.version,
    createdAt: reminder.createdAt.toISOString(),
  };
}

function storedSchedule(
  reminder: Readonly<{
    oneTimeAt: Date | null;
    startsOn: Date | null;
    localTime: string | null;
    rrule: string | null;
  }>,
): ReminderSchedule {
  return deserializeSchedule({
    oneTimeAt: reminder.oneTimeAt,
    startsOn: reminder.startsOn?.toISOString().slice(0, 10) ?? null,
    localTime: reminder.localTime,
    rrule: reminder.rrule,
  });
}

function channelsFrom(value: Prisma.JsonValue): ChannelPreference {
  const policy = jsonObject(value);
  const channels = jsonObject(policy.channels);
  return {
    inApp: typeof channels.inApp === "boolean" ? channels.inApp : true,
    webPush: typeof channels.webPush === "boolean" ? channels.webPush : false,
  };
}

function effectiveChannels(
  reminder: ChannelPreference,
  preference: ChannelPreference,
): ChannelPreference {
  return {
    inApp: reminder.inApp && preference.inApp,
    webPush: reminder.webPush && preference.webPush,
  };
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function applicationCategory(value: string): NotificationCategory {
  return ["reminder", "focus", "habit", "goal", "planning", "system"].includes(
    value,
  )
    ? (value as NotificationCategory)
    : "system";
}

function applicationLocale(value: string): NotificationLocale {
  return value === "en" ? "en" : "bn-BD";
}

function databaseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function expirationDate(value: number | null): Date | null {
  if (value === null) return null;
  const milliseconds = value > 10_000_000_000 ? value : value * 1000;
  return new Date(milliseconds);
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
