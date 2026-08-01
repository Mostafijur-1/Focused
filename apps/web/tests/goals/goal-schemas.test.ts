import { describe, expect, it } from "vitest";
import {
  createGoalSchema,
  saveLifeVisionSchema,
  saveWeeklyPlanSchema,
  transitionGoalSchema,
} from "@/features/goals/transport/goal-schemas";

describe("goal transport schemas", () => {
  it("rejects incoherent targets and mass-assignment fields", () => {
    const input = {
      parentGoalId: null,
      title: "Learn systems",
      description: null,
      horizon: "year",
      priority: 2,
      progressMode: "manual",
      manualProgress: 0,
      successMeasure: null,
      targetValue: 10,
      targetUnit: null,
      targetDate: null,
      clientCommandId: crypto.randomUUID(),
    };
    expect(createGoalSchema.safeParse(input).success).toBe(false);
    expect(
      createGoalSchema.safeParse({
        ...input,
        targetUnit: "projects",
        userId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });

  it("requires explicit completion confirmation at the application boundary", () => {
    expect(
      transitionGoalSchema.parse({
        toStatus: "achieved",
        reason: null,
        clientCommandId: crypto.randomUUID(),
        expectedVersion: 1,
      }).confirmCompletion,
    ).toBe(false);
  });

  it("bounds private vision and weekly planning payloads", () => {
    expect(
      saveLifeVisionSchema.safeParse({
        narrative: null,
        values: [],
        antiGoals: [],
        areas: [],
        clientCommandId: crypto.randomUUID(),
      }).success,
    ).toBe(true);
    expect(
      saveWeeklyPlanSchema.safeParse({
        weekStart: "2026-07-27",
        theme: null,
        capacityMinutes: 1_200,
        fixedCommitments: [],
        notDoing: [],
        reflection: null,
        outcomes: [{ goalId: null, title: "Ship API", estimateMinutes: 180 }],
        clientCommandId: crypto.randomUUID(),
      }).success,
    ).toBe(true);
    expect(
      saveWeeklyPlanSchema.safeParse({
        weekStart: "2026-07-27",
        theme: null,
        capacityMinutes: 20_000,
        fixedCommitments: [],
        notDoing: [],
        reflection: null,
        outcomes: [],
        clientCommandId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
});
