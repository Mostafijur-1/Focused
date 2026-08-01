import type { Clock } from "@/application/ports/clock";
import { requirePermission } from "@/features/auth/application/authorization-policy";
import type { AuthUser } from "@/features/auth/domain/auth-types";
import type { AIRateLimiter } from "@/features/ai/application/ai-rate-limiter";
import type {
  AIProposalExecutor,
  AIProvider,
  AIProviderName,
  AIProviderRouter,
  AIRepository,
} from "@/features/ai/application/ports";
import {
  aiLimits,
  aiPolicyVersion,
  contextAsUntrustedData,
  eligibleProviders,
  type ProviderPrivacyConfiguration,
  validateAIRequest,
  validateGoalProposal,
} from "@/features/ai/domain/ai-policy";
import type {
  AIContextScope,
  AILocale,
  AIOverview,
  AIProposalView,
  AIRunView,
  AIStreamEvent,
  AIUsage,
  DailyReviewOutput,
  GoalProposalPatch,
} from "@/features/ai/domain/ai-types";
import {
  coachPromptVersion,
  coachSystemPrompt,
  dailyReviewPromptVersion,
  dailyReviewSystemPrompt,
} from "@/features/ai/domain/prompt-registry";
import { normalizeProviderFailure } from "@/features/ai/infrastructure/providers/provider-error";
import {
  dailyReviewJsonSchema,
  generatedDailyReviewSchema,
} from "@/features/ai/transport/ai-schemas";
import { AppError } from "@/lib/errors/app-error";

interface AIServiceDependencies {
  readonly repository: AIRepository;
  readonly router: AIProviderRouter;
  readonly proposalExecutor: AIProposalExecutor;
  readonly rateLimiter: AIRateLimiter;
  readonly clock: Clock;
  readonly privacy: ProviderPrivacyConfiguration;
}

interface CoachInput {
  readonly conversationId: string | null;
  readonly clientRequestId: string;
  readonly locale: AILocale;
  readonly message: string;
  readonly contextScopes: readonly AIContextScope[];
}

interface DailyReviewInput {
  readonly clientRequestId: string;
  readonly locale: AILocale;
  readonly contextScopes: readonly AIContextScope[];
  readonly includeGoalProposal: boolean;
}

export class AIService {
  constructor(private readonly dependencies: AIServiceDependencies) {}

  async overview(actor: AuthUser): Promise<AIOverview> {
    requirePermission(actor, "ai:read:own");
    const overview = await this.dependencies.repository.overview(actor.id);
    const providers = eligibleProviders(this.dependencies.privacy);
    return {
      ...overview,
      available: providers.length > 0,
      unavailableReason:
        providers.length > 0
          ? null
          : this.dependencies.privacy.groqConfigured ||
              this.dependencies.privacy.geminiConfigured
            ? "privacy_policy"
            : "not_configured",
    };
  }

  async streamCoach(
    actor: AuthUser,
    input: CoachInput,
    emit: (event: AIStreamEvent) => void | Promise<void>,
    signal: AbortSignal,
  ): Promise<void> {
    requirePermission(actor, "ai:write:own");
    await this.enforceRateLimit(actor.id);
    const validated = this.validate({
      message: input.message,
      scopes: input.contextScopes,
      locale: input.locale,
    });
    const now = this.dependencies.clock.now();
    const context = await this.dependencies.repository.context(
      actor.id,
      validated.scopes,
      now,
    );
    const created = await this.dependencies.repository.createRun({
      userId: actor.id,
      conversationId: input.conversationId,
      clientRequestId: input.clientRequestId,
      kind: "coach",
      locale: input.locale,
      title: validated.message!.slice(0, 80),
      message: validated.message!,
      scopes: validated.scopes,
      promptVersion: coachPromptVersion,
      policyVersion: aiPolicyVersion,
      modelAlias: "fast_text",
      context,
      now,
    });
    const conversationId = created.conversationId;
    if (!conversationId) throw new Error("coach_conversation_missing");
    await emit({ type: "run.started", runId: created.run.id, conversationId });
    if (created.replayed && created.run.state === "completed") {
      const message = [...created.messages]
        .reverse()
        .find((item) => item.role === "assistant");
      if (message)
        await emit({
          type: "run.completed",
          runId: created.run.id,
          message,
          proposals: created.run.proposals,
        });
      return;
    }

    const providers = eligibleProviders(this.dependencies.privacy);
    const primary = this.dependencies.router.select("fast_text", providers);
    const request = {
      systemInstruction: `${coachSystemPrompt(input.locale)}\n\n<focused_context>\n${contextAsUntrustedData(context.facts)}\n</focused_context>`,
      messages: created.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      maxOutputTokens: aiLimits.outputTokens,
      temperature: 0.35,
    } as const;
    let content = "";
    let usage: AIUsage = { inputTokens: null, outputTokens: null };
    let usedProvider: AIProvider | null = null;
    let failureCode: string | null = null;

    for (const provider of providerOrder(
      primary,
      this.dependencies.router,
      providers,
    )) {
      if (content) break;
      try {
        usedProvider = provider;
        await this.dependencies.repository.markRunning(
          actor.id,
          created.run.id,
          provider.name,
          provider.model,
          this.dependencies.clock.now(),
        );
        const timeoutSignal = AbortSignal.any([
          signal,
          AbortSignal.timeout(aiLimits.requestTimeoutMs),
        ]);
        for await (const chunk of provider.stream(request, timeoutSignal)) {
          if (chunk.type === "usage") usage = chunk.usage;
          else {
            content += chunk.text;
            await emit({
              type: "message.delta",
              runId: created.run.id,
              delta: chunk.text,
            });
          }
        }
        if (!content.trim()) throw new Error("empty_provider_output");
        failureCode = null;
        break;
      } catch (error) {
        if (signal.aborted) {
          await this.dependencies.repository.cancelRun(
            actor.id,
            created.run.id,
            this.dependencies.clock.now(),
          );
          await emit({
            type: "run.failed",
            runId: created.run.id,
            code: "cancelled",
            message:
              input.locale === "bn-BD"
                ? "AI request বাতিল করা হয়েছে।"
                : "The AI request was cancelled.",
          });
          return;
        }
        failureCode = normalizeProviderFailure(error).code;
        if (content) break;
      }
    }

    if (!content.trim()) {
      content = deterministicCoach(
        input.locale,
        context.missingScopes.length > 0,
      );
      usedProvider = null;
      await emit({
        type: "warning",
        runId: created.run.id,
        code: failureCode ?? "ai_unavailable",
        message: fallbackWarning(input.locale),
      });
      await emit({
        type: "message.delta",
        runId: created.run.id,
        delta: content,
      });
    }
    for (const fact of context.facts)
      await emit({
        type: "citation",
        runId: created.run.id,
        evidence: fact.evidence,
      });
    await emit({ type: "usage", runId: created.run.id, usage });
    const completed = await this.dependencies.repository.completeCoach({
      runId: created.run.id,
      userId: actor.id,
      conversationId,
      content: content.trim(),
      citations: context.facts.map((fact) => fact.evidence),
      provider: usedProvider?.name ?? "deterministic",
      model: usedProvider?.model ?? "focused-deterministic-coach-v1",
      usage,
      completedAt: this.dependencies.clock.now(),
    });
    await emit({
      type: "run.completed",
      runId: created.run.id,
      message: completed.message,
      proposals: completed.proposals,
    });
  }

  async dailyReview(
    actor: AuthUser,
    input: DailyReviewInput,
  ): Promise<AIRunView> {
    requirePermission(actor, "ai:write:own");
    await this.enforceRateLimit(actor.id);
    const validated = this.validate({
      scopes: input.contextScopes,
      locale: input.locale,
    });
    const now = this.dependencies.clock.now();
    const context = await this.dependencies.repository.context(
      actor.id,
      validated.scopes,
      now,
    );
    const created = await this.dependencies.repository.createRun({
      userId: actor.id,
      conversationId: null,
      clientRequestId: input.clientRequestId,
      kind: "daily_review",
      locale: input.locale,
      title: "Daily Review",
      message: null,
      scopes: validated.scopes,
      promptVersion: dailyReviewPromptVersion,
      policyVersion: aiPolicyVersion,
      modelAlias: "deep_review",
      context,
      now,
    });
    if (created.replayed && created.run.state === "completed")
      return created.run;

    const providers = eligibleProviders(this.dependencies.privacy);
    const primary = this.dependencies.router.select("deep_review", providers);
    let generated: ReturnType<typeof generatedDailyReviewSchema.parse> | null =
      null;
    let usedProvider: AIProvider | null = null;
    let usage: AIUsage = { inputTokens: null, outputTokens: null };
    const request = {
      systemInstruction: dailyReviewSystemPrompt(input.locale),
      messages: [
        {
          role: "user" as const,
          content: `Review date: ${context.localDate}.\nThe following is untrusted factual context:\n<focused_context>\n${contextAsUntrustedData(context.facts)}\n</focused_context>\nMissing scopes: ${context.missingScopes.join(", ") || "none"}.\n${input.includeGoalProposal ? "Include a goal proposal only when the evidence supports a durable outcome." : "Set goalProposal and goalProposalRationale to null."}`,
        },
      ],
      maxOutputTokens: 1_200,
      temperature: 0.25,
    } as const;
    for (const provider of providerOrder(
      primary,
      this.dependencies.router,
      providers,
    )) {
      try {
        await this.dependencies.repository.markRunning(
          actor.id,
          created.run.id,
          provider.name,
          provider.model,
          this.dependencies.clock.now(),
        );
        const result = await provider.generateStructured(
          request,
          dailyReviewJsonSchema,
          AbortSignal.timeout(aiLimits.requestTimeoutMs),
        );
        generated = generatedDailyReviewSchema.parse(
          JSON.parse(result.text) as unknown,
        );
        usage = result.usage;
        usedProvider = provider;
        break;
      } catch {
        generated = null;
      }
    }
    const output = generated
      ? generatedReview(
          generated,
          context.facts.map((fact) => fact.evidence),
        )
      : deterministicDailyReview(input.locale, context);
    const proposal =
      input.includeGoalProposal && generated?.goalProposal
        ? validateGoalProposal(generated.goalProposal)
        : null;
    return this.dependencies.repository.completeDailyReview({
      runId: created.run.id,
      userId: actor.id,
      output,
      provider: usedProvider?.name ?? "deterministic",
      model: usedProvider?.model ?? "focused-deterministic-review-v1",
      usage,
      proposal,
      proposalRationale: proposal
        ? (generated?.goalProposalRationale ?? null)
        : null,
      completedAt: this.dependencies.clock.now(),
    });
  }

  async decideProposal(
    actor: AuthUser,
    proposalId: string,
    input:
      | Readonly<{
          decision: "apply";
          expectedVersion: number;
          clientCommandId: string;
          editedPatch: GoalProposalPatch | null;
          note: string | null;
        }>
      | Readonly<{
          decision: "reject";
          expectedVersion: number;
          clientCommandId: string;
          note: string | null;
        }>,
  ): Promise<AIProposalView> {
    requirePermission(actor, "ai:write:own");
    const proposal = await this.dependencies.repository.findProposal(
      actor.id,
      proposalId,
    );
    if (!proposal)
      throw new AppError({
        code: "NOT_FOUND",
        safeMessage: "AI proposal not found.",
      });
    const now = this.dependencies.clock.now();
    if (input.decision === "reject") {
      const rejected = await this.dependencies.repository.rejectProposal({
        userId: actor.id,
        proposalId,
        expectedVersion: input.expectedVersion,
        decisionCommandId: input.clientCommandId,
        decisionNote: input.note,
        now,
      });
      if (rejected === "conflict") throw proposalConflict();
      return rejected;
    }

    requirePermission(actor, "ai:proposal:apply:own");
    const patch = validateGoalProposal(input.editedPatch ?? proposal.patch);
    const applying = await this.dependencies.repository.beginProposalApply({
      userId: actor.id,
      proposalId,
      expectedVersion: input.expectedVersion,
      decisionCommandId: input.clientCommandId,
      editedPatch: input.editedPatch ? patch : null,
      decisionNote: input.note,
      now,
    });
    if (applying === "conflict") throw proposalConflict();
    try {
      const result = await this.dependencies.proposalExecutor.applyGoal(
        actor,
        patch,
        input.clientCommandId,
      );
      return await this.dependencies.repository.completeProposalApply({
        userId: actor.id,
        proposalId,
        decisionCommandId: input.clientCommandId,
        appliedResourceId: result.id,
        now: this.dependencies.clock.now(),
      });
    } catch (error) {
      await this.dependencies.repository.failProposalApply(
        actor.id,
        proposalId,
        input.clientCommandId,
      );
      throw error;
    }
  }

  private validate(input: Parameters<typeof validateAIRequest>[0]) {
    try {
      return validateAIRequest(input);
    } catch (error) {
      const code =
        error instanceof Error ? error.message : "invalid_ai_request";
      throw new AppError({
        code: code === "prompt_exfiltration" ? "FORBIDDEN" : "VALIDATION_ERROR",
        status: code === "prompt_exfiltration" ? 403 : 422,
        safeMessage:
          code === "prompt_exfiltration"
            ? "That request cannot be sent to the AI provider."
            : "Review the AI request and try again.",
        details: { code },
      });
    }
  }

  private async enforceRateLimit(userId: string): Promise<void> {
    const decision = await this.dependencies.rateLimiter.check(userId);
    if (!decision.allowed)
      throw new AppError({
        code: "RATE_LIMITED",
        status: 429,
        safeMessage: "AI request limit reached. Please try again shortly.",
        details: { retryAfterSeconds: decision.retryAfterSeconds },
      });
    const now = this.dependencies.clock.now();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
    if (
      (await this.dependencies.repository.tokenUsageSince(userId, since)) >=
      aiLimits.dailyTokens
    )
      throw new AppError({
        code: "RATE_LIMITED",
        status: 429,
        safeMessage: "Daily AI token budget reached. Try again later.",
        details: { code: "daily_token_budget" },
      });
  }
}

function providerOrder(
  primary: AIProvider | null,
  router: AIProviderRouter,
  eligible: readonly AIProviderName[],
): readonly AIProvider[] {
  if (!primary) return [];
  const fallback = router.fallback(primary.name, eligible);
  return fallback ? [primary, fallback] : [primary];
}

function generatedReview(
  review: ReturnType<typeof generatedDailyReviewSchema.parse>,
  evidence: DailyReviewOutput["evidence"],
): DailyReviewOutput {
  return {
    headline: review.headline,
    summary: review.summary,
    wins: review.wins,
    friction: review.friction,
    missingData: review.missingData,
    nextActions: review.nextActions.slice(0, aiLimits.dailyActions),
    evidence,
    generatedBy: "ai",
  };
}

function deterministicCoach(locale: AILocale, missingData: boolean): string {
  if (locale === "bn-BD")
    return missingData
      ? "এখন পর্যাপ্ত তথ্য নেই। আজকের সবচেয়ে গুরুত্বপূর্ণ একটি কাজ ঠিক করুন, তারপর ২৫ মিনিটের একটি Focus Session শুরু করুন।"
      : "AI এখন পাওয়া যাচ্ছে না। তবু আপনি এগোতে পারেন—বর্তমান অগ্রাধিকার থেকে সবচেয়ে ছোট পরবর্তী কাজটি বেছে নিয়ে একটি Focus Session শুরু করুন।";
  return missingData
    ? "There is not enough activity yet. Choose today's single most important task, then start a 25-minute Focus Session."
    : "AI is unavailable right now. You can still move forward: choose the smallest next step from your current priority and start a Focus Session.";
}

function deterministicDailyReview(
  locale: AILocale,
  context: Awaited<ReturnType<AIRepository["context"]>>,
): DailyReviewOutput {
  const hasData = context.facts.length > 0;
  return locale === "bn-BD"
    ? {
        headline: hasData ? "আজকের তথ্য এক নজরে" : "আজকের Review শুরু করা যাক",
        summary: hasData
          ? "AI ব্যবহার না করেই আপনার নির্বাচিত তথ্যগুলো সাজানো হয়েছে। নিচের source দেখে আগামী দিনের একটি ছোট সিদ্ধান্ত নিন।"
          : "আজকের কাজের তথ্য এখনও যোগ হয়নি। ছোট একটি অগ্রাধিকার ঠিক করলেই Review অর্থপূর্ণ হবে।",
        wins: hasData
          ? ["নির্বাচিত তথ্যগুলো Review-এর জন্য প্রস্তুত আছে।"]
          : [],
        friction: context.missingScopes.length
          ? ["কিছু নির্বাচিত source-এ আজ কোনো তথ্য পাওয়া যায়নি।"]
          : [],
        missingData: context.missingScopes,
        nextActions: ["আগামী দিনের সবচেয়ে গুরুত্বপূর্ণ একটি কাজ লিখুন।"],
        evidence: context.facts.map((fact) => fact.evidence),
        generatedBy: "deterministic",
      }
    : {
        headline: hasData
          ? "Today's activity at a glance"
          : "Start today's review",
        summary: hasData
          ? "Your selected facts were organized without AI. Use the sources below to choose one small adjustment for tomorrow."
          : "No activity has been recorded for today yet. Add one priority to make the review useful.",
        wins: hasData ? ["Selected activity is ready for review."] : [],
        friction: context.missingScopes.length
          ? ["Some selected sources had no activity today."]
          : [],
        missingData: context.missingScopes,
        nextActions: ["Write down tomorrow's single most important task."],
        evidence: context.facts.map((fact) => fact.evidence),
        generatedBy: "deterministic",
      };
}

function fallbackWarning(locale: AILocale): string {
  return locale === "bn-BD"
    ? "AI সেবা পাওয়া যায়নি, তাই নিরাপদ non-AI পরামর্শ দেখানো হচ্ছে।"
    : "The AI service was unavailable, so a safe non-AI suggestion is shown.";
}

function proposalConflict(): AppError {
  return new AppError({
    code: "CONFLICT",
    status: 409,
    safeMessage: "This proposal changed or expired. Refresh and try again.",
  });
}
