import { describe, expect, it } from "vitest";

import { defaultDashboardLayout } from "@/features/dashboard/domain/dashboard-policy";
import {
  dashboardWidgetLayoutSchema,
  updateDashboardWidgetsSchema,
} from "@/features/dashboard/transport/dashboard-schemas";

describe("Dashboard transport schemas", () => {
  it("accepts an exact versioned widget command", () => {
    expect(
      updateDashboardWidgetsSchema.safeParse({
        expectedVersion: 1,
        widgets: defaultDashboardLayout.widgets,
      }).success,
    ).toBe(true);
  });

  it("rejects unknown fields, invalid versions, and incomplete layouts", () => {
    expect(
      updateDashboardWidgetsSchema.safeParse({
        expectedVersion: 0,
        widgets: defaultDashboardLayout.widgets.slice(0, -1),
        role: "admin",
      }).success,
    ).toBe(false);
    expect(
      dashboardWidgetLayoutSchema.safeParse({
        version: 1,
        widgets: [{ key: "today_focus", visible: true }],
      }).success,
    ).toBe(false);
  });
});
