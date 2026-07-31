import { z } from "zod";

export const habitKindSchema = z.enum([
  "boolean",
  "count",
  "duration",
  "avoidance",
]);

export const habitScheduleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("daily") }).strict(),
  z
    .object({
      type: z.literal("weekdays"),
      weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    })
    .strict(),
  z
    .object({
      type: z.literal("interval"),
      everyDays: z.number().int().min(2).max(30),
      anchorDate: z.iso.date(),
    })
    .strict(),
  z
    .object({
      type: z.literal("custom_dates"),
      dates: z.array(z.iso.date()).min(1).max(128),
    })
    .strict(),
]);

export const habitTargetSchema = z
  .object({
    value: z.number().positive().max(1_000_000).nullable(),
    unit: z.string().trim().min(1).max(40).nullable(),
  })
  .strict();

export const createHabitSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    kind: habitKindSchema,
    target: habitTargetSchema,
    schedule: habitScheduleSchema,
    startsOn: z.iso.date(),
    clientCommandId: z.uuid(),
  })
  .strict();

export const updateHabitSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    kind: habitKindSchema,
    target: habitTargetSchema,
    schedule: habitScheduleSchema,
    effectiveOn: z.iso.date(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const habitStateSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();

export const pauseHabitSchema = habitStateSchema.extend({
  reason: z.string().trim().max(160).nullable().default(null),
});

export const checkInHabitSchema = z
  .object({
    localDate: z.iso.date(),
    value: z.number().min(0).max(1_000_000).nullable().default(null),
    completed: z.boolean().nullable().default(null),
    skippedReason: z.string().trim().min(1).max(160).nullable().default(null),
    note: z.string().trim().max(500).nullable().default(null),
    evidenceRef: z.uuid().nullable().default(null),
    clientCommandId: z.uuid(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.skippedReason !== null ||
      value.completed !== null ||
      value.value !== null,
    {
      path: ["completed"],
      message: "A completion, value, or skip reason is required.",
    },
  );

export const undoHabitEntrySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    clientCommandId: z.uuid(),
  })
  .strict();

const habitEntrySchema = z
  .object({
    id: z.uuid(),
    value: z.number().nullable(),
    completed: z.boolean().nullable(),
    skippedReason: z.string().nullable(),
    note: z.string().nullable(),
    evidenceRef: z.uuid().nullable(),
    recordedAt: z.iso.datetime(),
    correctedAt: z.iso.datetime().nullable(),
    undoneAt: z.iso.datetime().nullable(),
    version: z.number().int().positive(),
  })
  .strict();

const occurrenceSchema = z
  .object({
    id: z.uuid(),
    localDate: z.iso.date(),
    status: z.enum(["due", "completed", "skipped", "excused"]),
    target: habitTargetSchema,
    entry: habitEntrySchema.nullable(),
  })
  .strict();

export const habitSummarySchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    kind: habitKindSchema,
    startsOn: z.iso.date(),
    paused: z.boolean(),
    archived: z.boolean(),
    version: z.number().int().positive(),
    scheduleVersion: z
      .object({
        id: z.uuid(),
        revision: z.number().int().positive(),
        schedule: habitScheduleSchema,
        target: habitTargetSchema,
        timeZone: z.string().min(1).max(80),
        effectiveFrom: z.iso.date(),
        effectiveTo: z.iso.date().nullable(),
      })
      .strict(),
    today: occurrenceSchema.nullable(),
    consistency: z
      .object({
        dueCount: z.number().int().nonnegative(),
        completedCount: z.number().int().nonnegative(),
        percentage: z.number().int().min(0).max(100),
        currentStreak: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const habitListResponseSchema = z
  .object({
    data: z
      .object({
        localDate: z.iso.date(),
        timeZone: z.string().min(1).max(80),
        active: z.array(habitSummarySchema),
        archived: z.array(habitSummarySchema),
        syncToken: z.iso.datetime(),
      })
      .strict(),
  })
  .strict();

export const habitResponseSchema = z
  .object({ data: habitSummarySchema })
  .strict();

export const habitHistoryResponseSchema = z
  .object({
    data: z
      .object({
        habit: habitSummarySchema,
        occurrences: z.array(occurrenceSchema),
        nextCursor: z.iso.date().nullable(),
      })
      .strict(),
  })
  .strict();
