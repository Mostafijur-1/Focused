import type {
  FixedCommitment,
  GoalDraft,
  GoalLinkType,
  GoalListView,
  GoalStatus,
  GoalView,
  LifeVisionView,
  WeeklyPlanView,
} from "@/features/goals/domain/goal-types";

export interface GoalProfile {
  readonly timeZone: string;
  readonly weekStartsOn: number;
}
export interface GoalContextCommand {
  readonly userId: string;
  readonly now: Date;
  readonly localDate: string;
}
export interface CreateGoalCommand extends GoalContextCommand {
  readonly draft: GoalDraft;
  readonly clientCommandId: string;
}
export interface UpdateGoalCommand extends GoalContextCommand {
  readonly goalId: string;
  readonly draft: GoalDraft;
  readonly expectedVersion: number;
}
export interface TransitionGoalCommand extends GoalContextCommand {
  readonly goalId: string;
  readonly toStatus: GoalStatus;
  readonly reason: string | null;
  readonly clientCommandId: string;
  readonly expectedVersion: number;
}
export interface CheckInGoalCommand extends GoalContextCommand {
  readonly timeZone?: string;
  readonly goalId: string;
  readonly progress: number;
  readonly value: number | null;
  readonly note: string | null;
  readonly evidenceRef: string | null;
  readonly clientCommandId: string;
  readonly expectedVersion: number;
}
export interface AddMilestoneCommand extends GoalContextCommand {
  readonly goalId: string;
  readonly title: string;
  readonly dueDate: string | null;
  readonly weight: number;
  readonly clientCommandId: string;
  readonly expectedVersion: number;
}
export interface UpdateMilestoneCommand extends GoalContextCommand {
  readonly goalId: string;
  readonly milestoneId: string;
  readonly title: string;
  readonly dueDate: string | null;
  readonly status:
    "planned" | "in_progress" | "completed" | "deferred" | "cancelled";
  readonly weight: number;
  readonly expectedVersion: number;
  readonly expectedGoalVersion: number;
}
export interface AddKeyResultCommand extends GoalContextCommand {
  readonly goalId: string;
  readonly title: string;
  readonly targetValue: number;
  readonly currentValue: number;
  readonly unit: string;
  readonly weight: number;
  readonly clientCommandId: string;
  readonly expectedVersion: number;
}
export interface UpdateKeyResultCommand extends GoalContextCommand {
  readonly goalId: string;
  readonly keyResultId: string;
  readonly title: string;
  readonly targetValue: number;
  readonly currentValue: number;
  readonly unit: string;
  readonly weight: number;
  readonly expectedVersion: number;
  readonly expectedGoalVersion: number;
}
export interface LinkGoalCommand extends GoalContextCommand {
  readonly goalId: string;
  readonly type: GoalLinkType;
  readonly resourceId: string;
  readonly label: string | null;
  readonly expectedVersion: number;
}

export interface LifeVisionDraftCommand extends GoalContextCommand {
  readonly narrative: string | null;
  readonly values: readonly string[];
  readonly antiGoals: readonly string[];
  readonly areas: readonly Readonly<{
    key: string;
    title: string;
    statement: string | null;
  }>[];
  readonly clientCommandId: string;
  readonly expectedVersion?: number | undefined;
}

export interface WeeklyPlanCommand extends GoalContextCommand {
  readonly weekStart: string;
  readonly theme: string | null;
  readonly capacityMinutes: number;
  readonly fixedCommitments: readonly FixedCommitment[];
  readonly notDoing: readonly string[];
  readonly reflection: string | null;
  readonly outcomes: readonly Readonly<{
    goalId: string | null;
    title: string;
    estimateMinutes: number;
  }>[];
  readonly clientCommandId: string;
  readonly expectedVersion?: number | undefined;
  readonly timeZone: string;
}

export type MutationResult<T> =
  T | "conflict" | "invalid_parent" | "invalid_reference" | null;

export interface GoalRepository {
  getProfile(userId: string): Promise<GoalProfile>;
  countOpen(userId: string): Promise<number>;
  list(
    userId: string,
    today: string,
    filter: Readonly<{
      status?: GoalStatus;
      query?: string;
      cursor?: string;
      limit: number;
    }>,
  ): Promise<GoalListView>;
  find(userId: string, goalId: string, today: string): Promise<GoalView | null>;
  validateParent(
    userId: string,
    goalId: string | null,
    parentGoalId: string | null,
  ): Promise<boolean>;
  create(command: CreateGoalCommand): Promise<GoalView>;
  update(command: UpdateGoalCommand): Promise<MutationResult<GoalView>>;
  transition(command: TransitionGoalCommand): Promise<MutationResult<GoalView>>;
  checkIn(command: CheckInGoalCommand): Promise<MutationResult<GoalView>>;
  addMilestone(command: AddMilestoneCommand): Promise<MutationResult<GoalView>>;
  updateMilestone(
    command: UpdateMilestoneCommand,
  ): Promise<MutationResult<GoalView>>;
  addKeyResult(command: AddKeyResultCommand): Promise<MutationResult<GoalView>>;
  updateKeyResult(
    command: UpdateKeyResultCommand,
  ): Promise<MutationResult<GoalView>>;
  link(command: LinkGoalCommand): Promise<MutationResult<GoalView>>;
  unlink(
    command: GoalContextCommand & {
      readonly goalId: string;
      readonly linkId: string;
      readonly expectedVersion: number;
    },
  ): Promise<MutationResult<GoalView>>;
  currentLifeVision(userId: string): Promise<LifeVisionView | null>;
  saveLifeVision(
    command: LifeVisionDraftCommand,
  ): Promise<MutationResult<LifeVisionView>>;
  publishLifeVision(
    command: GoalContextCommand & {
      readonly visionId: string;
      readonly expectedVersion: number;
      readonly clientCommandId: string;
    },
  ): Promise<MutationResult<LifeVisionView>>;
  weeklyPlan(userId: string, weekStart: string): Promise<WeeklyPlanView | null>;
  saveWeeklyPlan(
    command: WeeklyPlanCommand,
  ): Promise<MutationResult<WeeklyPlanView>>;
  transitionWeeklyPlan(
    command: GoalContextCommand & {
      readonly planId: string;
      readonly toStatus: "active" | "closed";
      readonly expectedVersion: number;
    },
  ): Promise<MutationResult<WeeklyPlanView>>;
}
