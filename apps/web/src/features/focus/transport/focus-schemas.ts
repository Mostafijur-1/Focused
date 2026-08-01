import { z } from "zod";

import {
  focusKinds,
  focusStatuses,
  interruptionCategories,
  intervalKinds,
} from "@/features/focus/domain/focus-types";

export const focusKindSchema = z.enum(focusKinds);
export const focusStatusSchema = z.enum(focusStatuses);
export const interruptionCategorySchema = z.enum(interruptionCategories);

export const pomodoroConfigSchema = z
  .object({
    focusSeconds: z.int().min(60).max(10_800),
    shortBreakSeconds: z.int().min(60).max(3_600),
    longBreakSeconds: z.int().min(60).max(7_200),
    cycles: z.int().min(1).max(12),
    longBreakEvery: z.int().min(1).max(12),
    autoStartBreaks: z.boolean(),
    autoStartFocus: z.boolean(),
    audioEnabled: z.boolean(),
    vibrationEnabled: z.boolean(),
  })
  .strict();

export const startFocusSchema = z
  .object({
    kind: focusKindSchema,
    intent: z.string().trim().min(1).max(300),
    plannedSeconds: z.int().min(60).max(43_200),
    goalId: z.uuid().nullable().default(null),
    pomodoroPresetId: z.uuid().nullable().default(null),
    pomodoroConfig: pomodoroConfigSchema.nullable().default(null),
    timeZone: z.string().trim().min(1).max(80),
    clientCommandId: z.uuid(),
  })
  .strict();

const versionedCommand = {
  expectedVersion: z.int().positive(),
  clientCommandId: z.uuid(),
} as const;

export const pauseFocusSchema = z
  .object({ ...versionedCommand, reason: z.string().max(160).nullable() })
  .strict();
export const versionedFocusSchema = z.object(versionedCommand).strict();
export const extendFocusSchema = z
  .object({
    ...versionedCommand,
    additionalSeconds: z.int().min(60).max(10_800),
  })
  .strict();
export const terminalFocusSchema = z
  .object({ ...versionedCommand, outcome: z.string().max(2_000).nullable() })
  .strict();
export const interruptionSchema = z
  .object({
    ...versionedCommand,
    category: interruptionCategorySchema,
    note: z.string().max(500).nullable(),
  })
  .strict();
export const advanceIntervalSchema = z
  .object({ ...versionedCommand, skip: z.boolean() })
  .strict();
export const presetMutationSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    config: pomodoroConfigSchema,
    isDefault: z.boolean(),
    clientCommandId: z.uuid().optional(),
    expectedVersion: z.int().positive().optional(),
  })
  .strict();

const intervalSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(intervalKinds),
    status: z.enum(["running", "paused", "completed", "skipped"]),
    cycleNumber: z.int().positive(),
    plannedSeconds: z.int().positive(),
    elapsedSeconds: z.int().nonnegative(),
    remainingSeconds: z.int().nonnegative(),
    overtimeSeconds: z.int().nonnegative(),
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime().nullable(),
  })
  .strict();

export const pomodoroPresetSchema = pomodoroConfigSchema
  .extend({
    id: z.uuid(),
    name: z.string(),
    isDefault: z.boolean(),
    version: z.int().positive(),
  })
  .strict();

export const focusSessionSchema = z
  .object({
    id: z.uuid(),
    goalId: z.uuid().nullable(),
    goalTitle: z.string().nullable(),
    pomodoroPresetId: z.uuid().nullable(),
    kind: focusKindSchema,
    status: focusStatusSchema,
    intent: z.string(),
    plannedSeconds: z.int().positive(),
    focusedSeconds: z.int().nonnegative(),
    pausedSeconds: z.int().nonnegative(),
    interruptionCount: z.int().nonnegative(),
    timeZone: z.string(),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    abandonedAt: z.iso.datetime().nullable(),
    outcome: z.string().nullable(),
    version: z.int().positive(),
    activeInterval: intervalSchema.nullable(),
    pomodoroConfig: pomodoroConfigSchema.nullable(),
    serverNow: z.iso.datetime(),
  })
  .strict();

export const focusResponseSchema = z
  .object({ data: focusSessionSchema })
  .passthrough();
export const focusOverviewResponseSchema = z
  .object({
    data: z.object({
      active: focusSessionSchema.nullable(),
      recent: z.array(focusSessionSchema),
      presets: z.array(pomodoroPresetSchema),
      goalOptions: z.array(z.object({ id: z.uuid(), title: z.string() })),
      serverNow: z.iso.datetime(),
    }),
  })
  .passthrough();
export const presetResponseSchema = z
  .object({ data: pomodoroPresetSchema })
  .passthrough();
