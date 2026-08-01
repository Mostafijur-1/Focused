import type { SecretCipher } from "@/features/auth/application/oauth-ports";
import type {
  ChannelPreference,
  NotificationCategory,
  NotificationItem,
  NotificationLocale,
  NotificationPage,
  NotificationPreferences,
  OccurrenceStatus,
  PushSubscriptionSummary,
  ReminderListView,
  ReminderSchedule,
  ReminderSummary,
} from "@/features/notifications/domain/notification-types";

export type NotificationStateAction = "read" | "unread" | "archive" | "restore";
export type ReminderStateAction = "pause" | "resume" | "complete" | "cancel";
export type OccurrenceAction = "snooze" | "skip" | "complete";

export interface ReminderDraft {
  readonly title: string;
  readonly body: string | null;
  readonly timeZone: string;
  readonly schedule: ReminderSchedule;
  readonly channels: ChannelPreference;
  readonly clientCommandId: string;
}

export interface ReminderUpdateDraft extends Omit<
  ReminderDraft,
  "clientCommandId"
> {
  readonly expectedVersion: number;
}

export interface PreferenceUpdateDraft {
  readonly categories: NotificationPreferences["categories"];
  readonly quietHours: NotificationPreferences["quietHours"];
  readonly previewPolicy: NotificationPreferences["previewPolicy"];
  readonly expectedVersion: number;
}

export interface PushSubscriptionDraft {
  readonly endpoint: string;
  readonly expirationTime: number | null;
  readonly keys: Readonly<{ p256dh: string; auth: string }>;
  readonly deviceName: string | null;
  readonly locale: NotificationLocale;
  readonly userAgent: string | null;
}

export interface UserNotificationContext {
  readonly timeZone: string;
  readonly locale: NotificationLocale;
}

export interface DueOccurrence {
  readonly id: string;
}

export interface DeliveryContext {
  readonly occurrenceId: string;
  readonly userId: string;
  readonly category: NotificationCategory;
  readonly reminderTitle: string;
  readonly reminderBody: string | null;
  readonly scheduledFor: Date;
  readonly expiresAt: Date | null;
  readonly locale: NotificationLocale;
  readonly channels: ChannelPreference;
  readonly preferences: NotificationPreferences;
}

export interface MaterializedNotification {
  readonly id: string;
  readonly deepLink: string;
  readonly locale: NotificationLocale;
  readonly preferenceSnapshot: NotificationPreferences;
}

export interface DecryptedPushSubscription {
  readonly id: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  readonly locale: NotificationLocale;
}

export interface DeliveryAttemptClaim {
  readonly id: string;
  readonly attempt: number;
}

export interface NotificationRepository {
  userContext(userId: string): Promise<UserNotificationContext>;
  listNotifications(input: {
    readonly userId: string;
    readonly cursor?: string;
    readonly limit: number;
  }): Promise<NotificationPage>;
  setNotificationState(input: {
    readonly userId: string;
    readonly notificationId: string;
    readonly action: NotificationStateAction;
    readonly expectedVersion: number;
    readonly now: Date;
  }): Promise<NotificationItem | "not_found" | "conflict">;
  getPreferences(userId: string): Promise<NotificationPreferences>;
  updatePreferences(input: {
    readonly userId: string;
    readonly value: PreferenceUpdateDraft;
    readonly now: Date;
  }): Promise<NotificationPreferences | "conflict">;
  listReminders(userId: string, now: Date): Promise<ReminderListView>;
  countActiveReminders(userId: string): Promise<number>;
  createReminder(
    input: ReminderDraft & {
      readonly userId: string;
      readonly now: Date;
    },
  ): Promise<ReminderSummary>;
  updateReminder(
    input: ReminderUpdateDraft & {
      readonly userId: string;
      readonly reminderId: string;
      readonly now: Date;
    },
  ): Promise<ReminderSummary | "not_found" | "conflict">;
  setReminderState(input: {
    readonly userId: string;
    readonly reminderId: string;
    readonly action: ReminderStateAction;
    readonly expectedVersion: number;
    readonly now: Date;
  }): Promise<ReminderSummary | "not_found" | "conflict">;
  deleteReminder(input: {
    readonly userId: string;
    readonly reminderId: string;
    readonly expectedVersion: number;
  }): Promise<"deleted" | "not_found" | "conflict">;
  actOnOccurrence(input: {
    readonly userId: string;
    readonly occurrenceId: string;
    readonly action: OccurrenceAction;
    readonly expectedVersion: number;
    readonly snoozedUntil: Date | null;
    readonly now: Date;
  }): Promise<OccurrenceStatus | "not_found" | "conflict">;
  expandReminder(input: {
    readonly userId: string;
    readonly reminderId: string;
    readonly from: Date;
    readonly through: Date;
    readonly now: Date;
  }): Promise<number>;
  expandActiveReminders(input: {
    readonly through: Date;
    readonly now: Date;
    readonly limit: number;
    readonly userId?: string;
  }): Promise<number>;
  claimDueOccurrences(input: {
    readonly now: Date;
    readonly limit: number;
    readonly userId?: string;
  }): Promise<readonly DueOccurrence[]>;
  deliveryContext(occurrenceId: string): Promise<DeliveryContext | null>;
  deferOccurrence(input: {
    readonly occurrenceId: string;
    readonly until: Date;
    readonly now: Date;
  }): Promise<void>;
  materializeNotification(input: {
    readonly context: DeliveryContext;
    readonly now: Date;
  }): Promise<MaterializedNotification>;
  failOccurrence(occurrenceId: string, now: Date): Promise<void>;
  listPushSubscriptions(
    userId: string,
  ): Promise<readonly PushSubscriptionSummary[]>;
  activePushSubscriptions(
    userId: string,
    cipher: SecretCipher,
  ): Promise<readonly DecryptedPushSubscription[]>;
  upsertPushSubscription(input: {
    readonly userId: string;
    readonly value: PushSubscriptionDraft;
    readonly cipher: SecretCipher;
    readonly now: Date;
  }): Promise<PushSubscriptionSummary>;
  revokePushSubscription(input: {
    readonly userId: string;
    readonly subscriptionId: string;
    readonly now: Date;
  }): Promise<boolean>;
  revokePushSubscriptionById(subscriptionId: string, now: Date): Promise<void>;
  countRecentPushes(userId: string, since: Date): Promise<number>;
  claimDeliveryAttempt(input: {
    readonly notificationId: string;
    readonly subscriptionId: string;
    readonly now: Date;
  }): Promise<DeliveryAttemptClaim | null>;
  completeDeliveryAttempt(input: {
    readonly attemptId: string;
    readonly subscriptionId: string;
    readonly status:
      "SENT" | "RETRYABLE_FAILURE" | "PERMANENT_FAILURE" | "EXPIRED";
    readonly providerStatusCode: number | null;
    readonly errorCode: string | null;
    readonly now: Date;
  }): Promise<void>;
  createTestNotification(input: {
    readonly userId: string;
    readonly locale: NotificationLocale;
    readonly preferences: NotificationPreferences;
    readonly now: Date;
  }): Promise<MaterializedNotification>;
}

export interface WebPushResult {
  readonly ok: boolean;
  readonly statusCode: number | null;
  readonly errorCode: string | null;
  readonly retryable: boolean;
  readonly invalidSubscription: boolean;
}

export interface WebPushGateway {
  readonly configured: boolean;
  readonly publicKey: string | null;
  send(input: {
    readonly subscription: DecryptedPushSubscription;
    readonly payload: Readonly<{
      title: string;
      body: string;
      notificationId: string;
      deepLink: string;
      locale: NotificationLocale;
    }>;
    readonly topic: string;
    readonly expiresAt: Date | null;
  }): Promise<WebPushResult>;
}

export interface ReminderJobScheduler {
  readonly configured: boolean;
  requestTick(): Promise<void>;
}
