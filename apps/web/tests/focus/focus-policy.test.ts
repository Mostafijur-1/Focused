import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  calculateTimer,
  defaultPomodoroConfig,
  nextPomodoroInterval,
  validPomodoroConfig,
} from "@/features/focus/domain/focus-policy";

describe("Focus Timer policy", () => {
  it("reconstructs elapsed time from timestamps after sleep or refresh", () => {
    const startedAt = new Date("2026-08-01T06:00:00.000Z");
    const now = new Date("2026-08-01T06:45:00.000Z");
    expect(
      calculateTimer(
        startedAt,
        null,
        2_400,
        [
          {
            startedAt: new Date("2026-08-01T06:10:00.000Z"),
            endedAt: new Date("2026-08-01T06:15:00.000Z"),
          },
        ],
        now,
      ),
    ).toEqual({
      elapsedSeconds: 2_400,
      pausedSeconds: 300,
      remainingSeconds: 0,
      overtimeSeconds: 0,
    });
  });

  it("freezes an open pause at the authoritative boundary", () => {
    const startedAt = new Date("2026-08-01T06:00:00.000Z");
    expect(
      calculateTimer(
        startedAt,
        null,
        1_500,
        [{ startedAt: new Date("2026-08-01T06:05:00.000Z"), endedAt: null }],
        new Date("2026-08-01T07:00:00.000Z"),
      ).elapsedSeconds,
    ).toBe(300);
  });

  it("moves through focus, short break, and long break cycles", () => {
    expect(
      nextPomodoroInterval(
        { kind: "focus", cycleNumber: 1 },
        defaultPomodoroConfig,
      ),
    ).toMatchObject({ kind: "short_break", cycleNumber: 1 });
    expect(
      nextPomodoroInterval(
        { kind: "short_break", cycleNumber: 1 },
        defaultPomodoroConfig,
      ),
    ).toMatchObject({ kind: "focus", cycleNumber: 2 });
    expect(
      nextPomodoroInterval(
        { kind: "focus", cycleNumber: 4 },
        defaultPomodoroConfig,
      ),
    ).toBeNull();
  });

  it("never produces negative timer values for valid wall durations", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 86_400 }),
        fc.integer({ min: 60, max: 43_200 }),
        (elapsed, planned) => {
          const startedAt = new Date(0);
          const result = calculateTimer(
            startedAt,
            null,
            planned,
            [],
            new Date(elapsed * 1_000),
          );
          expect(result.elapsedSeconds).toBeGreaterThanOrEqual(0);
          expect(result.remainingSeconds).toBeGreaterThanOrEqual(0);
          expect(result.overtimeSeconds).toBeGreaterThanOrEqual(0);
        },
      ),
    );
    expect(validPomodoroConfig(defaultPomodoroConfig)).toBe(true);
  });
});
