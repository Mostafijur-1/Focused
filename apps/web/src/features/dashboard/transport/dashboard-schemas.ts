import { z } from "zod";

export const dashboardWidgetKeySchema = z.enum([
  "today_focus",
  "active_session",
  "weekly_progress",
  "habits",
  "goals",
  "reminders",
  "ai_coach",
]);

export const updateDashboardWidgetsSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    widgets: z
      .array(
        z
          .object({
            key: dashboardWidgetKeySchema,
            visible: z.boolean(),
          })
          .strict(),
      )
      .length(7),
  })
  .strict();

const dashboardWidgetSettingSchema = z
  .object({ key: dashboardWidgetKeySchema, visible: z.boolean() })
  .strict();

export const dashboardWidgetLayoutSchema = z
  .object({
    version: z.number().int().positive(),
    widgets: z.array(dashboardWidgetSettingSchema).length(7),
  })
  .strict();

const summaryState = z.enum(["ready", "empty", "unavailable"]);
const configuredState = z.enum(["ready", "not_configured", "unavailable"]);

export const dashboardSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    localDate: z.iso.date(),
    timeZone: z.string().min(1).max(80),
    computedAt: z.iso.datetime(),
    sourceThrough: z.iso.datetime(),
    staleAfter: z.iso.datetime(),
    freshness: z.enum(["fresh", "stale"]),
    data: z
      .object({
        displayName: z.string(),
        todayFocus: z
          .object({
            state: summaryState,
            priorities: z
              .array(
                z
                  .object({
                    id: z.uuid(),
                    title: z.string(),
                    status: z.enum(["planned", "in_progress", "completed"]),
                  })
                  .strict(),
              )
              .max(3),
            completedCount: z.number().int().nonnegative(),
            totalCount: z.number().int().min(0).max(3),
          })
          .strict(),
        focusSession: z
          .object({
            state: z.enum(["active", "not_configured", "unavailable"]),
            session: z
              .object({
                id: z.uuid(),
                intent: z.string(),
                kind: z.enum(["deep_work", "pomodoro", "custom"]),
                status: z.enum(["running", "paused"]),
                plannedSeconds: z.number().int().positive(),
                startedAt: z.iso.datetime(),
              })
              .strict()
              .nullable(),
          })
          .strict(),
        weeklyProgress: z
          .object({
            state: summaryState,
            completedPriorities: z.number().int().nonnegative(),
            totalPriorities: z.number().int().nonnegative(),
            focusedSeconds: z.number().int().nonnegative(),
          })
          .strict(),
        habits: z
          .object({
            state: configuredState,
            completedCount: z.number().int().min(0).max(50),
            dueCount: z.number().int().min(0).max(50),
          })
          .strict(),
        goals: z
          .object({
            state: configuredState,
            activeCount: z.number().int().nonnegative(),
            nextGoal: z
              .object({ id: z.uuid(), title: z.string() })
              .strict()
              .nullable(),
          })
          .strict(),
        reminders: z
          .object({
            state: configuredState,
            dueCount: z.number().int().nonnegative(),
            nextReminder: z
              .object({
                id: z.uuid(),
                title: z.string(),
                scheduledFor: z.iso.datetime(),
              })
              .strict()
              .nullable(),
          })
          .strict(),
        aiCoach: z.object({ state: z.literal("coming_soon") }).strict(),
      })
      .strict(),
    layout: dashboardWidgetLayoutSchema,
    degradations: z.array(
      z
        .object({
          source: z.enum([
            "today_focus",
            "focus_sessions",
            "weekly_progress",
            "habits",
            "goals",
            "reminders",
            "projection_persistence",
          ]),
          code: z.enum(["source_unavailable", "projection_not_persisted"]),
        })
        .strict(),
    ),
  })
  .strict();

export const dashboardResponseSchema = z
  .object({ data: dashboardSnapshotSchema })
  .strict();

export const dashboardWidgetResponseSchema = z
  .object({ data: dashboardWidgetLayoutSchema })
  .strict();
