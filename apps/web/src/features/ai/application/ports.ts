import type { AuthUser } from "@/features/auth/domain/auth-types";
import type {
  AIContextScope,
  AIContextSnapshot,
  AIEvidence,
  AILocale,
  AIMessageView,
  AIOverview,
  AIProposalView,
  AIRunKind,
  AIRunView,
  AIUsage,
  DailyReviewOutput,
  GoalProposalPatch,
} from "@/features/ai/domain/ai-types";

export type AIProviderName = "groq" | "gemini";

export interface AIProviderRequest {
  readonly systemInstruction: string;
  readonly messages: readonly Readonly<{
    role: "user" | "assistant";
    content: string;
  }>[];
  readonly maxOutputTokens: number;
  readonly temperature: number;
}

export type AIProviderStreamChunk =
  | Readonly<{ type: "delta"; text: string }>
  | Readonly<{ type: "usage"; usage: AIUsage }>;

export interface AIProvider {
  readonly name: AIProviderName;
  readonly model: string;
  stream(
    request: AIProviderRequest,
    signal: AbortSignal,
  ): AsyncIterable<AIProviderStreamChunk>;
  generateStructured(
    request: AIProviderRequest,
    jsonSchema: Readonly<Record<string, unknown>>,
    signal: AbortSignal,
  ): Promise<Readonly<{ text: string; usage: AIUsage }>>;
}

export interface AIProviderRouter {
  select(
    capability: "fast_text" | "deep_review",
    eligible: readonly AIProviderName[],
  ): AIProvider | null;
  fallback(
    current: AIProviderName,
    eligible: readonly AIProviderName[],
  ): AIProvider | null;
}

export interface CreateAIRunCommand {
  readonly userId: string;
  readonly conversationId: string | null;
  readonly clientRequestId: string;
  readonly kind: AIRunKind;
  readonly locale: AILocale;
  readonly title: string;
  readonly message: string | null;
  readonly scopes: readonly AIContextScope[];
  readonly promptVersion: string;
  readonly policyVersion: string;
  readonly modelAlias: "fast_text" | "deep_review";
  readonly context: AIContextSnapshot;
  readonly now: Date;
}

export interface CreatedAIRun {
  readonly run: AIRunView;
  readonly conversationId: string | null;
  readonly replayed: boolean;
  readonly messages: readonly AIMessageView[];
}

export interface CompleteCoachCommand {
  readonly runId: string;
  readonly userId: string;
  readonly conversationId: string;
  readonly content: string;
  readonly citations: readonly AIEvidence[];
  readonly provider: AIProviderName | "deterministic";
  readonly model: string;
  readonly usage: AIUsage;
  readonly completedAt: Date;
}

export interface CompleteDailyReviewCommand {
  readonly runId: string;
  readonly userId: string;
  readonly output: DailyReviewOutput;
  readonly provider: AIProviderName | "deterministic";
  readonly model: string;
  readonly usage: AIUsage;
  readonly proposal: GoalProposalPatch | null;
  readonly proposalRationale: string | null;
  readonly completedAt: Date;
}

export interface AIRepository {
  overview(userId: string): Promise<AIOverview>;
  tokenUsageSince(userId: string, since: Date): Promise<number>;
  context(
    userId: string,
    scopes: readonly AIContextScope[],
    now: Date,
  ): Promise<AIContextSnapshot>;
  createRun(command: CreateAIRunCommand): Promise<CreatedAIRun>;
  history(
    userId: string,
    conversationId: string,
    limit: number,
  ): Promise<readonly AIMessageView[]>;
  markRunning(
    userId: string,
    runId: string,
    provider: AIProviderName,
    model: string,
    startedAt: Date,
  ): Promise<void>;
  completeCoach(command: CompleteCoachCommand): Promise<
    Readonly<{
      message: AIMessageView;
      proposals: readonly AIProposalView[];
    }>
  >;
  completeDailyReview(command: CompleteDailyReviewCommand): Promise<AIRunView>;
  failRun(
    userId: string,
    runId: string,
    failureCode: string,
    completedAt: Date,
  ): Promise<void>;
  cancelRun(userId: string, runId: string, cancelledAt: Date): Promise<void>;
  findProposal(
    userId: string,
    proposalId: string,
  ): Promise<AIProposalView | null>;
  beginProposalApply(
    command: Readonly<{
      userId: string;
      proposalId: string;
      expectedVersion: number;
      decisionCommandId: string;
      editedPatch: GoalProposalPatch | null;
      decisionNote: string | null;
      now: Date;
    }>,
  ): Promise<AIProposalView | "conflict">;
  completeProposalApply(
    command: Readonly<{
      userId: string;
      proposalId: string;
      decisionCommandId: string;
      appliedResourceId: string;
      now: Date;
    }>,
  ): Promise<AIProposalView>;
  failProposalApply(
    userId: string,
    proposalId: string,
    decisionCommandId: string,
  ): Promise<void>;
  rejectProposal(
    command: Readonly<{
      userId: string;
      proposalId: string;
      expectedVersion: number;
      decisionCommandId: string;
      decisionNote: string | null;
      now: Date;
    }>,
  ): Promise<AIProposalView | "conflict">;
}

export interface AIProposalExecutor {
  applyGoal(
    actor: AuthUser,
    patch: GoalProposalPatch,
    clientCommandId: string,
  ): Promise<Readonly<{ id: string }>>;
}
