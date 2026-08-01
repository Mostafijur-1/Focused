import { z } from "zod";

const countMapSchema = z.record(
  z.string().min(1).max(80),
  z.number().int().nonnegative(),
);

const dailyValuesSchema = z.object({
  focusedSeconds: z.number().int().nonnegative(),
  plannedSeconds: z.number().int().nonnegative(),
  completedSessions: z.number().int().nonnegative(),
  abandonedSessions: z.number().int().nonnegative(),
  outcomesCaptured: z.number().int().nonnegative(),
  interruptionCount: z.number().int().nonnegative(),
  interruptionsByCategory: countMapSchema,
  interruptionsByHour: countMapSchema,
  habitDue: z.number().int().nonnegative(),
  habitCompleted: z.number().int().nonnegative(),
  habitSkipped: z.number().int().nonnegative(),
  habitExcused: z.number().int().nonnegative(),
  goalCheckIns: z.number().int().nonnegative(),
  goalProgressTotal: z.number().nonnegative(),
  weeklyPlansFinalized: z.number().int().nonnegative(),
});

export const analyticsRangeSchema = z
  .object({
    start: z.iso.date(),
    end: z.iso.date(),
  })
  .strict();

export const analyticsQuerySchema = analyticsRangeSchema.partial().strict();

export const analyticsSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  metricVersion: z.literal("focused.analytics.v1"),
  range: analyticsRangeSchema.extend({
    days: z.number().int().min(1).max(366),
  }),
  timeZone: z.string().min(1).max(80),
  computedAt: z.iso.datetime(),
  sourceThrough: z.iso.datetime(),
  freshness: z.enum(["fresh", "partial"]),
  summary: z.object({
    focusedSeconds: z.number().int().nonnegative(),
    plannedSeconds: z.number().int().nonnegative(),
    completedSessions: z.number().int().nonnegative(),
    abandonedSessions: z.number().int().nonnegative(),
    planAttainmentPercent: z.number().min(0).max(100).nullable(),
    outcomeRatePercent: z.number().min(0).max(100).nullable(),
    activeFocusDays: z.number().int().nonnegative(),
    interruptionCount: z.number().int().nonnegative(),
    habitDue: z.number().int().nonnegative(),
    habitEligible: z.number().int().nonnegative(),
    habitCompleted: z.number().int().nonnegative(),
    habitSkipped: z.number().int().nonnegative(),
    habitExcused: z.number().int().nonnegative(),
    habitCompletionPercent: z.number().min(0).max(100).nullable(),
    goalCheckIns: z.number().int().nonnegative(),
    averageGoalProgress: z.number().min(0).max(100).nullable(),
    weeklyPlansFinalized: z.number().int().nonnegative(),
  }),
  daily: z
    .array(dailyValuesSchema.extend({ localDate: z.iso.date() }))
    .max(366),
  interruptions: z.object({
    total: z.number().int().nonnegative(),
    byCategory: countMapSchema,
    byHour: countMapSchema,
    sampleSize: z.number().int().nonnegative(),
    disclosure: z.literal("self_reported_only"),
  }),
  definitions: z.array(
    z.object({
      key: z.string(),
      version: z.number().int().positive(),
      unit: z.string(),
      definition: z.string(),
    }),
  ),
  limitations: z.array(z.string()),
});

export const analyticsResponseSchema = z.object({
  data: analyticsSnapshotSchema,
});

export const createReportSchema = z
  .object({ range: analyticsRangeSchema, clientCommandId: z.uuid() })
  .strict();
export const createExportSchema = z
  .object({
    range: analyticsRangeSchema,
    format: z.enum(["csv", "json"]),
    clientCommandId: z.uuid(),
  })
  .strict();
export const updateGamificationSchema = z
  .object({
    enabled: z.boolean(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const gamificationSchema = z.object({
  enabled: z.boolean(),
  version: z.number().int().positive(),
  totalXp: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  levelTitle: z.string(),
  nextLevelXp: z.number().int().nonnegative().nullable(),
  achievements: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      awardedAt: z.iso.datetime(),
    }),
  ),
  streaks: z.array(
    z.object({
      subjectType: z.string(),
      currentCount: z.number().int().nonnegative(),
      bestCount: z.number().int().nonnegative(),
      lastQualifiedDate: z.iso.date().nullable(),
    }),
  ),
});

export const gamificationResponseSchema = z.object({
  data: gamificationSchema,
});

export const analyticsExportSchema = z.object({
  id: z.uuid(),
  status: z.literal("completed"),
  format: z.enum(["csv", "json"]),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  checksum: z.string().length(64),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});

export const analyticsExportResponseSchema = z.object({
  data: analyticsExportSchema,
});
