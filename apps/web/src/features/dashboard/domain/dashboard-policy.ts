import { failure, success, type Result } from "@/domain/shared/result";

import {
  dashboardWidgetKeys,
  type DashboardWidgetKey,
  type DashboardWidgetLayout,
  type DashboardWidgetSetting,
} from "./dashboard-types";

export const defaultDashboardLayout: DashboardWidgetLayout = {
  version: 1,
  widgets: dashboardWidgetKeys.map((key) => ({ key, visible: true })),
};

export type DashboardLayoutIssue =
  | "unsupported_widget"
  | "duplicate_widget"
  | "missing_widget"
  | "primary_widget_hidden"
  | "primary_widget_moved"
  | "too_many_hidden";

export function validateDashboardLayout(
  widgets: readonly DashboardWidgetSetting[],
): Result<readonly DashboardWidgetSetting[], DashboardLayoutIssue> {
  const supported = new Set<string>(dashboardWidgetKeys);
  if (widgets.some((widget) => !supported.has(widget.key))) {
    return failure("unsupported_widget");
  }
  if (new Set(widgets.map((widget) => widget.key)).size !== widgets.length) {
    return failure("duplicate_widget");
  }
  if (
    widgets.length !== dashboardWidgetKeys.length ||
    dashboardWidgetKeys.some(
      (key) => !widgets.some((widget) => widget.key === key),
    )
  ) {
    return failure("missing_widget");
  }
  if (!widgets[0] || widgets[0].key !== "today_focus") {
    return failure("primary_widget_moved");
  }
  if (!widgets[0].visible) return failure("primary_widget_hidden");
  if (widgets.filter((widget) => widget.visible).length < 2) {
    return failure("too_many_hidden");
  }
  return success(widgets);
}

export function isDashboardWidgetKey(
  value: string,
): value is DashboardWidgetKey {
  return dashboardWidgetKeys.some((key) => key === value);
}

export function snapshotFreshness(
  staleAfter: Date,
  now: Date,
): "fresh" | "stale" {
  return staleAfter > now ? "fresh" : "stale";
}
