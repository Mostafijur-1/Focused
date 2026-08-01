export const analyticsMetricVersion = "focused.analytics.v1" as const;

export const interruptionCategoryKeys = [
  "notification",
  "phone",
  "person",
  "thought",
  "environment",
  "other",
] as const;

export type InterruptionCategoryKey = (typeof interruptionCategoryKeys)[number];

export interface DailyAnalyticsValues {
  readonly focusedSeconds: number;
  readonly plannedSeconds: number;
  readonly completedSessions: number;
  readonly abandonedSessions: number;
  readonly outcomesCaptured: number;
  readonly interruptionCount: number;
  readonly interruptionsByCategory: Readonly<Record<string, number>>;
  readonly interruptionsByHour: Readonly<Record<string, number>>;
  readonly habitDue: number;
  readonly habitCompleted: number;
  readonly habitSkipped: number;
  readonly habitExcused: number;
  readonly goalCheckIns: number;
  readonly goalProgressTotal: number;
  readonly weeklyPlansFinalized: number;
}

export interface DailyAnalyticsPoint extends DailyAnalyticsValues {
  readonly localDate: string;
}

export interface AnalyticsSummary {
  readonly focusedSeconds: number;
  readonly plannedSeconds: number;
  readonly completedSessions: number;
  readonly abandonedSessions: number;
  readonly planAttainmentPercent: number | null;
  readonly outcomeRatePercent: number | null;
  readonly activeFocusDays: number;
  readonly interruptionCount: number;
  readonly habitDue: number;
  readonly habitEligible: number;
  readonly habitCompleted: number;
  readonly habitSkipped: number;
  readonly habitExcused: number;
  readonly habitCompletionPercent: number | null;
  readonly goalCheckIns: number;
  readonly averageGoalProgress: number | null;
  readonly weeklyPlansFinalized: number;
}

export interface AnalyticsSnapshot {
  readonly schemaVersion: 1;
  readonly metricVersion: typeof analyticsMetricVersion;
  readonly range: Readonly<{ start: string; end: string; days: number }>;
  readonly timeZone: string;
  readonly computedAt: string;
  readonly sourceThrough: string;
  readonly freshness: "fresh" | "partial";
  readonly summary: AnalyticsSummary;
  readonly daily: readonly DailyAnalyticsPoint[];
  readonly interruptions: Readonly<{
    total: number;
    byCategory: Readonly<Record<string, number>>;
    byHour: Readonly<Record<string, number>>;
    sampleSize: number;
    disclosure: "self_reported_only";
  }>;
  readonly definitions: readonly MetricDefinitionView[];
  readonly limitations: readonly string[];
}

export interface MetricDefinitionView {
  readonly key: string;
  readonly version: number;
  readonly unit: string;
  readonly definition: string;
}

export interface AnalyticsIdentity {
  readonly timeZone: string;
}

export interface StoredAnalyticsDay {
  readonly localDate: string;
  readonly values: DailyAnalyticsValues;
  readonly computedAt: Date;
  readonly sourceThrough: Date;
}

export interface AnalyticsRange {
  readonly start: string;
  readonly end: string;
}

export interface GamificationView {
  readonly enabled: boolean;
  readonly version: number;
  readonly totalXp: number;
  readonly level: number;
  readonly levelTitle: string;
  readonly nextLevelXp: number | null;
  readonly achievements: readonly Readonly<{
    key: string;
    title: string;
    awardedAt: string;
  }>[];
  readonly streaks: readonly Readonly<{
    subjectType: string;
    currentCount: number;
    bestCount: number;
    lastQualifiedDate: string | null;
  }>[];
}

export interface AnalyticsReportView {
  readonly id: string;
  readonly type: "analytics_summary";
  readonly status: "completed";
  readonly schemaVersion: typeof analyticsMetricVersion;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly snapshot: AnalyticsSnapshot;
}

export type AnalyticsExportFormat = "csv" | "json";

export interface AnalyticsExportView {
  readonly id: string;
  readonly status: "completed";
  readonly format: AnalyticsExportFormat;
  readonly fileName: string;
  readonly contentType: string;
  readonly checksum: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
  readonly expiresAt: string;
}
