import type { Clock } from "@/application/ports/clock";
import { requirePermission } from "@/features/auth/application/authorization-policy";
import type { AuthUser } from "@/features/auth/domain/auth-types";
import type {
  GoalRepository,
  LifeVisionDraftCommand,
  WeeklyPlanCommand,
} from "@/features/goals/application/ports";
import {
  canTransitionGoal,
  goalLimits,
  validateGoalDraft,
} from "@/features/goals/domain/goal-policy";
import type {
  GoalDraft,
  GoalLinkType,
  GoalListView,
  GoalStatus,
  GoalView,
  LifeVisionView,
  WeeklyPlanView,
} from "@/features/goals/domain/goal-types";
import {
  isCanonicalWeek,
  weekBounds,
} from "@/features/goals/domain/weekly-plan-policy";
import { localDateAt } from "@/features/dashboard/domain/dashboard-time";
import { addDays, isIsoDate } from "@/features/habits/domain/habit-schedule";
import { AppError } from "@/lib/errors/app-error";

interface GoalServiceDependencies {
  readonly repository: GoalRepository;
  readonly clock: Clock;
}

export class GoalService {
  constructor(private readonly dependencies: GoalServiceDependencies) {}

  async list(
    user: AuthUser,
    filter: Readonly<{
      status?: GoalStatus;
      query?: string;
      cursor?: string;
      limit?: number;
    }>,
  ): Promise<GoalListView> {
    requirePermission(user, "goals:read:own");
    const { localDate } = await this.context(user.id);
    return this.dependencies.repository.list(user.id, localDate, {
      ...filter,
      limit: Math.min(
        Math.max(filter.limit ?? 30, 1),
        goalLimits.listPageMaximum,
      ),
    });
  }

  async detail(user: AuthUser, goalId: string): Promise<GoalView> {
    requirePermission(user, "goals:read:own");
    const { localDate } = await this.context(user.id);
    const goal = await this.dependencies.repository.find(
      user.id,
      goalId,
      localDate,
    );
    if (!goal) throw notFound("Goal not found.");
    return goal;
  }

  async create(
    user: AuthUser,
    input: GoalDraft & { readonly clientCommandId: string },
  ): Promise<GoalView> {
    requirePermission(user, "goals:write:own");
    const context = await this.context(user.id);
    const draft = validDraft(input);
    if (
      (await this.dependencies.repository.countOpen(user.id)) >=
      goalLimits.activePerMember
    )
      throw validation("/title", "open_goal_limit");
    if (
      !(await this.dependencies.repository.validateParent(
        user.id,
        null,
        draft.parentGoalId,
      ))
    )
      throw validation("/parentGoalId", "invalid_goal_hierarchy");
    return this.dependencies.repository.create({
      userId: user.id,
      draft,
      clientCommandId: input.clientCommandId,
      ...context,
    });
  }

  async update(
    user: AuthUser,
    goalId: string,
    input: GoalDraft & { readonly expectedVersion: number },
  ): Promise<GoalView> {
    requirePermission(user, "goals:write:own");
    const context = await this.context(user.id);
    const draft = validDraft(input);
    if (
      !(await this.dependencies.repository.validateParent(
        user.id,
        goalId,
        draft.parentGoalId,
      ))
    )
      throw validation("/parentGoalId", "invalid_goal_hierarchy");
    return requireMutation(
      await this.dependencies.repository.update({
        userId: user.id,
        goalId,
        draft,
        expectedVersion: input.expectedVersion,
        ...context,
      }),
    );
  }

  async transition(
    user: AuthUser,
    goalId: string,
    input: Readonly<{
      toStatus: GoalStatus;
      reason: string | null;
      confirmCompletion: boolean;
      clientCommandId: string;
      expectedVersion: number;
    }>,
  ): Promise<GoalView> {
    requirePermission(user, "goals:write:own");
    const current = await this.detail(user, goalId);
    if (!canTransitionGoal(current.status, input.toStatus))
      throw conflict("invalid_goal_transition");
    if (input.toStatus === "achieved" && !input.confirmCompletion)
      throw validation(
        "/confirmCompletion",
        "completion_confirmation_required",
      );
    return requireMutation(
      await this.dependencies.repository.transition({
        userId: user.id,
        goalId,
        toStatus: input.toStatus,
        reason: input.reason?.trim() || null,
        clientCommandId: input.clientCommandId,
        expectedVersion: input.expectedVersion,
        ...(await this.context(user.id)),
      }),
    );
  }

  async checkIn(
    user: AuthUser,
    goalId: string,
    input: Readonly<{
      progress: number | null;
      value: number | null;
      note: string | null;
      evidenceRef: string | null;
      clientCommandId: string;
      expectedVersion: number;
    }>,
  ): Promise<GoalView> {
    requirePermission(user, "goals:write:own");
    const current = await this.detail(user, goalId);
    if (["achieved", "abandoned", "archived"].includes(current.status))
      throw conflict("goal_not_checkable");
    if (input.note && input.note.trim().length > goalLimits.checkInNoteLength)
      throw validation("/note", "note_too_long");
    let progress = current.progress;
    if (current.progressMode === "manual") {
      progress =
        current.targetValue !== null && input.value !== null
          ? Math.min((input.value / current.targetValue) * 100, 100)
          : (input.progress ?? Number.NaN);
      if (!Number.isFinite(progress) || progress < 0 || progress > 100)
        throw validation("/progress", "progress_invalid");
    }
    return requireMutation(
      await this.dependencies.repository.checkIn({
        userId: user.id,
        goalId,
        progress,
        value: input.value,
        note: input.note?.trim() || null,
        evidenceRef: input.evidenceRef,
        clientCommandId: input.clientCommandId,
        expectedVersion: input.expectedVersion,
        ...(await this.context(user.id)),
      }),
    );
  }

  async addMilestone(
    user: AuthUser,
    goalId: string,
    input: Readonly<{
      title: string;
      dueDate: string | null;
      weight: number;
      clientCommandId: string;
      expectedVersion: number;
    }>,
  ): Promise<GoalView> {
    requirePermission(user, "goals:write:own");
    if (
      !input.title.trim() ||
      input.title.trim().length > 200 ||
      input.weight <= 0 ||
      (input.dueDate && !isIsoDate(input.dueDate))
    )
      throw validation("/title", "milestone_invalid");
    return requireMutation(
      await this.dependencies.repository.addMilestone({
        userId: user.id,
        goalId,
        title: input.title.trim(),
        dueDate: input.dueDate,
        weight: input.weight,
        clientCommandId: input.clientCommandId,
        expectedVersion: input.expectedVersion,
        ...(await this.context(user.id)),
      }),
    );
  }

  async updateMilestone(
    user: AuthUser,
    goalId: string,
    milestoneId: string,
    input: Readonly<{
      title: string;
      dueDate: string | null;
      status:
        "planned" | "in_progress" | "completed" | "deferred" | "cancelled";
      weight: number;
      expectedVersion: number;
      expectedGoalVersion: number;
    }>,
  ): Promise<GoalView> {
    requirePermission(user, "goals:write:own");
    if (
      !input.title.trim() ||
      input.weight <= 0 ||
      (input.dueDate && !isIsoDate(input.dueDate))
    )
      throw validation("/title", "milestone_invalid");
    return requireMutation(
      await this.dependencies.repository.updateMilestone({
        userId: user.id,
        goalId,
        milestoneId,
        ...input,
        title: input.title.trim(),
        ...(await this.context(user.id)),
      }),
    );
  }

  async addKeyResult(
    user: AuthUser,
    goalId: string,
    input: Readonly<{
      title: string;
      targetValue: number;
      currentValue: number;
      unit: string;
      weight: number;
      clientCommandId: string;
      expectedVersion: number;
    }>,
  ): Promise<GoalView> {
    requirePermission(user, "goals:write:own");
    if (
      !input.title.trim() ||
      input.targetValue <= 0 ||
      input.currentValue < 0 ||
      !input.unit.trim() ||
      input.weight <= 0
    )
      throw validation("/title", "key_result_invalid");
    return requireMutation(
      await this.dependencies.repository.addKeyResult({
        userId: user.id,
        goalId,
        ...input,
        title: input.title.trim(),
        unit: input.unit.trim(),
        ...(await this.context(user.id)),
      }),
    );
  }

  async updateKeyResult(
    user: AuthUser,
    goalId: string,
    keyResultId: string,
    input: Readonly<{
      title: string;
      targetValue: number;
      currentValue: number;
      unit: string;
      weight: number;
      expectedVersion: number;
      expectedGoalVersion: number;
    }>,
  ): Promise<GoalView> {
    requirePermission(user, "goals:write:own");
    if (
      !input.title.trim() ||
      input.targetValue <= 0 ||
      input.currentValue < 0 ||
      !input.unit.trim() ||
      input.weight <= 0
    )
      throw validation("/title", "key_result_invalid");
    return requireMutation(
      await this.dependencies.repository.updateKeyResult({
        userId: user.id,
        goalId,
        keyResultId,
        ...input,
        title: input.title.trim(),
        unit: input.unit.trim(),
        ...(await this.context(user.id)),
      }),
    );
  }

  async link(
    user: AuthUser,
    goalId: string,
    input: Readonly<{
      type: GoalLinkType;
      resourceId: string;
      label: string | null;
      expectedVersion: number;
    }>,
  ): Promise<GoalView> {
    requirePermission(user, "goals:write:own");
    return requireMutation(
      await this.dependencies.repository.link({
        userId: user.id,
        goalId,
        ...input,
        label: input.label?.trim() || null,
        ...(await this.context(user.id)),
      }),
    );
  }

  async unlink(
    user: AuthUser,
    goalId: string,
    linkId: string,
    expectedVersion: number,
  ): Promise<GoalView> {
    requirePermission(user, "goals:write:own");
    return requireMutation(
      await this.dependencies.repository.unlink({
        userId: user.id,
        goalId,
        linkId,
        expectedVersion,
        ...(await this.context(user.id)),
      }),
    );
  }

  async lifeVision(user: AuthUser): Promise<LifeVisionView | null> {
    requirePermission(user, "life_vision:read:own");
    return this.dependencies.repository.currentLifeVision(user.id);
  }

  async saveLifeVision(
    user: AuthUser,
    input: Omit<LifeVisionDraftCommand, "userId" | "now" | "localDate">,
  ): Promise<LifeVisionView> {
    requirePermission(user, "life_vision:write:own");
    if (
      (input.narrative?.length ?? 0) > 10_000 ||
      input.values.length > 20 ||
      input.antiGoals.length > 20 ||
      input.areas.length > 12
    )
      throw validation("/narrative", "life_vision_too_large");
    if (
      new Set(input.areas.map((area) => area.key)).size !== input.areas.length
    )
      throw validation("/areas", "life_vision_area_keys_must_be_unique");
    return requireMutation(
      await this.dependencies.repository.saveLifeVision({
        ...input,
        userId: user.id,
        ...(await this.context(user.id)),
      }),
    );
  }

  async publishLifeVision(
    user: AuthUser,
    visionId: string,
    expectedVersion: number,
    clientCommandId: string,
  ): Promise<LifeVisionView> {
    requirePermission(user, "life_vision:write:own");
    return requireMutation(
      await this.dependencies.repository.publishLifeVision({
        userId: user.id,
        visionId,
        expectedVersion,
        clientCommandId,
        ...(await this.context(user.id)),
      }),
    );
  }

  async weeklyPlan(
    user: AuthUser,
    weekStart?: string,
  ): Promise<WeeklyPlanView | null> {
    requirePermission(user, "weekly_plans:read:own");
    const context = await this.context(user.id);
    const bounds = weekBounds(context.localDate, context.weekStartsOn);
    const start = weekStart ?? bounds.start;
    if (
      !isIsoDate(start) ||
      weekBounds(start, context.weekStartsOn).start !== start
    )
      throw validation("/weekStart", "week_start_invalid");
    return this.dependencies.repository.weeklyPlan(user.id, start);
  }

  async saveWeeklyPlan(
    user: AuthUser,
    input: Omit<WeeklyPlanCommand, "userId" | "now" | "localDate" | "timeZone">,
  ): Promise<WeeklyPlanView> {
    requirePermission(user, "weekly_plans:write:own");
    const context = await this.context(user.id);
    if (
      !isCanonicalWeek(input.weekStart, addDays(input.weekStart, 6)) ||
      weekBounds(input.weekStart, context.weekStartsOn).start !==
        input.weekStart
    )
      throw validation("/weekStart", "week_start_invalid");
    if (
      input.capacityMinutes < 0 ||
      input.capacityMinutes > goalLimits.weeklyCapacityMaximum ||
      input.outcomes.length > goalLimits.weeklyOutcomes ||
      input.fixedCommitments.length > goalLimits.fixedCommitments ||
      input.fixedCommitments.some((item) => item.minutes < 0) ||
      input.outcomes.some(
        (item) => !item.title.trim() || item.estimateMinutes < 0,
      ) ||
      input.fixedCommitments.some((item) => !item.title.trim())
    )
      throw validation("/capacityMinutes", "weekly_capacity_invalid");
    return requireMutation(
      await this.dependencies.repository.saveWeeklyPlan({
        ...input,
        userId: user.id,
        timeZone: context.timeZone,
        now: context.now,
        localDate: context.localDate,
      }),
    );
  }

  async transitionWeeklyPlan(
    user: AuthUser,
    planId: string,
    toStatus: "active" | "closed",
    expectedVersion: number,
  ): Promise<WeeklyPlanView> {
    requirePermission(user, "weekly_plans:write:own");
    return requireMutation(
      await this.dependencies.repository.transitionWeeklyPlan({
        userId: user.id,
        planId,
        toStatus,
        expectedVersion,
        ...(await this.context(user.id)),
      }),
    );
  }

  private async context(userId: string) {
    const now = this.dependencies.clock.now();
    const profile = await this.dependencies.repository.getProfile(userId);
    return {
      now,
      localDate: localDateAt(now, profile.timeZone),
      timeZone: profile.timeZone,
      weekStartsOn: profile.weekStartsOn,
    };
  }
}

function validDraft(input: GoalDraft): GoalDraft {
  const result = validateGoalDraft(input);
  if (!result.ok) throw validation("/title", result.error);
  return result.value;
}
function requireMutation<T>(
  result: T | "conflict" | "invalid_parent" | "invalid_reference" | null,
): T {
  if (result === null) throw notFound("Resource not found.");
  if (result === "conflict") throw conflict("version_conflict");
  if (result === "invalid_parent")
    throw validation("/parentGoalId", "invalid_goal_hierarchy");
  if (result === "invalid_reference")
    throw validation("/resourceId", "linked_resource_not_owned");
  return result;
}
function validation(pointer: string, code: string) {
  return new AppError({
    code: "VALIDATION_ERROR",
    status: 422,
    safeMessage: "Review the goal details and try again.",
    details: { errors: [{ pointer, code, message: code }] },
  });
}
function conflict(code: string) {
  return new AppError({
    code: "CONFLICT",
    safeMessage: "This changed on another device. Refresh and try again.",
    details: { code },
  });
}
function notFound(message: string) {
  return new AppError({ code: "NOT_FOUND", safeMessage: message });
}
