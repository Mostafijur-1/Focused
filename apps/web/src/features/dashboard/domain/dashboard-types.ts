export const dashboardWidgetKeys = [
  "today_focus",
  "active_session",
  "weekly_progress",
  "habits",
  "goals",
  "reminders",
  "ai_coach",
] as const;

export type DashboardWidgetKey = (typeof dashboardWidgetKeys)[number];
export type DashboardSource =
  | "today_focus"
  | "focus_sessions"
  | "weekly_progress"
  | "habits"
  | "goals"
  | "reminders"
  | "projection_persistence";

export interface DashboardWidgetSetting {
  readonly key: DashboardWidgetKey;
  readonly visible: boolean;
}

export interface DashboardWidgetLayout {
  readonly version: number;
  readonly widgets: readonly DashboardWidgetSetting[];
}

export interface DashboardPriority {
  readonly id: string;
  readonly title: string;
  readonly status: "planned" | "in_progress" | "completed";
}

export interface TodayFocusSummary {
  readonly state: "ready" | "empty" | "unavailable";
  readonly priorities: readonly DashboardPriority[];
  readonly completedCount: number;
  readonly totalCount: number;
}

export interface FocusSessionSummary {
  readonly state: "active" | "not_configured" | "unavailable";
  readonly session: Readonly<{
    id: string;
    intent: string;
    kind: "deep_work" | "pomodoro" | "custom";
    status: "running" | "paused";
    plannedSeconds: number;
    startedAt: string;
  }> | null;
}

export interface WeeklyProgressSummary {
  readonly state: "ready" | "empty" | "unavailable";
  readonly completedPriorities: number;
  readonly totalPriorities: number;
  readonly focusedSeconds: number;
}

export interface HabitSummary {
  readonly state: "ready" | "not_configured" | "unavailable";
  readonly completedCount: number;
  readonly dueCount: number;
}

export interface GoalSummary {
  readonly state: "ready" | "not_configured" | "unavailable";
  readonly activeCount: number;
  readonly nextGoal: Readonly<{ id: string; title: string }> | null;
}

export interface ReminderSummary {
  readonly state: "ready" | "not_configured" | "unavailable";
  readonly dueCount: number;
  readonly nextReminder: Readonly<{
    id: string;
    title: string;
    scheduledFor: string;
  }> | null;
}

export interface DashboardDegradation {
  readonly source: DashboardSource;
  readonly code: "source_unavailable" | "projection_not_persisted";
}

export interface DashboardData {
  readonly displayName: string;
  readonly todayFocus: TodayFocusSummary;
  readonly focusSession: FocusSessionSummary;
  readonly weeklyProgress: WeeklyProgressSummary;
  readonly habits: HabitSummary;
  readonly goals: GoalSummary;
  readonly reminders: ReminderSummary;
  readonly aiCoach: Readonly<{ state: "coming_soon" }>;
}

export interface DashboardSnapshot {
  readonly schemaVersion: 1;
  readonly localDate: string;
  readonly timeZone: string;
  readonly computedAt: string;
  readonly sourceThrough: string;
  readonly staleAfter: string;
  readonly freshness: "fresh" | "stale";
  readonly data: DashboardData;
  readonly layout: DashboardWidgetLayout;
  readonly degradations: readonly DashboardDegradation[];
}

export interface StoredDashboardSnapshot {
  readonly data: DashboardData;
  readonly localDate: string;
  readonly timeZone: string;
  readonly computedAt: Date;
  readonly sourceThrough: Date;
  readonly staleAfter: Date;
  readonly degradations: readonly DashboardDegradation[];
}
