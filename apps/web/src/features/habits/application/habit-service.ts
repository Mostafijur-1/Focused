import type { Clock } from "@/application/ports/clock";
import { requirePermission } from "@/features/auth/application/authorization-policy";
import type { AuthUser } from "@/features/auth/domain/auth-types";
import type {
  HabitCheckInCommand,
  HabitRepository,
  HabitStateCommand,
  HabitUpdateCommand,
} from "@/features/habits/application/ports";
import {
  completionFor,
  habitLimits,
  validateHabitDraft,
} from "@/features/habits/domain/habit-policy";
import {
  addDays,
  differenceInDays,
  isIsoDate,
  validateHabitSchedule,
} from "@/features/habits/domain/habit-schedule";
import type {
  HabitCheckInDraft,
  HabitDraft,
  HabitHistoryPage,
  HabitListView,
  HabitSummary,
} from "@/features/habits/domain/habit-types";
import { localDateAt } from "@/features/dashboard/domain/dashboard-time";
import { AppError } from "@/lib/errors/app-error";

interface HabitServiceDependencies {
  readonly repository: HabitRepository;
  readonly clock: Clock;
}

export class HabitService {
  constructor(private readonly dependencies: HabitServiceDependencies) {}

  async list(user: AuthUser): Promise<HabitListView> {
    requirePermission(user, "habits:read:own");
    const { now, localDate, timeZone } = await this.context(user.id);
    await this.dependencies.repository.expandOccurrences({
      userId: user.id,
      from: addDays(localDate, -habitLimits.historyPageSize + 1),
      through: addDays(localDate, 14),
      now,
    });
    return this.dependencies.repository
      .list(user.id, localDate)
      .then((view) => ({
        ...view,
        timeZone,
      }));
  }

  async create(
    user: AuthUser,
    input: Omit<HabitDraft, "timeZone"> & { readonly clientCommandId: string },
  ): Promise<HabitSummary> {
    requirePermission(user, "habits:write:own");
    const { now, localDate, timeZone } = await this.context(user.id);
    assertEditableDate(input.startsOn, localDate);
    const schedule = validateHabitSchedule(input.schedule, input.startsOn);
    if (!schedule.ok) throw validationError("/schedule", schedule.error);
    const draft = validateHabitDraft({
      ...input,
      schedule: schedule.value,
      timeZone,
    });
    if (!draft.ok) throw validationError("/target", draft.error);
    if (
      (await this.dependencies.repository.countActive(user.id)) >=
      habitLimits.activePerMember
    ) {
      throw validationError("/title", "active_habit_limit");
    }
    return this.dependencies.repository.create({
      ...draft.value,
      clientCommandId: input.clientCommandId,
      userId: user.id,
      now,
    });
  }

  async update(
    user: AuthUser,
    habitId: string,
    input: Omit<HabitUpdateCommand, "userId" | "habitId" | "timeZone" | "now">,
  ): Promise<HabitSummary> {
    requirePermission(user, "habits:write:own");
    const { now, localDate, timeZone } = await this.context(user.id);
    if (
      !isIsoDate(input.effectiveOn) ||
      input.effectiveOn < localDate ||
      input.effectiveOn > addDays(localDate, 366)
    ) {
      throw validationError(
        "/effectiveOn",
        "schedule_change_must_not_be_backdated",
      );
    }
    const schedule = validateHabitSchedule(input.schedule, input.effectiveOn);
    if (!schedule.ok) throw validationError("/schedule", schedule.error);
    const draft = validateHabitDraft({
      title: input.title,
      kind: input.kind,
      target: input.target,
      schedule: schedule.value,
      startsOn: input.effectiveOn,
      timeZone,
    });
    if (!draft.ok) throw validationError("/target", draft.error);
    return requireMutation(
      await this.dependencies.repository.update({
        userId: user.id,
        habitId,
        title: draft.value.title,
        kind: draft.value.kind,
        target: draft.value.target,
        schedule: draft.value.schedule,
        effectiveOn: input.effectiveOn,
        expectedVersion: input.expectedVersion,
        timeZone,
        now,
      }),
    );
  }

  async setArchived(
    user: AuthUser,
    habitId: string,
    expectedVersion: number,
    archived: boolean,
  ): Promise<HabitSummary> {
    requirePermission(user, "habits:write:own");
    const context = await this.context(user.id);
    return requireMutation(
      await this.dependencies.repository.setArchived(
        stateCommand(user.id, habitId, expectedVersion, context),
        archived,
      ),
    );
  }

  async pause(
    user: AuthUser,
    habitId: string,
    expectedVersion: number,
    reason: string | null,
  ): Promise<HabitSummary> {
    requirePermission(user, "habits:write:own");
    const context = await this.context(user.id);
    const normalizedReason = reason?.trim() || null;
    if (
      normalizedReason &&
      normalizedReason.length > habitLimits.reasonLength
    ) {
      throw validationError("/reason", "reason_too_long");
    }
    return requireMutation(
      await this.dependencies.repository.pause({
        ...stateCommand(user.id, habitId, expectedVersion, context),
        reason: normalizedReason,
      }),
    );
  }

  async resume(
    user: AuthUser,
    habitId: string,
    expectedVersion: number,
  ): Promise<HabitSummary> {
    requirePermission(user, "habits:write:own");
    const context = await this.context(user.id);
    return requireMutation(
      await this.dependencies.repository.resume(
        stateCommand(user.id, habitId, expectedVersion, context),
      ),
    );
  }

  async checkIn(
    user: AuthUser,
    habitId: string,
    input: HabitCheckInDraft,
  ): Promise<HabitSummary> {
    requirePermission(user, "habits:write:own");
    const { now, localDate, timeZone } = await this.context(user.id);
    assertBackfillDate(input.localDate, localDate);
    if (input.note && input.note.trim().length > habitLimits.noteLength) {
      throw validationError("/note", "note_too_long");
    }
    await this.dependencies.repository.expandOccurrences({
      userId: user.id,
      from: input.localDate,
      through: input.localDate,
      now,
    });
    const habit = await this.dependencies.repository.findSummary(
      user.id,
      habitId,
      localDate,
    );
    if (!habit) throw notFound();
    if (habit.archived) throw conflict("archived_habit");
    const completed = input.skippedReason
      ? false
      : completionFor(
          habit.kind,
          habit.scheduleVersion.target,
          input.value,
          input.completed,
        );
    const command: HabitCheckInCommand = {
      ...input,
      completed,
      note: input.note?.trim() || null,
      skippedReason: input.skippedReason?.trim() || null,
      userId: user.id,
      habitId,
      timeZone,
      now,
    };
    const result = await this.dependencies.repository.recordEntry(command);
    if (result === "not_due")
      throw validationError("/localDate", "habit_not_due");
    return requireMutation(result);
  }

  async undo(
    user: AuthUser,
    habitId: string,
    input: {
      readonly expectedVersion: number;
      readonly clientCommandId: string;
    },
  ): Promise<HabitSummary> {
    requirePermission(user, "habits:write:own");
    const context = await this.context(user.id);
    return requireMutation(
      await this.dependencies.repository.undoEntry({
        ...stateCommand(user.id, habitId, input.expectedVersion, context),
        clientCommandId: input.clientCommandId,
      }),
    );
  }

  async history(
    user: AuthUser,
    habitId: string,
    cursor?: string,
  ): Promise<HabitHistoryPage> {
    requirePermission(user, "habits:read:own");
    const { localDate } = await this.context(user.id);
    const page = await this.dependencies.repository.history(
      user.id,
      habitId,
      localDate,
      cursor,
    );
    if (!page) throw notFound();
    return page;
  }

  private async context(userId: string) {
    const now = this.dependencies.clock.now();
    const profile = await this.dependencies.repository.getProfile(userId);
    return {
      now,
      timeZone: profile.timeZone,
      localDate: localDateAt(now, profile.timeZone),
    };
  }
}

function stateCommand(
  userId: string,
  habitId: string,
  expectedVersion: number,
  context: Readonly<{ now: Date; localDate: string }>,
): HabitStateCommand {
  return {
    userId,
    habitId,
    expectedVersion,
    localDate: context.localDate,
    now: context.now,
  };
}

function assertEditableDate(value: string, today: string): void {
  if (
    !isIsoDate(value) ||
    differenceInDays(today, value) > habitLimits.backfillDays ||
    value > addDays(today, 366)
  ) {
    throw validationError("/startsOn", "start_date_out_of_range");
  }
}

function assertBackfillDate(value: string, today: string): void {
  if (
    !isIsoDate(value) ||
    value > today ||
    differenceInDays(today, value) > habitLimits.backfillDays
  ) {
    throw validationError("/localDate", "backfill_out_of_range");
  }
}

function requireMutation<T>(result: T | "conflict" | null): T {
  if (result === null) throw notFound();
  if (result === "conflict") throw conflict("version_conflict");
  return result;
}

function validationError(pointer: string, code: string): AppError {
  return new AppError({
    code: "VALIDATION_ERROR",
    status: 422,
    safeMessage: "Review the habit details and try again.",
    details: { errors: [{ pointer, code, message: code }] },
  });
}

function conflict(code: string): AppError {
  return new AppError({
    code: "CONFLICT",
    safeMessage: "The habit changed on another device. Refresh and try again.",
    details: { code },
  });
}

function notFound(): AppError {
  return new AppError({ code: "NOT_FOUND", safeMessage: "Habit not found." });
}
