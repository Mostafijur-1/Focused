import { describe, expect, it } from "vitest";

import {
  analyticsDefinitions,
  emptyDailyValues,
  summarizeAnalytics,
} from "@/features/analytics/domain/analytics-policy";

describe("analytics policy", () => {
  it("calculates the v1 golden metrics deterministically", () => {
    const snapshot = summarizeAnalytics({
      range: { start: "2026-07-01", end: "2026-07-02" },
      timeZone: "Asia/Dhaka",
      computedAt: new Date("2026-07-03T00:00:00.000Z"),
      sourceThrough: new Date("2026-07-02T20:00:00.000Z"),
      partial: false,
      days: [
        {
          localDate: "2026-07-01",
          ...emptyDailyValues(),
          focusedSeconds: 3600,
          plannedSeconds: 5400,
          completedSessions: 2,
          outcomesCaptured: 1,
          interruptionCount: 2,
          interruptionsByCategory: { phone: 2 },
          habitCompleted: 3,
          habitDue: 1,
          goalCheckIns: 1,
          goalProgressTotal: 40,
        },
        {
          localDate: "2026-07-02",
          ...emptyDailyValues(),
          focusedSeconds: 5400,
          plannedSeconds: 3600,
          completedSessions: 1,
          outcomesCaptured: 1,
          interruptionCount: 1,
          interruptionsByCategory: { thought: 1 },
          habitCompleted: 1,
          habitExcused: 1,
          goalCheckIns: 1,
          goalProgressTotal: 60,
        },
      ],
    });

    expect(snapshot.summary).toMatchObject({
      focusedSeconds: 9000,
      plannedSeconds: 9000,
      completedSessions: 3,
      planAttainmentPercent: 100,
      outcomeRatePercent: 66.7,
      activeFocusDays: 2,
      interruptionCount: 3,
      habitDue: 1,
      habitEligible: 6,
      habitCompleted: 4,
      habitExcused: 1,
      habitCompletionPercent: 66.7,
      goalCheckIns: 2,
      averageGoalProgress: 50,
    });
    expect(snapshot.interruptions.byCategory).toEqual({ phone: 2, thought: 1 });
    expect(snapshot.interruptions.disclosure).toBe("self_reported_only");
  });

  it("returns null percentages when there is no denominator", () => {
    const snapshot = summarizeAnalytics({
      range: { start: "2026-07-01", end: "2026-07-01" },
      timeZone: "UTC",
      computedAt: new Date(0),
      sourceThrough: new Date(0),
      partial: true,
      days: [{ localDate: "2026-07-01", ...emptyDailyValues() }],
    });
    expect(snapshot.summary.planAttainmentPercent).toBeNull();
    expect(snapshot.summary.outcomeRatePercent).toBeNull();
    expect(snapshot.summary.habitCompletionPercent).toBeNull();
    expect(snapshot.freshness).toBe("partial");
  });

  it("publishes definitions that explicitly exclude private text", () => {
    expect(
      analyticsDefinitions.find((item) => item.key === "outcome_rate")
        ?.definition,
    ).toContain("text");
    expect(
      analyticsDefinitions.find(
        (item) => item.key === "interruptions_self_reported",
      )?.definition,
    ).toContain("note");
  });
});
