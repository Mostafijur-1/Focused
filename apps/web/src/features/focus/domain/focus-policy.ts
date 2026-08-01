import type {
  FocusIntervalKind,
  PomodoroConfig,
} from "@/features/focus/domain/focus-types";

export const focusLimits = {
  minimumSeconds: 60,
  maximumSeconds: 43_200,
  maximumIntentLength: 300,
  maximumOutcomeLength: 2_000,
  maximumInterruptionNoteLength: 500,
  maximumPauseReasonLength: 160,
  maximumExtensionSeconds: 10_800,
  recentSessions: 20,
} as const;

export const defaultPomodoroConfig: PomodoroConfig = {
  focusSeconds: 25 * 60,
  shortBreakSeconds: 5 * 60,
  longBreakSeconds: 15 * 60,
  cycles: 4,
  longBreakEvery: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  audioEnabled: true,
  vibrationEnabled: false,
};

export function validPomodoroConfig(config: PomodoroConfig): boolean {
  return (
    Number.isInteger(config.focusSeconds) &&
    config.focusSeconds >= 60 &&
    config.focusSeconds <= 10_800 &&
    Number.isInteger(config.shortBreakSeconds) &&
    config.shortBreakSeconds >= 60 &&
    config.shortBreakSeconds <= 3_600 &&
    Number.isInteger(config.longBreakSeconds) &&
    config.longBreakSeconds >= 60 &&
    config.longBreakSeconds <= 7_200 &&
    Number.isInteger(config.cycles) &&
    config.cycles >= 1 &&
    config.cycles <= 12 &&
    Number.isInteger(config.longBreakEvery) &&
    config.longBreakEvery >= 1 &&
    config.longBreakEvery <= 12 &&
    config.focusSeconds * config.cycles <= focusLimits.maximumSeconds
  );
}

export interface PauseSpan {
  readonly startedAt: Date;
  readonly endedAt: Date | null;
}

export interface TimerCalculation {
  readonly elapsedSeconds: number;
  readonly pausedSeconds: number;
  readonly remainingSeconds: number;
  readonly overtimeSeconds: number;
}

export function calculateTimer(
  startedAt: Date,
  endedAt: Date | null,
  plannedSeconds: number,
  pauses: readonly PauseSpan[],
  now: Date,
): TimerCalculation {
  const boundary = endedAt && endedAt < now ? endedAt : now;
  const wallMilliseconds = Math.max(
    0,
    boundary.getTime() - startedAt.getTime(),
  );
  const pausedMilliseconds = pauses.reduce((total, pause) => {
    const pauseStart = Math.max(pause.startedAt.getTime(), startedAt.getTime());
    const pauseEnd = Math.min(
      (pause.endedAt ?? boundary).getTime(),
      boundary.getTime(),
    );
    return total + Math.max(0, pauseEnd - pauseStart);
  }, 0);
  const pausedSeconds = Math.floor(pausedMilliseconds / 1_000);
  const elapsedSeconds = Math.max(
    0,
    Math.floor(wallMilliseconds / 1_000) - pausedSeconds,
  );
  return {
    elapsedSeconds,
    pausedSeconds,
    remainingSeconds: Math.max(0, plannedSeconds - elapsedSeconds),
    overtimeSeconds: Math.max(0, elapsedSeconds - plannedSeconds),
  };
}

export function nextPomodoroInterval(
  current: Readonly<{ kind: FocusIntervalKind; cycleNumber: number }>,
  config: PomodoroConfig,
): Readonly<{
  kind: FocusIntervalKind;
  cycleNumber: number;
  plannedSeconds: number;
}> | null {
  if (current.kind === "focus") {
    if (current.cycleNumber >= config.cycles) return null;
    const longBreak = current.cycleNumber % config.longBreakEvery === 0;
    return {
      kind: longBreak ? "long_break" : "short_break",
      cycleNumber: current.cycleNumber,
      plannedSeconds: longBreak
        ? config.longBreakSeconds
        : config.shortBreakSeconds,
    };
  }
  return {
    kind: "focus",
    cycleNumber: current.cycleNumber + 1,
    plannedSeconds: config.focusSeconds,
  };
}
