import type {
  FocusOverview,
  FocusSessionView,
  FocusStartDraft,
  InterruptionCategory,
  PomodoroConfig,
  PomodoroPresetView,
} from "@/features/focus/domain/focus-types";

export type FocusMutationResult =
  FocusSessionView | "conflict" | "invalid_state" | "invalid_reference" | null;

export interface FocusCommandContext {
  readonly userId: string;
  readonly sessionId: string;
  readonly expectedVersion: number;
  readonly clientCommandId: string;
  readonly now: Date;
}

export interface FocusRepository {
  overview(userId: string, now: Date): Promise<FocusOverview>;
  detail(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<FocusSessionView | null>;
  start(
    command: Readonly<{
      userId: string;
      draft: FocusStartDraft;
      clientCommandId: string;
      now: Date;
    }>,
  ): Promise<FocusMutationResult>;
  pause(
    command: FocusCommandContext & { readonly reason: string | null },
  ): Promise<FocusMutationResult>;
  resume(command: FocusCommandContext): Promise<FocusMutationResult>;
  extend(
    command: FocusCommandContext & { readonly additionalSeconds: number },
  ): Promise<FocusMutationResult>;
  complete(
    command: FocusCommandContext & { readonly outcome: string | null },
  ): Promise<FocusMutationResult>;
  abandon(
    command: FocusCommandContext & { readonly outcome: string | null },
  ): Promise<FocusMutationResult>;
  interrupt(
    command: FocusCommandContext & {
      readonly category: InterruptionCategory;
      readonly note: string | null;
    },
  ): Promise<FocusMutationResult>;
  advanceInterval(
    command: FocusCommandContext & { readonly skip: boolean },
  ): Promise<FocusMutationResult>;
  createPreset(
    command: Readonly<{
      userId: string;
      name: string;
      config: PomodoroConfig;
      isDefault: boolean;
      clientCommandId: string;
      now: Date;
    }>,
  ): Promise<PomodoroPresetView>;
  updatePreset(
    command: Readonly<{
      userId: string;
      presetId: string;
      name: string;
      config: PomodoroConfig;
      isDefault: boolean;
      expectedVersion: number;
      now: Date;
    }>,
  ): Promise<PomodoroPresetView | "conflict" | null>;
}
