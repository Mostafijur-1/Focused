import { failure, success, type Result } from "@/domain/shared/result";

import type { HabitDraft, HabitKind, HabitTarget } from "./habit-types";

export const habitLimits = {
  activePerMember: 100,
  backfillDays: 90,
  historyPageSize: 42,
  historyMaximumDays: 366,
  titleLength: 160,
  noteLength: 500,
  reasonLength: 160,
  targetMaximum: 1_000_000,
} as const;

export type HabitTargetIssue =
  | "target_not_allowed"
  | "target_required"
  | "target_out_of_range"
  | "unit_required"
  | "unit_not_allowed";

export function validateHabitTarget(
  kind: HabitKind,
  target: HabitTarget,
): Result<HabitTarget, HabitTargetIssue> {
  if (kind === "boolean" || kind === "avoidance") {
    return target.value === null && target.unit === null
      ? success(target)
      : failure("target_not_allowed");
  }
  if (target.value === null) return failure("target_required");
  if (target.value <= 0 || target.value > habitLimits.targetMaximum) {
    return failure("target_out_of_range");
  }
  if (!target.unit?.trim()) return failure("unit_required");
  if (target.unit.trim().length > 40) return failure("unit_not_allowed");
  return success({ value: target.value, unit: target.unit.trim() });
}

export function validateHabitDraft(
  draft: HabitDraft,
): Result<HabitDraft, HabitTargetIssue | "title_required"> {
  const title = draft.title.trim();
  if (!title || title.length > habitLimits.titleLength) {
    return failure("title_required");
  }
  const target = validateHabitTarget(draft.kind, draft.target);
  if (!target.ok) return target;
  return success({ ...draft, title, target: target.value });
}

export function completionFor(
  kind: HabitKind,
  target: HabitTarget,
  value: number | null,
  completed: boolean | null,
): boolean {
  if (kind === "boolean" || kind === "avoidance") return completed === true;
  return target.value !== null && value !== null && value >= target.value;
}
