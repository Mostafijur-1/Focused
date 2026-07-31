import type {
  DashboardData,
  DashboardDegradation,
  DashboardWidgetLayout,
  FocusSessionSummary,
  GoalSummary,
  HabitSummary,
  ReminderSummary,
  StoredDashboardSnapshot,
  TodayFocusSummary,
  WeeklyProgressSummary,
} from "@/features/dashboard/domain/dashboard-types";
import type { UtcDayRange } from "@/features/dashboard/domain/dashboard-time";

export interface DashboardIdentity {
  readonly displayName: string;
  readonly timeZone: string;
  readonly weekStartsOn: number;
}

export interface DashboardSnapshotWrite {
  readonly userId: string;
  readonly localDate: string;
  readonly timeZone: string;
  readonly data: DashboardData;
  readonly degradations: readonly DashboardDegradation[];
  readonly computedAt: Date;
  readonly sourceThrough: Date;
  readonly staleAfter: Date;
}

export interface DashboardProjectionEvent {
  readonly userId: string;
  readonly eventId: string;
  readonly occurredAt: Date;
}

export interface DashboardRepository {
  getIdentity(userId: string): Promise<DashboardIdentity>;
  findSnapshot(
    userId: string,
    localDate: string,
  ): Promise<StoredDashboardSnapshot | null>;
  saveSnapshot(snapshot: DashboardSnapshotWrite): Promise<void>;
  invalidateForEvent(
    event: DashboardProjectionEvent,
  ): Promise<"advanced" | "replayed">;
  getWidgetLayout(userId: string): Promise<DashboardWidgetLayout | null>;
  updateWidgetLayout(
    userId: string,
    layout: DashboardWidgetLayout,
    expectedVersion: number,
    now: Date,
  ): Promise<DashboardWidgetLayout | "conflict">;
  readTodayFocus(userId: string, localDate: string): Promise<TodayFocusSummary>;
  readFocusSession(userId: string): Promise<FocusSessionSummary>;
  readWeeklyProgress(
    userId: string,
    localDateStart: string,
    localDateEnd: string,
    range: UtcDayRange,
  ): Promise<WeeklyProgressSummary>;
  readHabits(userId: string, localDate: string): Promise<HabitSummary>;
  readGoals(userId: string): Promise<GoalSummary>;
  readReminders(
    userId: string,
    range: UtcDayRange,
    now: Date,
  ): Promise<ReminderSummary>;
}
