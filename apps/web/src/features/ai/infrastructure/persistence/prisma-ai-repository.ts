import "server-only";

import type { FocusedPrismaClient } from "@focused/database";
import { Prisma } from "@focused/database/generated/client";

import type {
  AIRepository,
  CompleteCoachCommand,
  CompleteDailyReviewCommand,
  CreateAIRunCommand,
  CreatedAIRun,
} from "@/features/ai/application/ports";
import type {
  AIContextScope,
  AIContextSnapshot,
  AIEvidence,
  AIMessageView,
  AIOverview,
  AIProposalView,
  AIRunView,
  DailyReviewOutput,
  GoalProposalPatch,
} from "@/features/ai/domain/ai-types";
import { aiLimits } from "@/features/ai/domain/ai-policy";
import {
  localDateAt,
  utcDayRange,
} from "@/features/dashboard/domain/dashboard-time";

export class PrismaAIRepository implements AIRepository {
  constructor(private readonly prisma: FocusedPrismaClient) {}

  async overview(userId: string): Promise<AIOverview> {
    const [conversations, latestReview, proposals] = await Promise.all([
      this.prisma.aIConversation.findMany({
        where: { userId, archivedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          messages: { orderBy: { createdAt: "asc" }, take: 40 },
        },
      }),
      this.prisma.aIRun.findFirst({
        where: { userId, kind: "DAILY_REVIEW" },
        orderBy: { queuedAt: "desc" },
        include: { contextGrants: true, proposals: true },
      }),
      this.prisma.aIProposal.findMany({
        where: {
          userId,
          status: { in: ["PENDING", "APPLYING", "APPLY_FAILED"] },
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
    return {
      available: false,
      unavailableReason: "not_configured",
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title ?? "AI Coach",
        updatedAt: conversation.updatedAt.toISOString(),
        messages: conversation.messages.map(messageView),
      })),
      latestDailyReview: latestReview ? runView(latestReview) : null,
      pendingProposals: proposals.map(proposalView),
      allowedScopes: [
        "daily_plan",
        "focus_summary",
        "habit_summary",
        "goal_summary",
      ],
    };
  }

  async tokenUsageSince(userId: string, since: Date): Promise<number> {
    const usage = await this.prisma.aIRun.aggregate({
      where: { userId, queuedAt: { gte: since } },
      _sum: { inputTokens: true, outputTokens: true },
    });
    return (usage._sum.inputTokens ?? 0) + (usage._sum.outputTokens ?? 0);
  }

  async context(
    userId: string,
    scopes: readonly AIContextScope[],
    now: Date,
  ): Promise<AIContextSnapshot> {
    const profile = await this.prisma.userProfile.findUniqueOrThrow({
      where: { userId },
      select: { timeZone: true },
    });
    const localDate = localDateAt(now, profile.timeZone);
    const date = databaseDate(localDate);
    const range = utcDayRange(localDate, profile.timeZone);
    const facts: Array<{
      scope: AIContextScope;
      summary: string;
      evidence: AIEvidence;
    }> = [];
    const missingScopes: AIContextScope[] = [];

    await Promise.all(
      scopes.map(async (scope) => {
        const fact = await this.scopeFact(
          userId,
          scope,
          date,
          range,
          localDate,
        );
        if (fact) facts.push(fact);
        else missingScopes.push(scope);
      }),
    );
    facts.sort(
      (left, right) => scopes.indexOf(left.scope) - scopes.indexOf(right.scope),
    );
    missingScopes.sort(
      (left, right) => scopes.indexOf(left) - scopes.indexOf(right),
    );
    return {
      localDate,
      timeZone: profile.timeZone,
      facts,
      missingScopes,
    };
  }

  async createRun(command: CreateAIRunCommand): Promise<CreatedAIRun> {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.aIRun.findUnique({
        where: {
          userId_clientRequestId: {
            userId: command.userId,
            clientRequestId: command.clientRequestId,
          },
        },
        include: { contextGrants: true, proposals: true },
      });
      if (existing) {
        const messages = existing.conversationId
          ? await transaction.aIMessage.findMany({
              where: { conversationId: existing.conversationId },
              orderBy: { createdAt: "asc" },
              take: 40,
            })
          : [];
        return {
          run: runView(existing),
          conversationId: existing.conversationId,
          replayed: true,
          messages: messages.map(messageView),
        };
      }

      let conversationId = command.conversationId;
      if (command.kind === "coach") {
        if (conversationId) {
          const owned = await transaction.aIConversation.findFirst({
            where: {
              id: conversationId,
              userId: command.userId,
              archivedAt: null,
            },
            select: { id: true },
          });
          if (!owned) throw new Error("conversation_not_found");
        } else {
          const created = await transaction.aIConversation.create({
            data: {
              userId: command.userId,
              purpose: "coach",
              title: command.title,
            },
            select: { id: true },
          });
          conversationId = created.id;
        }
      }

      const run = await transaction.aIRun.create({
        data: {
          userId: command.userId,
          conversationId,
          clientRequestId: command.clientRequestId,
          kind: command.kind === "coach" ? "COACH" : "DAILY_REVIEW",
          status: "QUEUED",
          locale: command.locale,
          promptVersion: command.promptVersion,
          policyVersion: command.policyVersion,
          modelAlias: command.modelAlias,
          inputManifest: {
            localDate: command.context.localDate,
            timeZone: command.context.timeZone,
            scopes: command.scopes,
            evidence: command.context.facts.map((fact) => fact.evidence),
            missingScopes: command.context.missingScopes,
          } as unknown as Prisma.InputJsonValue,
          contextGrants: {
            create: command.scopes.map((scope) => ({
              userId: command.userId,
              sourceType: scope,
              scope: {
                aggregation: "daily_summary",
                localDate: command.context.localDate,
              },
              sourceVersion:
                command.context.facts.find((fact) => fact.scope === scope)
                  ?.evidence.sourceVersion ?? null,
              expiresAt: new Date(command.now.getTime() + 30 * 60 * 1_000),
            })),
          },
        },
        include: { contextGrants: true, proposals: true },
      });
      if (command.message && conversationId) {
        await transaction.aIMessage.create({
          data: {
            conversationId,
            aiRunId: run.id,
            role: "user",
            content: command.message,
          },
        });
        await transaction.aIConversation.update({
          where: { id: conversationId },
          data: { updatedAt: command.now, version: { increment: 1 } },
        });
      }
      const messages = conversationId
        ? await transaction.aIMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: "asc" },
            take: 40,
          })
        : [];
      return {
        run: runView(run),
        conversationId,
        replayed: false,
        messages: messages.map(messageView),
      };
    });
  }

  async history(
    userId: string,
    conversationId: string,
    limit: number,
  ): Promise<readonly AIMessageView[]> {
    const conversation = await this.prisma.aIConversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });
    if (!conversation) return [];
    const messages = await this.prisma.aIMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return messages.reverse().map(messageView);
  }

  async markRunning(
    userId: string,
    runId: string,
    provider: "groq" | "gemini",
    model: string,
    startedAt: Date,
  ): Promise<void> {
    await this.prisma.aIRun.updateMany({
      where: { id: runId, userId, status: { in: ["QUEUED", "RUNNING"] } },
      data: {
        status: "RUNNING",
        provider,
        model,
        startedAt,
      },
    });
  }

  async completeCoach(command: CompleteCoachCommand) {
    return this.prisma.$transaction(async (transaction) => {
      const message = await transaction.aIMessage.create({
        data: {
          conversationId: command.conversationId,
          aiRunId: command.runId,
          role: "assistant",
          content: command.content,
          citations: command.citations as unknown as Prisma.InputJsonValue,
          model: command.model,
          createdAt: command.completedAt,
        },
      });
      await transaction.aIRun.updateMany({
        where: { id: command.runId, userId: command.userId },
        data: {
          status: "COMPLETED",
          provider: command.provider,
          model: command.model,
          output: { messageId: message.id } as Prisma.InputJsonValue,
          inputTokens: command.usage.inputTokens,
          outputTokens: command.usage.outputTokens,
          completedAt: command.completedAt,
        },
      });
      await transaction.aIConversation.update({
        where: { id: command.conversationId },
        data: { updatedAt: command.completedAt, version: { increment: 1 } },
      });
      return { message: messageView(message), proposals: [] };
    });
  }

  async completeDailyReview(
    command: CompleteDailyReviewCommand,
  ): Promise<AIRunView> {
    return this.prisma.$transaction(async (transaction) => {
      if (command.proposal) {
        await transaction.aIProposal.create({
          data: {
            userId: command.userId,
            aiRunId: command.runId,
            targetType: "goal",
            operation: "create",
            patch: command.proposal as unknown as Prisma.InputJsonValue,
            rationale: command.proposalRationale,
            expiresAt: new Date(
              command.completedAt.getTime() + aiLimits.proposalLifetimeMs,
            ),
          },
        });
      }
      return runView(
        await transaction.aIRun.update({
          where: { id: command.runId },
          data: {
            status: "COMPLETED",
            provider: command.provider,
            model: command.model,
            output: command.output as unknown as Prisma.InputJsonValue,
            inputTokens: command.usage.inputTokens,
            outputTokens: command.usage.outputTokens,
            completedAt: command.completedAt,
          },
          include: { contextGrants: true, proposals: true },
        }),
      );
    });
  }

  async failRun(
    userId: string,
    runId: string,
    failureCode: string,
    completedAt: Date,
  ): Promise<void> {
    await this.prisma.aIRun.updateMany({
      where: { id: runId, userId, status: { in: ["QUEUED", "RUNNING"] } },
      data: { status: "FAILED", failureCode, completedAt },
    });
  }

  async cancelRun(
    userId: string,
    runId: string,
    cancelledAt: Date,
  ): Promise<void> {
    await this.prisma.aIRun.updateMany({
      where: {
        id: runId,
        userId,
        status: { in: ["QUEUED", "RUNNING"] },
      },
      data: {
        status: "CANCELLED",
        failureCode: "cancelled",
        completedAt: cancelledAt,
      },
    });
  }

  async findProposal(userId: string, proposalId: string) {
    const proposal = await this.prisma.aIProposal.findFirst({
      where: { id: proposalId, userId },
    });
    return proposal ? proposalView(proposal) : null;
  }

  async beginProposalApply(command: {
    userId: string;
    proposalId: string;
    expectedVersion: number;
    decisionCommandId: string;
    editedPatch: GoalProposalPatch | null;
    decisionNote: string | null;
    now: Date;
  }) {
    const result = await this.prisma.aIProposal.updateMany({
      where: {
        id: command.proposalId,
        userId: command.userId,
        status: { in: ["PENDING", "APPLY_FAILED"] },
        version: command.expectedVersion,
        expiresAt: { gt: command.now },
      },
      data: {
        status: "APPLYING",
        editedPatch: command.editedPatch
          ? (command.editedPatch as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        decisionNote: command.decisionNote,
        decisionCommandId: command.decisionCommandId,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) return "conflict" as const;
    return (await this.findProposal(command.userId, command.proposalId))!;
  }

  async completeProposalApply(command: {
    userId: string;
    proposalId: string;
    decisionCommandId: string;
    appliedResourceId: string;
    now: Date;
  }): Promise<AIProposalView> {
    await this.prisma.aIProposal.updateMany({
      where: {
        id: command.proposalId,
        userId: command.userId,
        status: "APPLYING",
        decisionCommandId: command.decisionCommandId,
      },
      data: {
        status: "ACCEPTED",
        appliedResourceId: command.appliedResourceId,
        decidedAt: command.now,
        version: { increment: 1 },
      },
    });
    return (await this.findProposal(command.userId, command.proposalId))!;
  }

  async failProposalApply(
    userId: string,
    proposalId: string,
    decisionCommandId: string,
  ): Promise<void> {
    await this.prisma.aIProposal.updateMany({
      where: { id: proposalId, userId, status: "APPLYING", decisionCommandId },
      data: { status: "APPLY_FAILED", version: { increment: 1 } },
    });
  }

  async rejectProposal(command: {
    userId: string;
    proposalId: string;
    expectedVersion: number;
    decisionCommandId: string;
    decisionNote: string | null;
    now: Date;
  }) {
    const result = await this.prisma.aIProposal.updateMany({
      where: {
        id: command.proposalId,
        userId: command.userId,
        status: "PENDING",
        version: command.expectedVersion,
        expiresAt: { gt: command.now },
      },
      data: {
        status: "REJECTED",
        decisionCommandId: command.decisionCommandId,
        decisionNote: command.decisionNote,
        decidedAt: command.now,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) return "conflict" as const;
    return (await this.findProposal(command.userId, command.proposalId))!;
  }

  private async scopeFact(
    userId: string,
    scope: AIContextScope,
    date: Date,
    range: Readonly<{ start: Date; end: Date }>,
    localDate: string,
  ) {
    const observedAt = range.end.toISOString();
    if (scope === "daily_plan") {
      const plan = await this.prisma.plan.findUnique({
        where: {
          userId_type_periodStart: { userId, type: "DAILY", periodStart: date },
        },
        include: { items: { orderBy: { position: "asc" }, take: 12 } },
      });
      if (!plan) return null;
      const completed = plan.items.filter(
        (item) => item.status === "COMPLETED",
      ).length;
      return fact(
        scope,
        `Daily plan: ${completed} of ${plan.items.length} items completed. Priorities: ${
          plan.items
            .filter((item) => item.isPrimary)
            .map((item) => item.title)
            .join(", ") || "none"
        }.`,
        observedAt,
        `plan:${plan.id}:v${plan.version}`,
      );
    }
    if (scope === "focus_summary") {
      const sessions = await this.prisma.focusSession.findMany({
        where: { userId, startedAt: { gte: range.start, lt: range.end } },
        select: {
          id: true,
          status: true,
          completedFocusSeconds: true,
          intent: true,
          version: true,
          interruptions: { select: { id: true } },
        },
        take: 50,
      });
      if (sessions.length === 0) return null;
      const completed = sessions.filter(
        (session) => session.status === "COMPLETED",
      );
      const minutes = Math.round(
        completed.reduce(
          (total, session) => total + (session.completedFocusSeconds ?? 0),
          0,
        ) / 60,
      );
      const interruptions = sessions.reduce(
        (total, session) => total + session.interruptions.length,
        0,
      );
      return fact(
        scope,
        `Focus: ${completed.length} completed sessions, ${minutes} focused minutes, ${interruptions} recorded interruptions. Intentions: ${sessions
          .slice(0, 5)
          .map((session) => session.intent)
          .join(", ")}.`,
        observedAt,
        `focus:${localDate}:${sessions.map((session) => `${session.id}:v${session.version}`).join("|")}`,
      );
    }
    if (scope === "habit_summary") {
      const occurrences = await this.prisma.habitOccurrence.findMany({
        where: { localDate: date, habit: { userId, archivedAt: null } },
        include: { habit: { select: { title: true } } },
        take: 50,
      });
      if (occurrences.length === 0) return null;
      const completed = occurrences.filter(
        (item) => item.status === "COMPLETED",
      );
      return fact(
        scope,
        `Habits: ${completed.length} of ${occurrences.length} due habits completed. Completed: ${completed.map((item) => item.habit.title).join(", ") || "none"}.`,
        observedAt,
        `habits:${localDate}:${occurrences.map((item) => `${item.id}:v${item.version}`).join("|")}`,
      );
    }
    const goals = await this.prisma.goal.findMany({
      where: {
        userId,
        status: { in: ["DRAFT", "ACTIVE", "PAUSED"] },
        archivedAt: null,
        deletedAt: null,
      },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
        manualProgress: true,
        version: true,
      },
      take: 8,
    });
    if (goals.length === 0) return null;
    return fact(
      scope,
      `Open goals: ${goals.map((goal) => `${goal.title} (${goal.status.toLowerCase()}, ${Number(goal.manualProgress)}%)`).join("; ")}.`,
      observedAt,
      `goals:${goals.map((goal) => `${goal.id}:v${goal.version}`).join("|")}`,
    );
  }
}

function fact(
  scope: AIContextScope,
  summary: string,
  observedAt: string,
  sourceVersion: string,
) {
  return {
    scope,
    summary,
    evidence: { scope, label: scope, observedAt, sourceVersion },
  } as const;
}

function messageView(message: {
  id: string;
  role: string;
  content: string;
  citations: unknown;
  model: string | null;
  createdAt: Date;
}): AIMessageView {
  return {
    id: message.id,
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content,
    citations: evidenceArray(message.citations),
    model: message.model,
    createdAt: message.createdAt.toISOString(),
  };
}

function proposalView(proposal: {
  id: string;
  aiRunId: string;
  targetType: string;
  operation: string;
  patch: unknown;
  editedPatch: unknown;
  rationale: string | null;
  status: string;
  expiresAt: Date;
  appliedResourceId: string | null;
  version: number;
}): AIProposalView {
  return {
    id: proposal.id,
    runId: proposal.aiRunId,
    targetType: "goal",
    operation: "create",
    patch: proposal.patch as GoalProposalPatch,
    editedPatch: (proposal.editedPatch as GoalProposalPatch | null) ?? null,
    rationale: proposal.rationale ?? "",
    status: proposal.status.toLowerCase() as AIProposalView["status"],
    expiresAt: proposal.expiresAt.toISOString(),
    appliedResourceId: proposal.appliedResourceId,
    version: proposal.version,
  };
}

function runView(run: {
  id: string;
  conversationId: string | null;
  kind: string;
  status: string;
  locale: string;
  provider: string | null;
  model: string | null;
  promptVersion: string;
  policyVersion: string;
  inputManifest: unknown;
  output: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
  failureCode: string | null;
  queuedAt: Date;
  completedAt: Date | null;
  proposals?: readonly Parameters<typeof proposalView>[0][];
}): AIRunView {
  const manifest = objectRecord(run.inputManifest);
  const scopes = Array.isArray(manifest.scopes)
    ? manifest.scopes.filter(isScope)
    : [];
  return {
    id: run.id,
    conversationId: run.conversationId,
    kind: run.kind === "COACH" ? "coach" : "daily_review",
    state: run.status.toLowerCase() as AIRunView["state"],
    locale: run.locale === "en" ? "en" : "bn-BD",
    provider:
      run.provider === "groq" ||
      run.provider === "gemini" ||
      run.provider === "deterministic"
        ? run.provider
        : null,
    model: run.model,
    promptVersion: run.promptVersion,
    policyVersion: run.policyVersion,
    scopes,
    output: isDailyReview(run.output) ? run.output : null,
    usage: { inputTokens: run.inputTokens, outputTokens: run.outputTokens },
    failureCode: run.failureCode,
    queuedAt: run.queuedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    proposals: (run.proposals ?? []).map(proposalView),
  };
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function evidenceArray(value: unknown): readonly AIEvidence[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is AIEvidence =>
          Boolean(item) &&
          typeof item === "object" &&
          isScope((item as Record<string, unknown>).scope),
      )
    : [];
}

function isScope(value: unknown): value is AIContextScope {
  return [
    "daily_plan",
    "focus_summary",
    "habit_summary",
    "goal_summary",
  ].includes(String(value));
}

function isDailyReview(value: unknown): value is DailyReviewOutput {
  const record = objectRecord(value);
  return (
    typeof record.headline === "string" && typeof record.summary === "string"
  );
}

function databaseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
