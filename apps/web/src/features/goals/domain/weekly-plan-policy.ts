import {
  addDays,
  differenceInDays,
  isIsoDate,
} from "@/features/habits/domain/habit-schedule";

export function weekBounds(
  localDate: string,
  weekStartsOn: number,
): Readonly<{ start: string; end: string }> {
  if (
    !isIsoDate(localDate) ||
    !Number.isInteger(weekStartsOn) ||
    weekStartsOn < 0 ||
    weekStartsOn > 6
  ) {
    throw new RangeError("Invalid week boundary input.");
  }
  const day = new Date(`${localDate}T00:00:00.000Z`).getUTCDay();
  const offset = (day - weekStartsOn + 7) % 7;
  const start = addDays(localDate, -offset);
  return { start, end: addDays(start, 6) };
}

export function isCanonicalWeek(start: string, end: string): boolean {
  return (
    isIsoDate(start) && isIsoDate(end) && differenceInDays(end, start) === 6
  );
}
