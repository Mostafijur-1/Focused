export const aiLocales = ["bn-BD", "en"] as const;
export type AILocale = (typeof aiLocales)[number];

export const aiContextScopes = [
  "daily_plan",
  "focus_summary",
  "habit_summary",
  "goal_summary",
] as const;
export type AIContextScope = (typeof aiContextScopes)[number];

export type AIRunKind = "coach" | "daily_review";
export type AIRunState =
  "queued" | "running" | "completed" | "failed" | "cancelled" | "expired";

export interface AIEvidence {
  readonly scope: AIContextScope;
  readonly label: string;
  readonly observedAt: string;
  readonly sourceVersion: string;
}

export interface AIContextSnapshot {
  readonly localDate: string;
  readonly timeZone: string;
  readonly facts: readonly Readonly<{
    scope: AIContextScope;
    summary: string;
    evidence: AIEvidence;
  }>[];
  readonly missingScopes: readonly AIContextScope[];
}

export interface AIUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

export interface AIMessageView {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly citations: readonly AIEvidence[];
  readonly model: string | null;
  readonly createdAt: string;
}

export interface AIProposalView {
  readonly id: string;
  readonly runId: string;
  readonly targetType: "goal";
  readonly operation: "create";
  readonly patch: GoalProposalPatch;
  readonly editedPatch: GoalProposalPatch | null;
  readonly rationale: string;
  readonly status:
    | "pending"
    | "applying"
    | "accepted"
    | "apply_failed"
    | "rejected"
    | "expired"
    | "superseded";
  readonly expiresAt: string;
  readonly appliedResourceId: string | null;
  readonly version: number;
}

export interface GoalProposalPatch {
  readonly title: string;
  readonly description: string | null;
  readonly horizon: "month" | "quarter" | "year";
  readonly priority: 1 | 2 | 3;
  readonly successMeasure: string | null;
  readonly targetDate: string | null;
}

export interface DailyReviewOutput {
  readonly headline: string;
  readonly summary: string;
  readonly wins: readonly string[];
  readonly friction: readonly string[];
  readonly missingData: readonly string[];
  readonly nextActions: readonly string[];
  readonly evidence: readonly AIEvidence[];
  readonly generatedBy: "ai" | "deterministic";
}

export interface AIRunView {
  readonly id: string;
  readonly conversationId: string | null;
  readonly kind: AIRunKind;
  readonly state: AIRunState;
  readonly locale: AILocale;
  readonly provider: "groq" | "gemini" | "deterministic" | null;
  readonly model: string | null;
  readonly promptVersion: string;
  readonly policyVersion: string;
  readonly scopes: readonly AIContextScope[];
  readonly output: DailyReviewOutput | null;
  readonly usage: AIUsage;
  readonly failureCode: string | null;
  readonly queuedAt: string;
  readonly completedAt: string | null;
  readonly proposals: readonly AIProposalView[];
}

export interface AIOverview {
  readonly available: boolean;
  readonly unavailableReason: "not_configured" | "privacy_policy" | null;
  readonly conversations: readonly Readonly<{
    id: string;
    title: string;
    updatedAt: string;
    messages: readonly AIMessageView[];
  }>[];
  readonly latestDailyReview: AIRunView | null;
  readonly pendingProposals: readonly AIProposalView[];
  readonly allowedScopes: readonly AIContextScope[];
}

export type AIStreamEvent =
  | Readonly<{ type: "run.started"; runId: string; conversationId: string }>
  | Readonly<{ type: "message.delta"; runId: string; delta: string }>
  | Readonly<{ type: "citation"; runId: string; evidence: AIEvidence }>
  | Readonly<{ type: "usage"; runId: string; usage: AIUsage }>
  | Readonly<{ type: "warning"; runId: string; code: string; message: string }>
  | Readonly<{
      type: "run.completed";
      runId: string;
      message: AIMessageView;
      proposals: readonly AIProposalView[];
    }>
  | Readonly<{
      type: "run.failed";
      runId: string;
      code: string;
      message: string;
    }>;
