import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  completionFor,
  validateHabitTarget,
} from "@/features/habits/domain/habit-policy";
import {
  addDays,
  calculateConsistency,
  isHabitDueOn,
  occurrenceDates,
  validateHabitSchedule,
} from "@/features/habits/domain/habit-schedule";

describe("habit schedule policy", () => {
  it("normalizes weekdays and rejects unbounded schedules", () => {
    expect(
      validateHabitSchedule(
        { type: "weekdays", weekdays: [5, 1, 5] },
        "2026-08-01",
      ),
    ).toEqual({ ok: true, value: { type: "weekdays", weekdays: [1, 5] } });
    expect(
      validateHabitSchedule(
        { type: "interval", everyDays: 31, anchorDate: "2026-08-01" },
        "2026-08-01",
      ),
    ).toEqual({ ok: false, error: "invalid_interval" });
    expect(
      validateHabitSchedule(
        { type: "custom_dates", dates: ["2026-08-01", "2027-09-01"] },
        "2026-08-01",
      ),
    ).toEqual({ ok: false, error: "range_too_large" });
  });

  it("generates only unique, due, bounded occurrences for arbitrary interval schedules", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 30 }),
        fc.integer({ min: 0, max: 180 }),
        fc.integer({ min: 0, max: 180 }),
        (everyDays, firstOffset, span) => {
          const startsOn = "2026-01-01";
          const anchorDate = addDays(startsOn, firstOffset);
          const through = addDays(startsOn, span);
          const dates = occurrenceDates(
            { type: "interval", everyDays, anchorDate },
            startsOn,
            startsOn,
            through,
          );
          expect(new Set(dates).size).toBe(dates.length);
          expect(
            dates.every((date) => date >= startsOn && date <= through),
          ).toBe(true);
          expect(
            dates.every((date) =>
              isHabitDueOn(
                { type: "interval", everyDays, anchorDate },
                date,
                startsOn,
              ),
            ),
          ).toBe(true);
        },
      ),
    );
  });

  it("keeps paused days outside consistency and uses a non-shaming zero baseline", () => {
    expect(calculateConsistency(["completed", "excused", "completed"])).toEqual(
      { dueCount: 2, completedCount: 2, percentage: 100, currentStreak: 2 },
    );
    expect(calculateConsistency(["excused"])).toEqual({
      dueCount: 0,
      completedCount: 0,
      percentage: 0,
      currentStreak: 0,
    });
  });

  it("applies target rules and derives quantified completion", () => {
    expect(validateHabitTarget("boolean", { value: 1, unit: "time" })).toEqual({
      ok: false,
      error: "target_not_allowed",
    });
    expect(
      validateHabitTarget("duration", { value: 20, unit: " minutes " }),
    ).toEqual({ ok: true, value: { value: 20, unit: "minutes" } });
    expect(completionFor("count", { value: 8, unit: "pages" }, 8, null)).toBe(
      true,
    );
    expect(completionFor("count", { value: 8, unit: "pages" }, 7, true)).toBe(
      false,
    );
  });
});
