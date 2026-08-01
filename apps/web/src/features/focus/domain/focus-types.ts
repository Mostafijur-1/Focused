export const focusKinds = ["deep_work", "pomodoro", "custom"] as const;
export type FocusKind = (typeof focusKinds)[number];

export const focusStatuses = [
  "running",
  "paused",
  "completed",
  "abandoned",
] as const;
export type FocusStatus = (typeof focusStatuses)[number];

export const intervalKinds = ["focus", "short_break", "long_break"] as const;
export type FocusIntervalKind = (typeof intervalKinds)[number];

export const interruptionCategories = [
  "notification",
  "phone",
  "person",
  "thought",
  "environment",
  "other",
] as const;
export type InterruptionCategory = (typeof interruptionCategories)[number];

export interface PomodoroConfig {
  readonly focusSeconds: number;
  readonly shortBreakSeconds: number;
  readonly longBreakSeconds: number;
  readonly cycles: number;
  readonly longBreakEvery: number;
  readonly autoStartBreaks: boolean;
  readonly autoStartFocus: boolean;
  readonly audioEnabled: boolean;
  readonly vibrationEnabled: boolean;
}

export interface PomodoroPresetView extends PomodoroConfig {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly version: number;
}

export interface FocusIntervalView {
  readonly id: string;
  readonly kind: FocusIntervalKind;
  readonly status: "running" | "paused" | "completed" | "skipped";
  readonly cycleNumber: number;
  readonly plannedSeconds: number;
  readonly elapsedSeconds: number;
  readonly remainingSeconds: number;
  readonly overtimeSeconds: number;
  readonly startedAt: string;
  readonly endedAt: string | null;
}

export interface FocusSessionView {
  readonly id: string;
  readonly goalId: string | null;
  readonly goalTitle: string | null;
  readonly pomodoroPresetId: string | null;
  readonly kind: FocusKind;
  readonly status: FocusStatus;
  readonly intent: string;
  readonly plannedSeconds: number;
  readonly focusedSeconds: number;
  readonly pausedSeconds: number;
  readonly interruptionCount: number;
  readonly timeZone: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly abandonedAt: string | null;
  readonly outcome: string | null;
  readonly version: number;
  readonly activeInterval: FocusIntervalView | null;
  readonly pomodoroConfig: PomodoroConfig | null;
  readonly serverNow: string;
}

export interface FocusOverview {
  readonly active: FocusSessionView | null;
  readonly recent: readonly FocusSessionView[];
  readonly presets: readonly PomodoroPresetView[];
  readonly goalOptions: readonly Readonly<{ id: string; title: string }>[];
  readonly serverNow: string;
}

export interface FocusStartDraft {
  readonly kind: FocusKind;
  readonly intent: string;
  readonly plannedSeconds: number;
  readonly goalId: string | null;
  readonly pomodoroPresetId: string | null;
  readonly pomodoroConfig: PomodoroConfig | null;
  readonly timeZone: string;
}
