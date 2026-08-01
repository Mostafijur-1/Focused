export const goalStatuses = [
  "draft",
  "active",
  "paused",
  "achieved",
  "abandoned",
  "archived",
] as const;
export type GoalStatus = (typeof goalStatuses)[number];
export type GoalProgressMode = "manual" | "milestones" | "key_results";
export type GoalLinkType =
  "vision_area" | "plan_item" | "habit" | "learning_item" | "focus_session";

export interface GoalMilestoneView {
  readonly id: string;
  readonly title: string;
  readonly dueDate: string | null;
  readonly status:
    "planned" | "in_progress" | "completed" | "deferred" | "cancelled";
  readonly weight: number;
  readonly position: number;
  readonly version: number;
}

export interface GoalKeyResultView {
  readonly id: string;
  readonly title: string;
  readonly targetValue: number;
  readonly currentValue: number;
  readonly unit: string;
  readonly weight: number;
  readonly position: number;
  readonly version: number;
}

export interface GoalCheckInView {
  readonly id: string;
  readonly progress: number;
  readonly value: number | null;
  readonly note: string | null;
  readonly evidenceRef: string | null;
  readonly recordedAt: string;
}

export interface GoalLinkView {
  readonly id: string;
  readonly type: GoalLinkType;
  readonly resourceId: string;
  readonly label: string | null;
}

export interface GoalView {
  readonly id: string;
  readonly parentGoalId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: GoalStatus;
  readonly horizon: string;
  readonly priority: 1 | 2 | 3;
  readonly position: number;
  readonly progressMode: GoalProgressMode;
  readonly progress: number;
  readonly successMeasure: string | null;
  readonly targetValue: number | null;
  readonly targetUnit: string | null;
  readonly targetDate: string | null;
  readonly overdue: boolean;
  readonly archived: boolean;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly milestones: readonly GoalMilestoneView[];
  readonly keyResults: readonly GoalKeyResultView[];
  readonly links: readonly GoalLinkView[];
  readonly recentCheckIns: readonly GoalCheckInView[];
}

export interface GoalListView {
  readonly data: readonly GoalView[];
  readonly nextCursor: string | null;
  readonly total: number;
}

export interface GoalDraft {
  readonly parentGoalId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly horizon: string;
  readonly priority: 1 | 2 | 3;
  readonly progressMode: GoalProgressMode;
  readonly manualProgress: number;
  readonly successMeasure: string | null;
  readonly targetValue: number | null;
  readonly targetUnit: string | null;
  readonly targetDate: string | null;
}

export interface LifeVisionAreaView {
  readonly id: string;
  readonly key: string;
  readonly title: string;
  readonly statement: string | null;
  readonly position: number;
}

export interface LifeVisionView {
  readonly id: string;
  readonly revision: number;
  readonly status: "draft" | "published" | "archived";
  readonly narrative: string | null;
  readonly values: readonly string[];
  readonly antiGoals: readonly string[];
  readonly areas: readonly LifeVisionAreaView[];
  readonly publishedAt: string | null;
  readonly version: number;
}

export interface FixedCommitment {
  readonly title: string;
  readonly minutes: number;
}

export interface WeeklyOutcome {
  readonly id: string;
  readonly goalId: string | null;
  readonly title: string;
  readonly estimateMinutes: number;
  readonly status:
    "planned" | "in_progress" | "completed" | "deferred" | "cancelled";
  readonly position: number;
}

export interface WeeklyPlanView {
  readonly id: string;
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly timeZone: string;
  readonly status: "draft" | "active" | "closed" | "archived";
  readonly theme: string | null;
  readonly capacityMinutes: number;
  readonly committedMinutes: number;
  readonly warning: "over_capacity" | null;
  readonly fixedCommitments: readonly FixedCommitment[];
  readonly outcomes: readonly WeeklyOutcome[];
  readonly notDoing: readonly string[];
  readonly reflection: string | null;
  readonly version: number;
}
