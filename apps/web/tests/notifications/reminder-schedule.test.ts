import { describe, expect, it } from "vitest";

import {
  deserializeSchedule,
  expandSchedule,
  serializeSchedule,
} from "@/features/notifications/domain/reminder-schedule";

describe("bounded reminder recurrence", () => {
  it("round-trips the supported daily and weekly schedule contracts", () => {
    const weekly = {
      kind: "weekly" as const,
      startsOn: "2026-08-01",
      localTime: "09:30",
      weekdays: [1, 3, 5],
    };
    expect(deserializeSchedule(serializeSchedule(weekly))).toEqual(weekly);
    expect(
      deserializeSchedule(
        serializeSchedule({
          kind: "daily",
          startsOn: "2026-08-01",
          localTime: "08:00",
          interval: 3,
        }),
      ),
    ).toMatchObject({ kind: "daily", interval: 3 });
  });

  it("expands a daily interval with stable, versioned deduplication keys", () => {
    const occurrences = expandSchedule({
      schedule: {
        kind: "daily",
        startsOn: "2026-08-01",
        localTime: "09:00",
        interval: 2,
      },
      timeZone: "Asia/Dhaka",
      ruleVersion: 4,
      from: new Date("2026-07-31T18:00:00.000Z"),
      through: new Date("2026-08-06T18:00:00.000Z"),
    });
    expect(occurrences.map((item) => item.localDate)).toEqual([
      "2026-08-01",
      "2026-08-03",
      "2026-08-05",
    ]);
    expect(occurrences[0]?.occurrenceKey).toMatch(/^v4:/u);
    expect(new Set(occurrences.map((item) => item.occurrenceKey)).size).toBe(3);
  });

  it("expands only selected weekdays and bounds one-time reminders", () => {
    const weekly = expandSchedule({
      schedule: {
        kind: "weekly",
        startsOn: "2026-08-01",
        localTime: "12:00",
        weekdays: [1],
      },
      timeZone: "UTC",
      ruleVersion: 1,
      from: new Date("2026-08-01T00:00:00.000Z"),
      through: new Date("2026-08-10T23:59:59.000Z"),
    });
    expect(weekly.map((item) => item.localDate)).toEqual([
      "2026-08-03",
      "2026-08-10",
    ]);
    expect(
      expandSchedule({
        schedule: { kind: "once", at: "2026-09-01T10:00:00.000Z" },
        timeZone: "UTC",
        ruleVersion: 1,
        from: new Date("2026-08-01T00:00:00.000Z"),
        through: new Date("2026-08-31T23:59:59.000Z"),
      }),
    ).toEqual([]);
  });
});
