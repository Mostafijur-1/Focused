import { z } from "zod";

const localeSchema = z.enum(["bn-BD", "en"]);
const contextScopeSchema = z.enum([
  "daily_plan",
  "focus_summary",
  "habit_summary",
  "goal_summary",
]);
const scopesSchema = z.array(contextScopeSchema).max(4).default([]);

export const coachMessageSchema = z
  .object({
    conversationId: z.uuid().nullable().default(null),
    clientRequestId: z.uuid(),
    locale: localeSchema,
    message: z.string().trim().min(1).max(2_000),
    contextScopes: scopesSchema,
  })
  .strict();

export const dailyReviewRequestSchema = z
  .object({
    clientRequestId: z.uuid(),
    locale: localeSchema,
    contextScopes: scopesSchema,
    includeGoalProposal: z.boolean().default(false),
  })
  .strict();

export const goalProposalPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2_000).nullable().default(null),
    horizon: z.enum(["month", "quarter", "year"]),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    successMeasure: z.string().trim().max(500).nullable().default(null),
    targetDate: z.iso.date().nullable().default(null),
  })
  .strict();

export const proposalDecisionSchema = z.discriminatedUnion("decision", [
  z
    .object({
      decision: z.literal("apply"),
      expectedVersion: z.number().int().positive(),
      clientCommandId: z.uuid(),
      editedPatch: goalProposalPatchSchema.nullable().default(null),
      note: z.string().trim().max(500).nullable().default(null),
    })
    .strict(),
  z
    .object({
      decision: z.literal("reject"),
      expectedVersion: z.number().int().positive(),
      clientCommandId: z.uuid(),
      note: z.string().trim().max(500).nullable().default(null),
    })
    .strict(),
]);

export const generatedDailyReviewSchema = z
  .object({
    headline: z.string().trim().min(1).max(160),
    summary: z.string().trim().min(1).max(1_200),
    wins: z.array(z.string().trim().min(1).max(240)).max(3),
    friction: z.array(z.string().trim().min(1).max(240)).max(3),
    missingData: z.array(z.string().trim().min(1).max(160)).max(4),
    nextActions: z.array(z.string().trim().min(1).max(240)).max(3),
    goalProposal: goalProposalPatchSchema.nullable(),
    goalProposalRationale: z.string().trim().max(500).nullable(),
  })
  .strict();

export const dailyReviewJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "summary",
    "wins",
    "friction",
    "missingData",
    "nextActions",
    "goalProposal",
    "goalProposalRationale",
  ],
  properties: {
    headline: { type: "string", maxLength: 160 },
    summary: { type: "string", maxLength: 1200 },
    wins: {
      type: "array",
      maxItems: 3,
      items: { type: "string", maxLength: 240 },
    },
    friction: {
      type: "array",
      maxItems: 3,
      items: { type: "string", maxLength: 240 },
    },
    missingData: {
      type: "array",
      maxItems: 4,
      items: { type: "string", maxLength: 160 },
    },
    nextActions: {
      type: "array",
      maxItems: 3,
      items: { type: "string", maxLength: 240 },
    },
    goalProposal: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: [
            "title",
            "description",
            "horizon",
            "priority",
            "successMeasure",
            "targetDate",
          ],
          properties: {
            title: { type: "string", maxLength: 200 },
            description: { type: ["string", "null"], maxLength: 2000 },
            horizon: { type: "string", enum: ["month", "quarter", "year"] },
            priority: { type: "integer", minimum: 1, maximum: 3 },
            successMeasure: { type: ["string", "null"], maxLength: 500 },
            targetDate: { type: ["string", "null"] },
          },
        },
        { type: "null" },
      ],
    },
    goalProposalRationale: { type: ["string", "null"], maxLength: 500 },
  },
} as const;

const evidenceSchema = z
  .object({
    scope: contextScopeSchema,
    label: z.string(),
    observedAt: z.iso.datetime(),
    sourceVersion: z.string(),
  })
  .strict();
const messageViewSchema = z
  .object({
    id: z.uuid(),
    role: z.enum(["user", "assistant"]),
    content: z.string(),
    citations: z.array(evidenceSchema),
    model: z.string().nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict();
const proposalViewSchema = z
  .object({
    id: z.uuid(),
    runId: z.uuid(),
    targetType: z.literal("goal"),
    operation: z.literal("create"),
    patch: goalProposalPatchSchema,
    editedPatch: goalProposalPatchSchema.nullable(),
    rationale: z.string(),
    status: z.enum([
      "pending",
      "applying",
      "accepted",
      "apply_failed",
      "rejected",
      "expired",
      "superseded",
    ]),
    expiresAt: z.iso.datetime(),
    appliedResourceId: z.uuid().nullable(),
    version: z.number().int().positive(),
  })
  .strict();
const reviewOutputSchema = z
  .object({
    headline: z.string(),
    summary: z.string(),
    wins: z.array(z.string()),
    friction: z.array(z.string()),
    missingData: z.array(z.string()),
    nextActions: z.array(z.string()).max(3),
    evidence: z.array(evidenceSchema),
    generatedBy: z.enum(["ai", "deterministic"]),
  })
  .strict();
const runViewSchema = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid().nullable(),
    kind: z.enum(["coach", "daily_review"]),
    state: z.enum([
      "queued",
      "running",
      "completed",
      "failed",
      "cancelled",
      "expired",
    ]),
    locale: localeSchema,
    provider: z.enum(["groq", "gemini", "deterministic"]).nullable(),
    model: z.string().nullable(),
    promptVersion: z.string(),
    policyVersion: z.string(),
    scopes: z.array(contextScopeSchema),
    output: reviewOutputSchema.nullable(),
    usage: z
      .object({
        inputTokens: z.number().int().nullable(),
        outputTokens: z.number().int().nullable(),
      })
      .strict(),
    failureCode: z.string().nullable(),
    queuedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    proposals: z.array(proposalViewSchema),
  })
  .strict();

export const aiOverviewResponseSchema = z
  .object({
    data: z
      .object({
        available: z.boolean(),
        unavailableReason: z
          .enum(["not_configured", "privacy_policy"])
          .nullable(),
        conversations: z.array(
          z
            .object({
              id: z.uuid(),
              title: z.string(),
              updatedAt: z.iso.datetime(),
              messages: z.array(messageViewSchema),
            })
            .strict(),
        ),
        latestDailyReview: runViewSchema.nullable(),
        pendingProposals: z.array(proposalViewSchema),
        allowedScopes: z.array(contextScopeSchema),
      })
      .strict(),
  })
  .strict();
export const aiRunResponseSchema = z.object({ data: runViewSchema }).strict();
export const aiProposalResponseSchema = z
  .object({ data: proposalViewSchema })
  .strict();
export const aiStreamEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("run.started"),
      runId: z.uuid(),
      conversationId: z.uuid(),
    })
    .strict(),
  z
    .object({
      type: z.literal("message.delta"),
      runId: z.uuid(),
      delta: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal("citation"),
      runId: z.uuid(),
      evidence: evidenceSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("usage"),
      runId: z.uuid(),
      usage: z
        .object({
          inputTokens: z.number().int().nullable(),
          outputTokens: z.number().int().nullable(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("warning"),
      runId: z.uuid(),
      code: z.string(),
      message: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal("run.completed"),
      runId: z.uuid(),
      message: messageViewSchema,
      proposals: z.array(proposalViewSchema),
    })
    .strict(),
  z
    .object({
      type: z.literal("run.failed"),
      runId: z.string(),
      code: z.string(),
      message: z.string(),
    })
    .strict(),
]);
