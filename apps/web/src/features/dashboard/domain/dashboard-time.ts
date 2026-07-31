export interface UtcDayRange {
  readonly start: Date;
  readonly end: Date;
}

export function localDateAt(now: Date, timeZone: string): string {
  const parts = dateTimeParts(now, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function utcDayRange(localDate: string, timeZone: string): UtcDayRange {
  const [year, month, day] = localDate.split("-").map(Number);
  if (!year || !month || !day) throw new RangeError("Invalid local date");
  const start = localMidnightToUtc(year, month, day, timeZone);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const end = localMidnightToUtc(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    timeZone,
  );
  return { start, end };
}

function localMidnightToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const desired = Date.UTC(year, month - 1, day);
  let candidate = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = dateTimeParts(new Date(candidate), timeZone);
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    candidate += desired - represented;
  }
  return new Date(candidate);
}

function dateTimeParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year!,
    month: values.month!,
    day: values.day!,
    hour: values.hour!,
    minute: values.minute!,
    second: values.second!,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
