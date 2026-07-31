import type {
  HabitCheckInDraft,
  HabitDraft,
  HabitHistoryPage,
  HabitListView,
  HabitSchedule,
  HabitSummary,
  HabitTarget,
} from "@/features/habits/domain/habit-types";

export interface HabitProfile {
  readonly timeZone: string;
}

export interface HabitCreateCommand extends HabitDraft {
  readonly userId: string;
  readonly clientCommandId: string;
  readonly now: Date;
}

export interface HabitUpdateCommand {
  readonly userId: string;
  readonly habitId: string;
  readonly title: string;
  readonly kind: HabitDraft["kind"];
  readonly target: HabitTarget;
  readonly schedule: HabitSchedule;
  readonly effectiveOn: string;
  readonly expectedVersion: number;
  readonly timeZone: string;
  readonly now: Date;
}

export interface HabitStateCommand {
  readonly userId: string;
  readonly habitId: string;
  readonly expectedVersion: number;
  readonly localDate: string;
  readonly now: Date;
}

export interface HabitPauseCommand extends HabitStateCommand {
  readonly reason: string | null;
}

export interface HabitCheckInCommand extends HabitCheckInDraft {
  readonly userId: string;
  readonly habitId: string;
  readonly timeZone: string;
  readonly now: Date;
}

export interface HabitExpansionCommand {
  readonly userId: string;
  readonly from: string;
  readonly through: string;
  readonly now: Date;
}

export interface HabitRepository {
  listExpansionCandidates(
    afterUserId: string | undefined,
    limit: number,
  ): Promise<readonly string[]>;
  getProfile(userId: string): Promise<HabitProfile>;
  countActive(userId: string): Promise<number>;
  expandOccurrences(command: HabitExpansionCommand): Promise<number>;
  list(userId: string, localDate: string): Promise<HabitListView>;
  findSummary(
    userId: string,
    habitId: string,
    localDate: string,
  ): Promise<HabitSummary | null>;
  create(command: HabitCreateCommand): Promise<HabitSummary>;
  update(
    command: HabitUpdateCommand,
  ): Promise<HabitSummary | "conflict" | null>;
  setArchived(
    command: HabitStateCommand,
    archived: boolean,
  ): Promise<HabitSummary | "conflict" | null>;
  pause(command: HabitPauseCommand): Promise<HabitSummary | "conflict" | null>;
  resume(command: HabitStateCommand): Promise<HabitSummary | "conflict" | null>;
  recordEntry(
    command: HabitCheckInCommand,
  ): Promise<HabitSummary | "conflict" | "not_due" | null>;
  undoEntry(
    command: HabitStateCommand & { readonly clientCommandId: string },
  ): Promise<HabitSummary | "conflict" | null>;
  history(
    userId: string,
    habitId: string,
    localDate: string,
    cursor?: string,
  ): Promise<HabitHistoryPage | null>;
}
