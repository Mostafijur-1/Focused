import {
  addIsoDays,
  localDateAt,
  localDateTimeToInstant,
  notificationLimits,
} from "@/features/notifications/domain/notification-policy";
import type { ReminderSchedule } from "@/features/notifications/domain/notification-types";

const weekdayCodes = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

export interface StoredReminderSchedule {
  readonly oneTimeAt: Date | null;
  readonly startsOn: string | null;
  readonly localTime: string | null;
  readonly rrule: string | null;
}

export interface ExpandedOccurrence {
  readonly occurrenceKey: string;
  readonly scheduledFor: Date;
  readonly localDate: string;
  readonly expiresAt: Date;
}

export function serializeSchedule(
  schedule: ReminderSchedule,
): StoredReminderSchedule {
  if (schedule.kind === "once") {
    return {
      oneTimeAt: new Date(schedule.at),
      startsOn: null,
      localTime: null,
      rrule: null,
    };
  }
  if (schedule.kind === "daily") {
    return {
      oneTimeAt: null,
      startsOn: schedule.startsOn,
      localTime: schedule.localTime,
      rrule: `FREQ=DAILY;INTERVAL=${schedule.interval}`,
    };
  }
  return {
    oneTimeAt: null,
    startsOn: schedule.startsOn,
    localTime: schedule.localTime,
    rrule: `FREQ=WEEKLY;BYDAY=${schedule.weekdays.map((day) => weekdayCodes[day]).join(",")}`,
  };
}

export function deserializeSchedule(
  input: StoredReminderSchedule,
): ReminderSchedule {
  if (input.oneTimeAt)
    return { kind: "once", at: input.oneTimeAt.toISOString() };
  if (!input.startsOn || !input.localTime || !input.rrule) {
    throw new Error("Stored reminder schedule is incomplete.");
  }
  const values: Record<string, string> = Object.fromEntries(
    input.rrule.split(";").map((part) => part.split("=", 2)),
  );
  if (values.FREQ === "DAILY") {
    return {
      kind: "daily",
      startsOn: input.startsOn,
      localTime: input.localTime,
      interval: Number(values.INTERVAL ?? "1"),
    };
  }
  const weekdays = (values.BYDAY ?? "")
    .split(",")
    .map((code: string) =>
      weekdayCodes.indexOf(code as (typeof weekdayCodes)[number]),
    )
    .filter((day: number) => day >= 0);
  return {
    kind: "weekly",
    startsOn: input.startsOn,
    localTime: input.localTime,
    weekdays,
  };
}

export function expandSchedule(input: {
  readonly schedule: ReminderSchedule;
  readonly timeZone: string;
  readonly ruleVersion: number;
  readonly from: Date;
  readonly through: Date;
}): readonly ExpandedOccurrence[] {
  if (input.schedule.kind === "once") {
    const scheduledFor = new Date(input.schedule.at);
    if (scheduledFor < input.from || scheduledFor > input.through) return [];
    return [occurrence(scheduledFor, input.timeZone, input.ruleVersion)];
  }
  const fromDate = localDateAt(input.from, input.timeZone);
  const throughDate = localDateAt(input.through, input.timeZone);
  const startDate =
    input.schedule.startsOn > fromDate ? input.schedule.startsOn : fromDate;
  const values: ExpandedOccurrence[] = [];
  for (
    let localDate = startDate, scanned = 0;
    localDate <= throughDate && scanned <= notificationLimits.expansionDays + 2;
    localDate = addIsoDays(localDate, 1), scanned += 1
  ) {
    if (!matches(input.schedule, localDate)) continue;
    const scheduledFor = localDateTimeToInstant(
      localDate,
      input.schedule.localTime,
      input.timeZone,
    );
    if (scheduledFor < input.from || scheduledFor > input.through) continue;
    values.push(occurrence(scheduledFor, input.timeZone, input.ruleVersion));
  }
  return values;
}

function matches(
  schedule: Exclude<ReminderSchedule, { kind: "once" }>,
  localDate: string,
) {
  const current = new Date(`${localDate}T12:00:00.000Z`);
  if (schedule.kind === "weekly")
    return schedule.weekdays.includes(current.getUTCDay());
  const start = new Date(`${schedule.startsOn}T12:00:00.000Z`);
  const days = Math.round((current.getTime() - start.getTime()) / 86_400_000);
  return days >= 0 && days % schedule.interval === 0;
}

function occurrence(
  scheduledFor: Date,
  timeZone: string,
  ruleVersion: number,
): ExpandedOccurrence {
  return {
    occurrenceKey: `v${ruleVersion}:${scheduledFor.toISOString()}`,
    scheduledFor,
    localDate: localDateAt(scheduledFor, timeZone),
    expiresAt: new Date(scheduledFor.getTime() + 24 * 60 * 60 * 1000),
  };
}
