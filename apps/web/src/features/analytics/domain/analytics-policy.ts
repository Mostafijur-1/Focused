import {
  analyticsMetricVersion,
  type AnalyticsSnapshot,
  type DailyAnalyticsPoint,
  type DailyAnalyticsValues,
  type MetricDefinitionView,
} from "@/features/analytics/domain/analytics-types";

export const analyticsLimits = {
  maximumRangeDays: 366,
  defaultRangeDays: 28,
  exportTtlMilliseconds: 7 * 24 * 60 * 60_000,
  reportTtlMilliseconds: 90 * 24 * 60 * 60_000,
  maximumArtifactBytes: 5 * 1024 * 1024,
} as const;

export const analyticsDefinitions: readonly MetricDefinitionView[] = [
  {
    key: "focused_seconds",
    version: 1,
    unit: "seconds",
    definition:
      "Sum of completedFocusSeconds for completed Focus Sessions; running and abandoned sessions are excluded.",
  },
  {
    key: "plan_attainment",
    version: 1,
    unit: "percent",
    definition:
      "Focused seconds divided by planned seconds for completed sessions, multiplied by 100 and displayed at no more than 100%.",
  },
  {
    key: "outcome_rate",
    version: 1,
    unit: "percent",
    definition:
      "Completed sessions with a non-empty outcome divided by completed sessions; outcome text is never copied.",
  },
  {
    key: "habit_completion",
    version: 1,
    unit: "percent",
    definition:
      "Completed occurrences divided by due, completed, skipped, and excused occurrences.",
  },
  {
    key: "interruptions_self_reported",
    version: 1,
    unit: "count",
    definition:
      "Interruptions explicitly recorded by the member; no passive tracking and no interruption note is copied.",
  },
] as const;

export function emptyDailyValues(): DailyAnalyticsValues {
  return {
    focusedSeconds: 0,
    plannedSeconds: 0,
    completedSessions: 0,
    abandonedSessions: 0,
    outcomesCaptured: 0,
    interruptionCount: 0,
    interruptionsByCategory: {},
    interruptionsByHour: {},
    habitDue: 0,
    habitCompleted: 0,
    habitSkipped: 0,
    habitExcused: 0,
    goalCheckIns: 0,
    goalProgressTotal: 0,
    weeklyPlansFinalized: 0,
  };
}

export function summarizeAnalytics(input: {
  readonly range: Readonly<{ start: string; end: string }>;
  readonly timeZone: string;
  readonly days: readonly DailyAnalyticsPoint[];
  readonly computedAt: Date;
  readonly sourceThrough: Date;
  readonly partial: boolean;
  readonly limitations?: readonly string[];
}): AnalyticsSnapshot {
  const total = input.days.reduce<DailyAnalyticsValues>(
    (result, day) => ({
      focusedSeconds: result.focusedSeconds + day.focusedSeconds,
      plannedSeconds: result.plannedSeconds + day.plannedSeconds,
      completedSessions: result.completedSessions + day.completedSessions,
      abandonedSessions: result.abandonedSessions + day.abandonedSessions,
      outcomesCaptured: result.outcomesCaptured + day.outcomesCaptured,
      interruptionCount: result.interruptionCount + day.interruptionCount,
      habitDue: result.habitDue + day.habitDue,
      habitCompleted: result.habitCompleted + day.habitCompleted,
      habitSkipped: result.habitSkipped + day.habitSkipped,
      habitExcused: result.habitExcused + day.habitExcused,
      goalCheckIns: result.goalCheckIns + day.goalCheckIns,
      goalProgressTotal: result.goalProgressTotal + day.goalProgressTotal,
      weeklyPlansFinalized:
        result.weeklyPlansFinalized + day.weeklyPlansFinalized,
      interruptionsByCategory: result.interruptionsByCategory,
      interruptionsByHour: result.interruptionsByHour,
    }),
    emptyDailyValues(),
  );
  const byCategory: Record<string, number> = {};
  const byHour: Record<string, number> = {};
  for (const day of input.days) {
    mergeCounts(byCategory, day.interruptionsByCategory);
    mergeCounts(byHour, day.interruptionsByHour);
  }
  const denominator =
    total.habitDue +
    total.habitCompleted +
    total.habitSkipped +
    total.habitExcused;
  return {
    schemaVersion: 1,
    metricVersion: analyticsMetricVersion,
    range: {
      ...input.range,
      days: input.days.length,
    },
    timeZone: input.timeZone,
    computedAt: input.computedAt.toISOString(),
    sourceThrough: input.sourceThrough.toISOString(),
    freshness: input.partial ? "partial" : "fresh",
    summary: {
      focusedSeconds: total.focusedSeconds,
      plannedSeconds: total.plannedSeconds,
      completedSessions: total.completedSessions,
      abandonedSessions: total.abandonedSessions,
      planAttainmentPercent: percentage(
        total.focusedSeconds,
        total.plannedSeconds,
        true,
      ),
      outcomeRatePercent: percentage(
        total.outcomesCaptured,
        total.completedSessions,
      ),
      activeFocusDays: input.days.filter((day) => day.completedSessions > 0)
        .length,
      interruptionCount: total.interruptionCount,
      habitDue: total.habitDue,
      habitEligible: denominator,
      habitCompleted: total.habitCompleted,
      habitSkipped: total.habitSkipped,
      habitExcused: total.habitExcused,
      habitCompletionPercent: percentage(total.habitCompleted, denominator),
      goalCheckIns: total.goalCheckIns,
      averageGoalProgress:
        total.goalCheckIns === 0
          ? null
          : rounded(total.goalProgressTotal / total.goalCheckIns),
      weeklyPlansFinalized: total.weeklyPlansFinalized,
    },
    daily: input.days,
    interruptions: {
      total: total.interruptionCount,
      byCategory,
      byHour,
      sampleSize: total.interruptionCount,
      disclosure: "self_reported_only",
    },
    definitions: analyticsDefinitions,
    limitations: input.limitations ?? [],
  };
}

function mergeCounts(
  target: Record<string, number>,
  source: Readonly<Record<string, number>>,
) {
  for (const [key, count] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + count;
  }
}

function percentage(numerator: number, denominator: number, cap = false) {
  if (denominator === 0) return null;
  const value = (numerator / denominator) * 100;
  return rounded(cap ? Math.min(value, 100) : value);
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

export function isAnalyticsMetricVersion(value: string): boolean {
  return value === analyticsMetricVersion;
}
