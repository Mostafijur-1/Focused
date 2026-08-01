import { describe, expect, it } from "vitest";

import { defaultPomodoroConfig } from "@/features/focus/domain/focus-policy";
import {
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
});
