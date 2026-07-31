import { failure, success, type Result } from "@/domain/shared/result";

import type { HabitOccurrenceStatus, HabitSchedule } from "./habit-types";

export type HabitScheduleIssue =
  | "invalid_date"
  | "invalid_weekdays"
  | "invalid_interval"
  | "invalid_custom_dates"
  | "range_too_large";

export function validateHabitSchedule(
  schedule: HabitSchedule,
  startsOn: string,
): Result<HabitSchedule, HabitScheduleIssue> {
  if (!isIsoDate(startsOn)) return failure("invalid_date");
  if (schedule.type === "daily") return success(schedule);
  if (schedule.type === "weekdays") {
    const unique = [...new Set(schedule.weekdays)].sort(
      (left, right) => left - right,
    );
    return unique.length > 0 &&
      unique.length <= 7 &&
      unique.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      ? success({ type: "weekdays", weekdays: unique })
      : failure("invalid_weekdays");
  }
  if (schedule.type === "interval") {
    return Number.isInteger(schedule.everyDays) &&
      schedule.everyDays >= 2 &&
      schedule.everyDays <= 30 &&
      isIsoDate(schedule.anchorDate) &&
      schedule.anchorDate >= startsOn
      ? success(schedule)
      : failure("invalid_interval");
  }
  const unique = [...new Set(schedule.dates)].sort();
  if (
    unique.length === 0 ||
    unique.length > 128 ||
    unique.some((date) => !isIsoDate(date) || date < startsOn)
  ) {
    return failure("invalid_custom_dates");
  }
  const span = differenceInDays(unique.at(-1)!, unique[0]!);
  return span <= 366
    ? success({ type: "custom_dates", dates: unique })
    : failure("range_too_large");
}

export function isHabitDueOn(
  schedule: HabitSchedule,
  localDate: string,
  startsOn: string,
): boolean {
  if (!isIsoDate(localDate) || localDate < startsOn) return false;
  if (schedule.type === "daily") return true;
  if (schedule.type === "weekdays") {
    return schedule.weekdays.includes(dateAtUtc(localDate).getUTCDay());
  }
  if (schedule.type === "interval") {
    if (localDate < schedule.anchorDate) return false;
    return (
      differenceInDays(localDate, schedule.anchorDate) % schedule.everyDays ===
      0
    );
  }
  return schedule.dates.includes(localDate);
}

export function occurrenceDates(
  schedule: HabitSchedule,
  startsOn: string,
  from: string,
  through: string,
): readonly string[] {
  if (![startsOn, from, through].every(isIsoDate) || through < from) return [];
  if (differenceInDays(through, from) > 366) return [];
  const dates: string[] = [];
  for (let cursor = from; cursor <= through; cursor = addDays(cursor, 1)) {
    if (isHabitDueOn(schedule, cursor, startsOn)) dates.push(cursor);
  }
  return dates;
}

export function isPausedOn(
  localDate: string,
  pauses: readonly Readonly<{ startsOn: string; endsOn: string | null }>[],
): boolean {
  return pauses.some(
    (pause) =>
      localDate >= pause.startsOn &&
      (!pause.endsOn || localDate <= pause.endsOn),
  );
}

export function calculateConsistency(
  statuses: readonly HabitOccurrenceStatus[],
): Readonly<{
  dueCount: number;
  completedCount: number;
  percentage: number;
  currentStreak: number;
}> {
  const considered = statuses.filter((status) => status !== "excused");
  const completedCount = considered.filter(
    (status) => status === "completed",
  ).length;
  let currentStreak = 0;
  for (let index = considered.length - 1; index >= 0; index -= 1) {
    if (considered[index] !== "completed") break;
    currentStreak += 1;
  }
  return {
    dueCount: considered.length,
    completedCount,
    percentage:
      considered.length === 0
        ? 0
        : Math.round((completedCount / considered.length) * 100),
    currentStreak,
  };
}

export function addDays(localDate: string, amount: number): string {
  const next = dateAtUtc(localDate);
  next.setUTCDate(next.getUTCDate() + amount);
  return next.toISOString().slice(0, 10);
}

export function differenceInDays(left: string, right: string): number {
  return Math.round(
    (dateAtUtc(left).getTime() - dateAtUtc(right).getTime()) / 86_400_000,
  );
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = dateAtUtc(value);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function dateAtUtc(localDate: string): Date {
  return new Date(`${localDate}T00:00:00.000Z`);
}
