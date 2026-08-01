import { z } from "zod";

export const goalStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "achieved",
  "abandoned",
  "archived",
]);
const progressModeSchema = z.enum(["manual", "milestones", "key_results"]);
const nullableText = (maximum: number) =>
  z.string().trim().max(maximum).nullable().default(null);

export const goalDraftSchema = z
  .object({
    parentGoalId: z.uuid().nullable().default(null),
    title: z.string().trim().min(1).max(200),
    description: nullableText(10_000),
    horizon: z.string().trim().min(1).max(30),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    progressMode: progressModeSchema,
    manualProgress: z.number().min(0).max(100),
    successMeasure: nullableText(2_000),
    targetValue: z
      .number()
      .positive()
      .max(1_000_000_000_000)
      .nullable()
      .default(null),
    targetUnit: nullableText(40),
    targetDate: z.iso.date().nullable().default(null),
  })
  .strict()
  .refine(
    (value) => (value.targetValue === null) === (value.targetUnit === null),
    {
      path: ["targetValue"],
      message: "Target value and unit must be supplied together.",
    },
  );

export const createGoalSchema = goalDraftSchema.extend({
  clientCommandId: z.uuid(),
});
export const updateGoalSchema = goalDraftSchema.extend({
  expectedVersion: z.number().int().positive(),
});
export const transitionGoalSchema = z
  .object({
    toStatus: goalStatusSchema,
    reason: nullableText(500),
    confirmCompletion: z.boolean().default(false),
    clientCommandId: z.uuid(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();
export const checkInGoalSchema = z
  .object({
    progress: z.number().min(0).max(100).nullable().default(null),
    value: z.number().min(0).max(1_000_000_000_000).nullable().default(null),
    note: nullableText(1_000),
    evidenceRef: z.uuid().nullable().default(null),
    clientCommandId: z.uuid(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();
export const addMilestoneSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    dueDate: z.iso.date().nullable().default(null),
    weight: z.number().positive().max(1_000),
    clientCommandId: z.uuid(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();
export const updateMilestoneSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    dueDate: z.iso.date().nullable().default(null),
    status: z.enum([
      "planned",
      "in_progress",
      "completed",
      "deferred",
      "cancelled",
    ]),
    weight: z.number().positive().max(1_000),
    expectedVersion: z.number().int().positive(),
    expectedGoalVersion: z.number().int().positive(),
  })
  .strict();
export const addKeyResultSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    targetValue: z.number().positive(),
    currentValue: z.number().nonnegative(),
    unit: z.string().trim().min(1).max(40),
    weight: z.number().positive().max(1_000),
    clientCommandId: z.uuid(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();
export const updateKeyResultSchema = addKeyResultSchema
  .omit({ clientCommandId: true, expectedVersion: true })
  .extend({
    expectedVersion: z.number().int().positive(),
    expectedGoalVersion: z.number().int().positive(),
  })
  .strict();
export const linkGoalSchema = z
  .object({
    type: z.enum([
      "vision_area",
      "plan_item",
      "habit",
      "learning_item",
      "focus_session",
    ]),
    resourceId: z.uuid(),
    label: nullableText(160),
    expectedVersion: z.number().int().positive(),
  })
  .strict();
export const unlinkGoalSchema = z
  .object({ expectedVersion: z.coerce.number().int().positive() })
  .strict();

const visionAreaSchema = z
  .object({
    key: z.string().trim().min(1).max(60),
    title: z.string().trim().min(1).max(100),
    statement: nullableText(2_000),
  })
  .strict();
export const saveLifeVisionSchema = z
  .object({
    narrative: nullableText(10_000),
    values: z.array(z.string().trim().min(1).max(100)).max(20),
    antiGoals: z.array(z.string().trim().min(1).max(160)).max(20),
    areas: z.array(visionAreaSchema).max(12),
    clientCommandId: z.uuid(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export const publishLifeVisionSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    clientCommandId: z.uuid(),
  })
  .strict();

const fixedCommitmentSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    minutes: z.number().int().nonnegative().max(10_080),
  })
  .strict();
const weeklyOutcomeSchema = z
  .object({
    goalId: z.uuid().nullable().default(null),
    title: z.string().trim().min(1).max(240),
    estimateMinutes: z.number().int().nonnegative().max(10_080),
  })
  .strict();
export const saveWeeklyPlanSchema = z
  .object({
    weekStart: z.iso.date(),
    theme: nullableText(160),
    capacityMinutes: z.number().int().nonnegative().max(10_080),
    fixedCommitments: z.array(fixedCommitmentSchema).max(30),
    notDoing: z.array(z.string().trim().min(1).max(160)).max(30),
    reflection: nullableText(2_000),
    outcomes: z.array(weeklyOutcomeSchema).max(12),
    clientCommandId: z.uuid(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export const transitionWeeklyPlanSchema = z
  .object({
    toStatus: z.enum(["active", "closed"]),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

const milestoneViewSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    dueDate: z.iso.date().nullable(),
    status: z.enum([
      "planned",
      "in_progress",
      "completed",
      "deferred",
      "cancelled",
    ]),
    weight: z.number(),
    position: z.number().int(),
    version: z.number().int().positive(),
  })
  .strict();
const keyResultViewSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    targetValue: z.number(),
    currentValue: z.number(),
    unit: z.string(),
    weight: z.number(),
    position: z.number().int(),
    version: z.number().int().positive(),
  })
  .strict();
const goalViewSchema = z
  .object({
    id: z.uuid(),
    parentGoalId: z.uuid().nullable(),
    title: z.string(),
    description: z.string().nullable(),
    status: goalStatusSchema,
    horizon: z.string(),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    position: z.number().int(),
    progressMode: progressModeSchema,
    progress: z.number().min(0).max(100),
    successMeasure: z.string().nullable(),
    targetValue: z.number().nullable(),
    targetUnit: z.string().nullable(),
    targetDate: z.iso.date().nullable(),
    overdue: z.boolean(),
    archived: z.boolean(),
    version: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    milestones: z.array(milestoneViewSchema),
    keyResults: z.array(keyResultViewSchema),
    links: z.array(
      z
        .object({
          id: z.uuid(),
          type: z.enum([
            "vision_area",
            "plan_item",
            "habit",
            "learning_item",
            "focus_session",
          ]),
          resourceId: z.uuid(),
          label: z.string().nullable(),
        })
        .strict(),
    ),
    recentCheckIns: z.array(
      z
        .object({
          id: z.uuid(),
          progress: z.number(),
          value: z.number().nullable(),
          note: z.string().nullable(),
          evidenceRef: z.uuid().nullable(),
          recordedAt: z.iso.datetime(),
        })
        .strict(),
    ),
  })
  .strict();
export const goalResponseSchema = z.object({ data: goalViewSchema }).strict();
export const goalListResponseSchema = z
  .object({
    data: z
      .object({
        data: z.array(goalViewSchema),
        nextCursor: z.uuid().nullable(),
        total: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

const lifeVisionViewSchema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().positive(),
    status: z.enum(["draft", "published", "archived"]),
    narrative: z.string().nullable(),
    values: z.array(z.string()),
    antiGoals: z.array(z.string()),
    areas: z.array(
      z
        .object({
          id: z.uuid(),
          key: z.string(),
          title: z.string(),
          statement: z.string().nullable(),
          position: z.number().int(),
        })
        .strict(),
    ),
    publishedAt: z.iso.datetime().nullable(),
    version: z.number().int().positive(),
  })
  .strict();
export const lifeVisionResponseSchema = z
  .object({ data: lifeVisionViewSchema.nullable() })
  .strict();
export const lifeVisionMutationResponseSchema = z
  .object({ data: lifeVisionViewSchema })
  .strict();

const weeklyPlanViewSchema = z
  .object({
    id: z.uuid(),
    weekStart: z.iso.date(),
    weekEnd: z.iso.date(),
    timeZone: z.string(),
    status: z.enum(["draft", "active", "closed", "archived"]),
    theme: z.string().nullable(),
    capacityMinutes: z.number().int(),
    committedMinutes: z.number().int(),
    warning: z.literal("over_capacity").nullable(),
    fixedCommitments: z.array(fixedCommitmentSchema),
    outcomes: z.array(
      z
        .object({
          id: z.uuid(),
          goalId: z.uuid().nullable(),
          title: z.string(),
          estimateMinutes: z.number().int(),
          status: z.enum([
            "planned",
            "in_progress",
            "completed",
            "deferred",
            "cancelled",
          ]),
          position: z.number().int(),
        })
        .strict(),
    ),
    notDoing: z.array(z.string()),
    reflection: z.string().nullable(),
    version: z.number().int().positive(),
  })
  .strict();
export const weeklyPlanResponseSchema = z
  .object({ data: weeklyPlanViewSchema.nullable() })
  .strict();
export const weeklyPlanMutationResponseSchema = z
  .object({ data: weeklyPlanViewSchema })
  .strict();
