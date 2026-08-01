import type {
  ChannelPreference,
  NotificationCategory,
  NotificationLocale,
  NotificationPreferences,
  PreviewPolicy,
  QuietHours,
} from "@/features/notifications/domain/notification-types";

export const notificationLimits = {
  inboxPageSize: 30,
  maxInboxPageSize: 50,
  activeReminders: 200,
  expansionDays: 31,
  workerBatchSize: 100,
  titleLength: 200,
  bodyLength: 500,
  deviceNameLength: 120,
  deepLinkLength: 500,
  pushTtlSeconds: 3600,
  maxPushesPerDay: 20,
} as const;

const categoryList = [
  "reminder",
  "focus",
  "habit",
  "goal",
  "planning",
  "system",
] as const satisfies readonly NotificationCategory[];

export function defaultPreferences(timeZone: string): NotificationPreferences {
  return {
    categories: Object.fromEntries(
      categoryList.map((category) => [
        category,
        { inApp: true, webPush: category !== "system" },
      ]),
    ) as Record<NotificationCategory, ChannelPreference>,
    quietHours: {
      enabled: true,
      start: "22:00",
      end: "07:00",
      timeZone,
    },
    previewPolicy: "MINIMAL",
    version: 1,
    updatedAt: null,
  };
}

export function safePushCopy(
  locale: NotificationLocale,
  previewPolicy: PreviewPolicy,
): Readonly<{ title: string; body: string }> {
  if (previewPolicy === "HIDDEN") {
    return locale === "bn-BD"
      ? { title: "Focused", body: "আপনার জন্য একটি নতুন Notification আছে।" }
      : { title: "Focused", body: "You have a new notification." };
  }
  return locale === "bn-BD"
    ? { title: "Focused Reminder", body: "পরবর্তী কাজটি দেখার সময় হয়েছে।" }
    : {
        title: "Focused Reminder",
        body: "It is time to review your next action.",
      };
}

export function isSafeDeepLink(value: string | null): boolean {
  if (value === null) return true;
  return (
    value.startsWith("/bn-BD/") ||
    value.startsWith("/en/") ||
    value === "/bn-BD" ||
    value === "/en"
  );
}

export function isInQuietHours(now: Date, quietHours: QuietHours): boolean {
  if (!quietHours.enabled) return false;
  const localTime = localTimeAt(now, quietHours.timeZone);
  if (quietHours.start === quietHours.end) return true;
  return quietHours.start < quietHours.end
    ? localTime >= quietHours.start && localTime < quietHours.end
    : localTime >= quietHours.start || localTime < quietHours.end;
}

export function nextQuietHoursEnd(now: Date, quietHours: QuietHours): Date {
  if (!isInQuietHours(now, quietHours)) return now;
  const localDate = localDateAt(now, quietHours.timeZone);
  const crossesMidnight = quietHours.start >= quietHours.end;
  const afterStart = localTimeAt(now, quietHours.timeZone) >= quietHours.start;
  const endDate =
    crossesMidnight && afterStart ? addIsoDays(localDate, 1) : localDate;
  return localDateTimeToInstant(endDate, quietHours.end, quietHours.timeZone);
}

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function localDateAt(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`;
}

export function localTimeAt(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  return `${part(parts, "hour")}:${part(parts, "minute")}`;
}

export function localDateTimeToInstant(
  localDate: string,
  localTime: string,
  timeZone: string,
): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  const target = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  let guess = target;
  let previous = Number.NaN;
  for (let index = 0; index < 6; index += 1) {
    const observed = zonedParts(new Date(guess), timeZone);
    const observedValue = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
    );
    const adjusted = guess + target - observedValue;
    if (adjusted === guess) return new Date(guess);
    if (adjusted === previous) return new Date(Math.max(guess, adjusted));
    previous = guess;
    guess = adjusted;
  }
  return new Date(guess);
}

export function addIsoDays(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function zonedParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  return {
    year: Number(part(parts, "year")),
    month: Number(part(parts, "month")),
    day: Number(part(parts, "day")),
    hour: Number(part(parts, "hour")),
    minute: Number(part(parts, "minute")),
  };
}

function part(parts: readonly Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((candidate) => candidate.type === type)?.value ?? "";
}
