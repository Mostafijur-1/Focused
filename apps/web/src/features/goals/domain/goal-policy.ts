import { failure, success, type Result } from "@/domain/shared/result";
import type {
  FixedCommitment,
  GoalDraft,
  GoalKeyResultView,
  GoalMilestoneView,
  GoalProgressMode,
  GoalStatus,
  WeeklyOutcome,
} from "@/features/goals/domain/goal-types";
import { isIsoDate } from "@/features/habits/domain/habit-schedule";

export const goalLimits = {
  activePerMember: 100,
  hierarchyDepth: 3,
  titleLength: 200,
  descriptionLength: 10_000,
  successMeasureLength: 2_000,
  checkInNoteLength: 1_000,
  listPageMaximum: 100,
  historyPageSize: 30,
  milestonesPerGoal: 50,
  keyResultsPerGoal: 20,
  linksPerGoal: 50,
  weeklyOutcomes: 12,
  fixedCommitments: 30,
  weeklyCapacityMaximum: 10_080,
} as const;

const transitions: Readonly<Record<GoalStatus, readonly GoalStatus[]>> = {
  draft: ["active", "abandoned", "archived"],
  active: ["paused", "achieved", "abandoned", "archived"],
  paused: ["active", "abandoned", "archived"],
  achieved: ["active", "archived"],
  abandoned: ["active", "archived"],
  archived: ["draft", "active", "paused", "achieved", "abandoned"],
};

export function canTransitionGoal(from: GoalStatus, to: GoalStatus): boolean {
  return from !== to && transitions[from].includes(to);
}

export function calculateGoalProgress(
  mode: GoalProgressMode,
  manualProgress: number,
  milestones: readonly Pick<GoalMilestoneView, "status" | "weight">[],
  keyResults: readonly Pick<
    GoalKeyResultView,
    "currentValue" | "targetValue" | "weight"
  >[],
): number {
  if (mode === "manual") return clampProgress(manualProgress);
  if (mode === "milestones") {
    return weightedProgress(
      milestones.map((item) => ({
        ratio: item.status === "completed" ? 1 : 0,
        weight: item.weight,
      })),
    );
  }
  return weightedProgress(
    keyResults.map((item) => ({
      ratio: item.targetValue <= 0 ? 0 : item.currentValue / item.targetValue,
      weight: item.weight,
    })),
  );
}

export function validateGoalDraft(draft: GoalDraft): Result<GoalDraft, string> {
  const title = draft.title.trim();
  if (!title || title.length > goalLimits.titleLength)
    return failure("title_invalid");
  if (
    draft.description &&
    draft.description.trim().length > goalLimits.descriptionLength
  )
    return failure("description_too_long");
  if (!draft.horizon.trim() || draft.horizon.trim().length > 30)
    return failure("horizon_invalid");
  if (
    draft.successMeasure &&
    draft.successMeasure.trim().length > goalLimits.successMeasureLength
  )
    return failure("success_measure_too_long");
  if (draft.targetDate && !isIsoDate(draft.targetDate))
    return failure("target_date_invalid");
  if ((draft.targetValue === null) !== (draft.targetUnit === null))
    return failure("target_pair_required");
  if (
    draft.targetValue !== null &&
    (draft.targetValue <= 0 || !draft.targetUnit?.trim())
  )
    return failure("target_invalid");
  if (draft.manualProgress < 0 || draft.manualProgress > 100)
    return failure("progress_invalid");
  return success({
    ...draft,
    title,
    horizon: draft.horizon.trim(),
    description: draft.description?.trim() || null,
    successMeasure: draft.successMeasure?.trim() || null,
    targetUnit: draft.targetUnit?.trim() || null,
  });
}

export function isGoalOverdue(
  status: GoalStatus,
  targetDate: string | null,
  today: string,
): boolean {
  return (
    targetDate !== null &&
    targetDate < today &&
    (status === "active" || status === "paused")
  );
}

export function weeklyCapacity(
  capacityMinutes: number,
  commitments: readonly FixedCommitment[],
  outcomes: readonly Pick<WeeklyOutcome, "estimateMinutes">[],
): Readonly<{ committedMinutes: number; warning: "over_capacity" | null }> {
  const committedMinutes =
    commitments.reduce((total, item) => total + item.minutes, 0) +
    outcomes.reduce((total, item) => total + item.estimateMinutes, 0);
  return {
    committedMinutes,
    warning: committedMinutes > capacityMinutes ? "over_capacity" : null,
  };
}

function weightedProgress(
  items: readonly Readonly<{ ratio: number; weight: number }>[],
): number {
  const valid = items.filter((item) => item.weight > 0);
  const weight = valid.reduce((total, item) => total + item.weight, 0);
  if (weight === 0) return 0;
  return clampProgress(
    (valid.reduce(
      (total, item) =>
        total + Math.min(Math.max(item.ratio, 0), 1) * item.weight,
      0,
    ) /
      weight) *
      100,
  );
}

function clampProgress(value: number): number {
  return Math.round(Math.min(Math.max(value, 0), 100) * 100) / 100;
}
