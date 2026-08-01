export const notificationCategories = [
  "reminder",
  "focus",
  "habit",
  "goal",
  "planning",
  "system",
] as const;

export type NotificationCategory = (typeof notificationCategories)[number];
export type NotificationLocale = "bn-BD" | "en";
export type PreviewPolicy = "MINIMAL" | "HIDDEN";
export type ReminderStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type OccurrenceStatus =
  | "PENDING"
  | "DEFERRED"
  | "ENQUEUED"
  | "DELIVERED"
  | "COMPLETED"
  | "MISSED"
  | "CANCELLED"
  | "FAILED";

export interface ChannelPreference {
  readonly inApp: boolean;
  readonly webPush: boolean;
}

export interface QuietHours {
  readonly enabled: boolean;
  readonly start: string;
  readonly end: string;
  readonly timeZone: string;
}

export interface NotificationPreferences {
  readonly categories: Readonly<
    Record<NotificationCategory, ChannelPreference>
  >;
  readonly quietHours: QuietHours;
  readonly previewPolicy: PreviewPolicy;
  readonly version: number;
  readonly updatedAt: string | null;
}

export interface NotificationItem {
  readonly id: string;
  readonly category: NotificationCategory;
  readonly title: string;
  readonly body: string | null;
  readonly deepLink: string | null;
  readonly readAt: string | null;
  readonly archivedAt: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly version: number;
}

export interface NotificationPage {
  readonly items: readonly NotificationItem[];
  readonly nextCursor: string | null;
  readonly unreadCount: number;
}

export type ReminderSchedule =
  | Readonly<{ kind: "once"; at: string }>
  | Readonly<{
      kind: "daily";
      startsOn: string;
      localTime: string;
      interval: number;
    }>
  | Readonly<{
      kind: "weekly";
      startsOn: string;
      localTime: string;
      weekdays: readonly number[];
    }>;

export interface ReminderSummary {
  readonly id: string;
  readonly title: string;
  readonly body: string | null;
  readonly status: ReminderStatus;
  readonly timeZone: string;
  readonly schedule: ReminderSchedule;
  readonly channels: ChannelPreference;
  readonly nextOccurrenceAt: string | null;
  readonly nextOccurrence: Readonly<{
    id: string;
    scheduledFor: string;
    version: number;
  }> | null;
  readonly lastOutcome: OccurrenceStatus | null;
  readonly ruleVersion: number;
  readonly version: number;
  readonly createdAt: string;
}

export interface ReminderListView {
  readonly reminders: readonly ReminderSummary[];
  readonly timeZone: string;
}

export interface PushSubscriptionSummary {
  readonly id: string;
  readonly deviceName: string | null;
  readonly locale: NotificationLocale;
  readonly expiresAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly createdAt: string;
}

export interface NotificationOverview {
  readonly inbox: NotificationPage;
  readonly preferences: NotificationPreferences;
  readonly reminders: ReminderListView;
  readonly push: Readonly<{
    configured: boolean;
    publicKey: string | null;
    subscriptions: readonly PushSubscriptionSummary[];
  }>;
}
