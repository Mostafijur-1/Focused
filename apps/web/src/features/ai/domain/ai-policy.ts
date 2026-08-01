import type {
  AIContextScope,
  AILocale,
  GoalProposalPatch,
} from "@/features/ai/domain/ai-types";

export const aiPolicyVersion = "ai-policy-2026-08-01.1";
export const aiLimits = {
  messageCharacters: 2_000,
  historyMessages: 12,
  contextCharacters: 8_000,
  outputTokens: 900,
  dailyActions: 3,
  dailyTokens: 50_000,
  requestTimeoutMs: 20_000,
  proposalLifetimeMs: 7 * 24 * 60 * 60 * 1_000,
} as const;

const allowedScopes = new Set<AIContextScope>([
  "daily_plan",
  "focus_summary",
  "habit_summary",
  "goal_summary",
]);

const promptExfiltrationPatterns = [
  /reveal\s+(the\s+)?(system|developer)\s+prompt/iu,
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/iu,
  /print\s+(your\s+)?hidden\s+instructions/iu,
  /সিস্টেম\s+প্রম্পট\s+(দেখাও|লিখো|বল)/u,
] as const;

export interface ProviderPrivacyConfiguration {
  readonly groqConfigured: boolean;
  readonly groqZeroDataRetention: boolean;
  readonly geminiConfigured: boolean;
  readonly geminiServiceTier: "unpaid" | "paid";
}

export function validateAIRequest(
  input: Readonly<{
    message?: string;
    scopes: readonly AIContextScope[];
    locale: AILocale;
  }>,
): Readonly<{ message?: string; scopes: readonly AIContextScope[] }> {
  const message = input.message?.trim();
  if (
    message !== undefined &&
    (message.length < 1 || message.length > aiLimits.messageCharacters)
  )
    throw new Error("message_length");
  if (
    message &&
    promptExfiltrationPatterns.some((pattern) => pattern.test(message))
  )
    throw new Error("prompt_exfiltration");
  const scopes = [...new Set(input.scopes)];
  if (scopes.some((scope) => !allowedScopes.has(scope)))
    throw new Error("context_scope_not_allowed");
  return { ...(message === undefined ? {} : { message }), scopes };
}

export function eligibleProviders(
  configuration: ProviderPrivacyConfiguration,
): readonly ("groq" | "gemini")[] {
  const providers: ("groq" | "gemini")[] = [];
  if (configuration.groqConfigured && configuration.groqZeroDataRetention)
    providers.push("groq");
  if (
    configuration.geminiConfigured &&
    configuration.geminiServiceTier === "paid"
  )
    providers.push("gemini");
  return providers;
}

export function validateGoalProposal(
  proposal: GoalProposalPatch,
): GoalProposalPatch {
  const title = proposal.title.trim();
  if (!title || title.length > 200) throw new Error("proposal_title");
  const description = proposal.description?.trim() || null;
  if ((description?.length ?? 0) > 2_000)
    throw new Error("proposal_description");
  const successMeasure = proposal.successMeasure?.trim() || null;
  if ((successMeasure?.length ?? 0) > 500)
    throw new Error("proposal_success_measure");
  if (
    proposal.targetDate !== null &&
    !/^\d{4}-\d{2}-\d{2}$/u.test(proposal.targetDate)
  )
    throw new Error("proposal_target_date");
  return { ...proposal, title, description, successMeasure };
}

export function contextAsUntrustedData(
  facts: readonly Readonly<{ scope: AIContextScope; summary: string }>[],
): string {
  return facts
    .map(
      (fact) =>
        `<fact scope="${fact.scope}">${escapeContext(fact.summary)}</fact>`,
    )
    .join("\n")
    .slice(0, aiLimits.contextCharacters);
}

function escapeContext(value: string): string {
  return value.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
