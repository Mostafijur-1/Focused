import type { Clock } from "@/application/ports/clock";
import { requirePermission } from "@/features/auth/application/authorization-policy";
import type { AuthUser } from "@/features/auth/domain/auth-types";
import type {
  NotificationRepository,
  OccurrenceAction,
  ReminderDraft,
  ReminderJobScheduler,
  ReminderStateAction,
  ReminderUpdateDraft,
} from "@/features/notifications/application/ports";
import {
  isValidTimeZone,
  notificationLimits,
} from "@/features/notifications/domain/notification-policy";
import type {
  OccurrenceStatus,
  ReminderListView,
  ReminderSummary,
} from "@/features/notifications/domain/notification-types";
import { AppError } from "@/lib/errors/app-error";

interface ReminderServiceDependencies {
  readonly repository: NotificationRepository;
  readonly scheduler: ReminderJobScheduler;
  readonly clock: Clock;
}

export class ReminderService {
  constructor(private readonly dependencies: ReminderServiceDependencies) {}

  async list(user: AuthUser): Promise<ReminderListView> {
    requirePermission(user, "reminders:read:own");
    return this.dependencies.repository.listReminders(
      user.id,
      this.dependencies.clock.now(),
    );
  }

  async create(user: AuthUser, input: ReminderDraft): Promise<ReminderSummary> {
    requirePermission(user, "reminders:write:own");
    const now = this.dependencies.clock.now();
    validateDraft(input, now);
    if (
      (await this.dependencies.repository.countActiveReminders(user.id)) >=
      notificationLimits.activeReminders
    ) {
      throw validation("/title", "active_reminder_limit");
    }
    const reminder = await this.dependencies.repository.createReminder({
      ...input,
      userId: user.id,
      now,
    });
    await this.expand(user.id, reminder.id, now);
    await this.requestTick();
    return (
      (
        await this.dependencies.repository.listReminders(user.id, now)
      ).reminders.find((candidate) => candidate.id === reminder.id) ?? reminder
    );
  }

  async update(
    user: AuthUser,
    reminderId: string,
    input: ReminderUpdateDraft,
  ): Promise<ReminderSummary> {
    requirePermission(user, "reminders:write:own");
    const now = this.dependencies.clock.now();
    validateDraft(input, now);
    const result = await this.dependencies.repository.updateReminder({
      ...input,
      userId: user.id,
      reminderId,
      now,
    });
    const reminder = requireMutation(result);
    await this.expand(user.id, reminder.id, now);
    await this.requestTick();
    return reminder;
  }

  async setState(
    user: AuthUser,
    reminderId: string,
    action: ReminderStateAction,
    expectedVersion: number,
  ): Promise<ReminderSummary> {
    requirePermission(user, "reminders:write:own");
    const result = await this.dependencies.repository.setReminderState({
      userId: user.id,
      reminderId,
      action,
      expectedVersion,
      now: this.dependencies.clock.now(),
    });
    return requireMutation(result);
  }

  async delete(
    user: AuthUser,
    reminderId: string,
    expectedVersion: number,
  ): Promise<void> {
    requirePermission(user, "reminders:write:own");
    const result = await this.dependencies.repository.deleteReminder({
      userId: user.id,
      reminderId,
      expectedVersion,
    });
    if (result === "not_found") notFound();
    if (result === "conflict") conflict();
  }

  async actOnOccurrence(
    user: AuthUser,
    occurrenceId: string,
    action: OccurrenceAction,
    expectedVersion: number,
    snoozedUntil: string | null,
  ): Promise<OccurrenceStatus> {
    requirePermission(user, "reminders:write:own");
    const now = this.dependencies.clock.now();
    const parsedSnooze = snoozedUntil ? new Date(snoozedUntil) : null;
    if (action === "snooze") {
      if (
        !parsedSnooze ||
        parsedSnooze <= now ||
        parsedSnooze > new Date(now.getTime() + 7 * 86_400_000)
      ) {
        throw validation("/snoozedUntil", "invalid_snooze_window");
      }
    }
    const result = await this.dependencies.repository.actOnOccurrence({
      userId: user.id,
      occurrenceId,
      action,
      expectedVersion,
      snoozedUntil: action === "snooze" ? parsedSnooze : null,
      now,
    });
    if (result === "not_found") notFound();
    if (result === "conflict") conflict();
    if (action === "snooze") await this.requestTick();
    return result;
  }

  private async expand(userId: string, reminderId: string, now: Date) {
    await this.dependencies.repository.expandReminder({
      userId,
      reminderId,
      from: now,
      through: new Date(
        now.getTime() + notificationLimits.expansionDays * 86_400_000,
      ),
      now,
    });
  }

  private async requestTick(): Promise<void> {
    if (!this.dependencies.scheduler.configured) return;
    try {
      await this.dependencies.scheduler.requestTick();
    } catch {
      // The durable occurrence remains authoritative and will be reconciled by
      // the global schedule. Queue availability never rolls back user intent.
    }
  }
}

function validateDraft(
  input: Omit<ReminderDraft, "clientCommandId">,
  now: Date,
): void {
  if (!input.title.trim()) throw validation("/title", "required");
  if (!isValidTimeZone(input.timeZone)) {
    throw validation("/timeZone", "invalid_time_zone");
  }
  if (input.schedule.kind === "once") {
    const at = new Date(input.schedule.at);
    if (Number.isNaN(at.getTime()) || at <= now) {
      throw validation("/schedule/at", "must_be_future");
    }
  }
}

function requireMutation(
  value: ReminderSummary | "not_found" | "conflict",
): ReminderSummary {
  if (value === "not_found") notFound();
  if (value === "conflict") conflict();
  return value;
}

function notFound(): never {
  throw new AppError({
    code: "NOT_FOUND",
    safeMessage: "Reminder was not found.",
  });
}

function conflict(): never {
  throw new AppError({
    code: "CONFLICT",
    safeMessage:
      "The reminder changed in another session. Reload and try again.",
  });
}

function validation(pointer: string, code: string): AppError {
  return new AppError({
    code: "VALIDATION_ERROR",
    safeMessage: "The reminder details are invalid.",
    details: { errors: [{ pointer, code }] },
  });
}
