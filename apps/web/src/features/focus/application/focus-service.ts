import type { Clock } from "@/application/ports/clock";
import { requirePermission } from "@/features/auth/application/authorization-policy";
import type { AuthUser } from "@/features/auth/domain/auth-types";
import type {
  FocusCommandContext,
  FocusMutationResult,
  FocusRepository,
} from "@/features/focus/application/ports";
import {
  defaultPomodoroConfig,
  focusLimits,
  validPomodoroConfig,
} from "@/features/focus/domain/focus-policy";
import type {
  FocusOverview,
  FocusSessionView,
  FocusStartDraft,
  InterruptionCategory,
  PomodoroConfig,
  PomodoroPresetView,
} from "@/features/focus/domain/focus-types";
import { AppError } from "@/lib/errors/app-error";

interface FocusServiceDependencies {
  readonly repository: FocusRepository;
  readonly clock: Clock;
}

export class FocusService {
  constructor(private readonly dependencies: FocusServiceDependencies) {}

  overview(user: AuthUser): Promise<FocusOverview> {
    requirePermission(user, "focus:read:own");
    return this.dependencies.repository.overview(
      user.id,
      this.dependencies.clock.now(),
    );
  }

  async detail(user: AuthUser, sessionId: string): Promise<FocusSessionView> {
    requirePermission(user, "focus:read:own");
    const session = await this.dependencies.repository.detail(
      user.id,
      sessionId,
      this.dependencies.clock.now(),
    );
    if (!session) throw notFound();
    return session;
  }

  start(
    user: AuthUser,
    input: FocusStartDraft & { readonly clientCommandId: string },
  ): Promise<FocusSessionView> {
    requirePermission(user, "focus:write:own");
    const draft = validateStart(input);
    return requireMutation(
      this.dependencies.repository.start({
        userId: user.id,
        draft,
        clientCommandId: input.clientCommandId,
        now: this.dependencies.clock.now(),
      }),
    );
  }

  pause(
    user: AuthUser,
    sessionId: string,
    input: Readonly<{
      reason: string | null;
      expectedVersion: number;
      clientCommandId: string;
    }>,
  ): Promise<FocusSessionView> {
    if (
      input.reason &&
      input.reason.trim().length > focusLimits.maximumPauseReasonLength
    )
      throw validation("/reason", "pause_reason_too_long");
    return this.mutate(user, sessionId, input, (context) =>
      this.dependencies.repository.pause({
        ...context,
        reason: input.reason?.trim() || null,
      }),
    );
  }

  resume(
    user: AuthUser,
    sessionId: string,
    input: VersionedCommand,
  ): Promise<FocusSessionView> {
    return this.mutate(user, sessionId, input, (context) =>
      this.dependencies.repository.resume(context),
    );
  }

  extend(
    user: AuthUser,
    sessionId: string,
    input: VersionedCommand & { readonly additionalSeconds: number },
  ): Promise<FocusSessionView> {
    if (
      !Number.isInteger(input.additionalSeconds) ||
      input.additionalSeconds < 60 ||
      input.additionalSeconds > focusLimits.maximumExtensionSeconds
    )
      throw validation("/additionalSeconds", "extension_invalid");
    return this.mutate(user, sessionId, input, (context) =>
      this.dependencies.repository.extend({
        ...context,
        additionalSeconds: input.additionalSeconds,
      }),
    );
  }

  complete(
    user: AuthUser,
    sessionId: string,
    input: VersionedCommand & { readonly outcome: string | null },
  ): Promise<FocusSessionView> {
    validateOutcome(input.outcome);
    return this.mutate(user, sessionId, input, (context) =>
      this.dependencies.repository.complete({
        ...context,
        outcome: input.outcome?.trim() || null,
      }),
    );
  }

  abandon(
    user: AuthUser,
    sessionId: string,
    input: VersionedCommand & { readonly outcome: string | null },
  ): Promise<FocusSessionView> {
    validateOutcome(input.outcome);
    return this.mutate(user, sessionId, input, (context) =>
      this.dependencies.repository.abandon({
        ...context,
        outcome: input.outcome?.trim() || null,
      }),
    );
  }

  interrupt(
    user: AuthUser,
    sessionId: string,
    input: VersionedCommand & {
      readonly category: InterruptionCategory;
      readonly note: string | null;
    },
  ): Promise<FocusSessionView> {
    if (
      input.note &&
      input.note.trim().length > focusLimits.maximumInterruptionNoteLength
    )
      throw validation("/note", "interruption_note_too_long");
    return this.mutate(user, sessionId, input, (context) =>
      this.dependencies.repository.interrupt({
        ...context,
        category: input.category,
        note: input.note?.trim() || null,
      }),
    );
  }

  advanceInterval(
    user: AuthUser,
    sessionId: string,
    input: VersionedCommand & { readonly skip: boolean },
  ): Promise<FocusSessionView> {
    return this.mutate(user, sessionId, input, (context) =>
      this.dependencies.repository.advanceInterval({
        ...context,
        skip: input.skip,
      }),
    );
  }

  createPreset(
    user: AuthUser,
    input: Readonly<{
      name: string;
      config: PomodoroConfig;
      isDefault: boolean;
      clientCommandId: string;
    }>,
  ): Promise<PomodoroPresetView> {
    requirePermission(user, "focus:write:own");
    const name = validatePreset(input.name, input.config);
    return this.dependencies.repository.createPreset({
      userId: user.id,
      name,
      config: input.config,
      isDefault: input.isDefault,
      clientCommandId: input.clientCommandId,
      now: this.dependencies.clock.now(),
    });
  }

  async updatePreset(
    user: AuthUser,
    presetId: string,
    input: Readonly<{
      name: string;
      config: PomodoroConfig;
      isDefault: boolean;
      expectedVersion: number;
    }>,
  ): Promise<PomodoroPresetView> {
    requirePermission(user, "focus:write:own");
    const name = validatePreset(input.name, input.config);
    const result = await this.dependencies.repository.updatePreset({
      userId: user.id,
      presetId,
      name,
      config: input.config,
      isDefault: input.isDefault,
      expectedVersion: input.expectedVersion,
      now: this.dependencies.clock.now(),
    });
    if (result === "conflict") throw conflict("focus_version_conflict");
    if (!result) throw notFound("Pomodoro preset not found.");
    return result;
  }

  private mutate(
    user: AuthUser,
    sessionId: string,
    input: VersionedCommand,
    operation: (context: FocusCommandContext) => Promise<FocusMutationResult>,
  ): Promise<FocusSessionView> {
    requirePermission(user, "focus:write:own");
    return requireMutation(
      operation({
        userId: user.id,
        sessionId,
        expectedVersion: input.expectedVersion,
        clientCommandId: input.clientCommandId,
        now: this.dependencies.clock.now(),
      }),
    );
  }
}

interface VersionedCommand {
  readonly expectedVersion: number;
  readonly clientCommandId: string;
}

function validateStart(input: FocusStartDraft): FocusStartDraft {
  const intent = input.intent.trim();
  if (!intent || intent.length > focusLimits.maximumIntentLength)
    throw validation("/intent", "focus_intent_invalid");
  if (
    !Number.isInteger(input.plannedSeconds) ||
    input.plannedSeconds < focusLimits.minimumSeconds ||
    input.plannedSeconds > focusLimits.maximumSeconds
  )
    throw validation("/plannedSeconds", "focus_duration_invalid");
  if (!input.timeZone.trim() || input.timeZone.length > 80)
    throw validation("/timeZone", "time_zone_invalid");
  if (input.kind === "pomodoro") {
    const config = input.pomodoroConfig ?? defaultPomodoroConfig;
    if (!validPomodoroConfig(config))
      throw validation("/pomodoroConfig", "pomodoro_config_invalid");
    return {
      ...input,
      intent,
      plannedSeconds: config.focusSeconds * config.cycles,
      pomodoroConfig: config,
    };
  }
  return {
    ...input,
    intent,
    pomodoroPresetId: null,
    pomodoroConfig: null,
  };
}

function validatePreset(name: string, config: PomodoroConfig): string {
  const clean = name.trim();
  if (!clean || clean.length > 80)
    throw validation("/name", "preset_name_invalid");
  if (!validPomodoroConfig(config))
    throw validation("/config", "pomodoro_config_invalid");
  return clean;
}

function validateOutcome(outcome: string | null): void {
  if (outcome && outcome.trim().length > focusLimits.maximumOutcomeLength)
    throw validation("/outcome", "focus_outcome_too_long");
}

async function requireMutation(
  pending: Promise<FocusMutationResult>,
): Promise<FocusSessionView> {
  const result = await pending;
  if (result === "conflict") throw conflict("focus_version_conflict");
  if (result === "invalid_state") throw conflict("focus_transition_invalid");
  if (result === "invalid_reference")
    throw validation("/goalId", "focus_reference_invalid");
  if (!result) throw notFound();
  return result;
}

function validation(pointer: string, code: string): AppError {
  return new AppError({
    code: "VALIDATION_ERROR",
    status: 422,
    safeMessage: "Review the Focus Session details and try again.",
    details: { errors: [{ pointer, code }] },
  });
}

function conflict(code: string): AppError {
  return new AppError({
    code: "CONFLICT",
    safeMessage: "This Focus Session changed elsewhere. Refresh and try again.",
    details: { code },
  });
}

function notFound(message = "Focus Session not found."): AppError {
  return new AppError({ code: "NOT_FOUND", safeMessage: message });
}
