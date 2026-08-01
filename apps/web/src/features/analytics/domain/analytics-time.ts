export function analyticsLocalDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function analyticsLocalHour(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function addAnalyticsDays(localDate: string, days: number): string {
  const value = parseAnalyticsDate(localDate);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function analyticsDaysInclusive(start: string, end: string): number {
  return (
    Math.floor(
      (parseAnalyticsDate(end).getTime() -
        parseAnalyticsDate(start).getTime()) /
        86_400_000,
    ) + 1
  );
}

export function analyticsDateRange(start: string, end: string): string[] {
  const result: string[] = [];
  for (let value = start; value <= end; value = addAnalyticsDays(value, 1)) {
    result.push(value);
  }
  return result;
}

export function databaseAnalyticsDate(localDate: string): Date {
  return parseAnalyticsDate(localDate);
}

function parseAnalyticsDate(localDate: string): Date {
  const value = new Date(`${localDate}T00:00:00.000Z`);
  if (
    Number.isNaN(value.getTime()) ||
    value.toISOString().slice(0, 10) !== localDate
  ) {
    throw new RangeError("Invalid local date");
  }
  return value;
}
