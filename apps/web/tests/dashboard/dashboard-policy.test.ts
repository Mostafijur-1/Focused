import { describe, expect, it } from "vitest";

import {
  defaultDashboardLayout,
  snapshotFreshness,
  validateDashboardLayout,
} from "@/features/dashboard/domain/dashboard-policy";
import {
  localDateAt,
  utcDayRange,
} from "@/features/dashboard/domain/dashboard-time";

describe("Dashboard widget policy", () => {
  it("accepts the safe default layout", () => {
    expect(validateDashboardLayout(defaultDashboardLayout.widgets)).toEqual({
      ok: true,
      value: defaultDashboardLayout.widgets,
    });
  });

  it("keeps the primary card visible and first", () => {
    const hidden = defaultDashboardLayout.widgets.map((widget) =>
      widget.key === "today_focus" ? { ...widget, visible: false } : widget,
    );
    expect(validateDashboardLayout(hidden)).toEqual({
      ok: false,
      error: "primary_widget_hidden",
    });

    const moved = [
      defaultDashboardLayout.widgets[1]!,
      defaultDashboardLayout.widgets[0]!,
      ...defaultDashboardLayout.widgets.slice(2),
    ];
    expect(validateDashboardLayout(moved)).toEqual({
      ok: false,
      error: "primary_widget_moved",
    });
  });

  it("rejects duplicate, missing, and overloaded hidden layouts", () => {
    const duplicate = [
      ...defaultDashboardLayout.widgets.slice(0, -1),
      defaultDashboardLayout.widgets[1]!,
    ];
    expect(validateDashboardLayout(duplicate)).toEqual({
      ok: false,
      error: "duplicate_widget",
    });
    expect(
      validateDashboardLayout(defaultDashboardLayout.widgets.slice(0, -1)),
    ).toEqual({ ok: false, error: "missing_widget" });
    expect(
      validateDashboardLayout(
        defaultDashboardLayout.widgets.map((widget, index) => ({
          ...widget,
          visible: index === 0,
        })),
      ),
    ).toEqual({ ok: false, error: "too_many_hidden" });
  });

  it("calculates freshness at the exact boundary", () => {
    const now = new Date("2026-07-31T12:00:00.000Z");
    expect(snapshotFreshness(new Date("2026-07-31T12:00:01.000Z"), now)).toBe(
      "fresh",
    );
    expect(snapshotFreshness(now, now)).toBe("stale");
  });
});

describe("Dashboard date boundaries", () => {
  it("formats the member-local date", () => {
    expect(
      localDateAt(new Date("2026-07-31T18:30:00.000Z"), "Asia/Dhaka"),
    ).toBe("2026-08-01");
  });

  it("handles 23-hour and 25-hour DST days", () => {
    const spring = utcDayRange("2026-03-08", "America/New_York");
    const autumn = utcDayRange("2026-11-01", "America/New_York");
    expect(spring.start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * 3_600_000);
    expect(autumn.start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(autumn.end.getTime() - autumn.start.getTime()).toBe(25 * 3_600_000);
  });
});
