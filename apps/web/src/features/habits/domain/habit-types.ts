export const habitKinds = [
  "boolean",
  "count",
  "duration",
  "avoidance",
] as const;
export type HabitKind = (typeof habitKinds)[number];

export type HabitSchedule =
  | Readonly<{ type: "daily" }>
  | Readonly<{ type: "weekdays"; weekdays: readonly number[] }>
  | Readonly<{ type: "interval"; everyDays: number; anchorDate: string }>
  | Readonly<{ type: "custom_dates"; dates: readonly string[] }>;

export type HabitOccurrenceStatus = "due" | "completed" | "skipped" | "excused";

export interface HabitTarget {
  readonly value: number | null;
  readonly unit: string | null;
}

export interface HabitScheduleVersionView {
  readonly id: string;
  readonly revision: number;
  readonly schedule: HabitSchedule;
  readonly target: HabitTarget;
  readonly timeZone: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
}

export interface HabitOccurrenceView {
  readonly id: string;
  readonly localDate: string;
  readonly status: HabitOccurrenceStatus;
  readonly target: HabitTarget;
  readonly entry: HabitEntryView | null;
}

export interface HabitEntryView {
  readonly id: string;
  readonly value: number | null;
  readonly completed: boolean | null;
  readonly skippedReason: string | null;
  readonly note: string | null;
  readonly evidenceRef: string | null;
  readonly recordedAt: string;
  readonly correctedAt: string | null;
  readonly undoneAt: string | null;
  readonly version: number;
}

export interface HabitSummary {
  readonly id: string;
  readonly title: string;
  readonly kind: HabitKind;
  readonly startsOn: string;
  readonly paused: boolean;
  readonly archived: boolean;
  readonly version: number;
  readonly scheduleVersion: HabitScheduleVersionView;
  readonly today: HabitOccurrenceView | null;
  readonly consistency: Readonly<{
    dueCount: number;
    completedCount: number;
    percentage: number;
    currentStreak: number;
  }>;
}

export interface HabitListView {
  readonly localDate: string;
  readonly timeZone: string;
  readonly active: readonly HabitSummary[];
  readonly archived: readonly HabitSummary[];
  readonly syncToken: string;
}

export interface HabitHistoryPage {
  readonly habit: HabitSummary;
  readonly occurrences: readonly HabitOccurrenceView[];
  readonly nextCursor: string | null;
}

export interface HabitDraft {
  readonly title: string;
  readonly kind: HabitKind;
  readonly target: HabitTarget;
  readonly schedule: HabitSchedule;
  readonly startsOn: string;
  readonly timeZone: string;
}

export interface HabitCheckInDraft {
  readonly localDate: string;
  readonly value: number | null;
  readonly completed: boolean | null;
  readonly skippedReason: string | null;
  readonly note: string | null;
  readonly evidenceRef: string | null;
  readonly clientCommandId: string;
  readonly expectedVersion?: number | undefined;
}
