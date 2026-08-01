import { describe, expect, it } from "vitest";

import {
  addAnalyticsDays,
  analyticsDateRange,
  analyticsDaysInclusive,
  analyticsLocalDate,
  analyticsLocalHour,
} from "@/features/analytics/domain/analytics-time";

describe("analytics time", () => {
  it("uses the source timezone at the date boundary", () => {
    const instant = new Date("2026-07-01T19:30:00.000Z");
    expect(analyticsLocalDate(instant, "Asia/Dhaka")).toBe("2026-07-02");
    expect(analyticsLocalHour(instant, "Asia/Dhaka")).toBe("01");
  });

  it("handles leap days and inclusive ranges", () => {
    expect(addAnalyticsDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(analyticsDateRange("2028-02-28", "2028-03-01")).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
    ]);
    expect(analyticsDaysInclusive("2028-02-28", "2028-03-01")).toBe(3);
  });

  it("rejects invalid local dates", () => {
    expect(() => analyticsDaysInclusive("2026-02-30", "2026-03-01")).toThrow();
  });
});
