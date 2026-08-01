import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  calculateGoalProgress,
  canTransitionGoal,
  isGoalOverdue,
  validateGoalDraft,
  weeklyCapacity,
} from "@/features/goals/domain/goal-policy";
import {
  isCanonicalWeek,
  weekBounds,
} from "@/features/goals/domain/weekly-plan-policy";

describe("goal and planning policies", () => {
  it("keeps weighted progress bounded for arbitrary positive weights", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            currentValue: fc.double({ min: 0, max: 1_000, noNaN: true }),
            targetValue: fc.double({ min: 0.01, max: 1_000, noNaN: true }),
            weight: fc.double({ min: 0.01, max: 100, noNaN: true }),
          }),
          { maxLength: 20 },
        ),
        (items) => {
          const progress = calculateGoalProgress("key_results", 0, [], items);
          expect(progress).toBeGreaterThanOrEqual(0);
          expect(progress).toBeLessThanOrEqual(100);
        },
      ),
    );
  });

  it("allows only explicit state-machine transitions", () => {
    expect(canTransitionGoal("draft", "active")).toBe(true);
    expect(canTransitionGoal("draft", "achieved")).toBe(false);
    expect(canTransitionGoal("achieved", "active")).toBe(true);
    expect(canTransitionGoal("archived", "paused")).toBe(true);
  });

  it("normalizes drafts and enforces coherent quantified targets", () => {
    const base = {
      parentGoalId: null,
      title: "  Ship Focused  ",
      description: null,
      horizon: " year ",
      priority: 1 as const,
      progressMode: "manual" as const,
      manualProgress: 10,
      successMeasure: null,
      targetValue: null,
      targetUnit: null,
      targetDate: "2026-12-31",
    };
    expect(validateGoalDraft(base)).toMatchObject({
      ok: true,
      value: { title: "Ship Focused", horizon: "year" },
    });
    expect(validateGoalDraft({ ...base, targetValue: 100 })).toEqual({
      ok: false,
      error: "target_pair_required",
    });
  });

  it("warns without blocking capacity and applies owner-local overdue semantics", () => {
    expect(
      weeklyCapacity(
        120,
        [{ title: "Class", minutes: 90 }],
        [{ estimateMinutes: 60 }],
      ),
    ).toEqual({ committedMinutes: 150, warning: "over_capacity" });
    expect(isGoalOverdue("active", "2026-07-31", "2026-08-01")).toBe(true);
    expect(isGoalOverdue("achieved", "2026-07-31", "2026-08-01")).toBe(false);
  });

  it("builds canonical seven-day weeks across month boundaries", () => {
    expect(weekBounds("2026-08-01", 1)).toEqual({
      start: "2026-07-27",
      end: "2026-08-02",
    });
    expect(isCanonicalWeek("2026-07-27", "2026-08-02")).toBe(true);
    expect(isCanonicalWeek("2026-07-27", "2026-08-03")).toBe(false);
  });
});
