import { describe, expect, it } from "vitest";

import { defaultPomodoroConfig } from "@/features/focus/domain/focus-policy";
import {
  focusOverviewResponseSchema,
  focusResponseSchema,
  interruptionSchema,
  startFocusSchema,
  terminalFocusSchema,
} from "@/features/focus/transport/focus-schemas";

describe("Focus Timer transport schemas", () => {
  it("accepts a bounded Pomodoro start command", () => {
    expect(
      startFocusSchema.safeParse({
        kind: "pomodoro",
        intent: "Ship the timer",
        plannedSeconds: 1_500,
        goalId: null,
        pomodoroPresetId: null,
        pomodoroConfig: defaultPomodoroConfig,
        timeZone: "Asia/Dhaka",
        clientCommandId: crypto.randomUUID(),
      }).success,
    ).toBe(true);
  });

  it("rejects mass assignment and invalid durations", () => {
    expect(
      startFocusSchema.safeParse({
        kind: "deep_work",
        intent: "Ship",
        plannedSeconds: 10,
        timeZone: "UTC",
        clientCommandId: crypto.randomUUID(),
        userId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });

  it("requires replay identifiers on terminal and interruption commands", () => {
    expect(
      terminalFocusSchema.safeParse({ expectedVersion: 1, outcome: null })
        .success,
    ).toBe(false);
    expect(
      interruptionSchema.safeParse({
        expectedVersion: 1,
        clientCommandId: crypto.randomUUID(),
        category: "thought",
        note: "Remembered another task",
      }).success,
    ).toBe(true);
  });

  it("accepts the API data envelope without an undocumented success flag", () => {
    const session = {
      id: crypto.randomUUID(),
      goalId: null,
      goalTitle: null,
      pomodoroPresetId: null,
      kind: "deep_work",
      status: "running",
      intent: "Ship the timer",
      plannedSeconds: 3_000,
      focusedSeconds: 0,
      pausedSeconds: 0,
      interruptionCount: 0,
      timeZone: "Asia/Dhaka",
      startedAt: "2026-08-01T06:00:00.000Z",
      completedAt: null,
      abandonedAt: null,
      outcome: null,
      version: 1,
      activeInterval: null,
      pomodoroConfig: null,
      serverNow: "2026-08-01T06:00:00.000Z",
    } as const;

    expect(focusResponseSchema.safeParse({ data: session }).success).toBe(true);
    expect(
      focusOverviewResponseSchema.safeParse({
        data: {
          active: null,
          recent: [],
          presets: [],
          goalOptions: [],
          serverNow: session.serverNow,
        },
      }).success,
    ).toBe(true);
  });
});
