import { randomUUID } from "node:crypto";

import type { FocusedPrismaClient } from "@focused/database";
import { Prisma } from "@focused/database/generated/client";

import type {
  FocusCommandContext,
  FocusMutationResult,
  FocusRepository,
} from "@/features/focus/application/ports";
import {
  calculateTimer,
  focusLimits,
  nextPomodoroInterval,
} from "@/features/focus/domain/focus-policy";
import type {
  FocusIntervalKind,
  FocusIntervalView,
  FocusOverview,
  FocusSessionView,
  PomodoroConfig,
  PomodoroPresetView,
} from "@/features/focus/domain/focus-types";
import { appendOutboxEvent } from "@/features/platform-data/infrastructure/persistence/prisma-durable-work-store";

type TransactionClient = Parameters<
  Parameters<FocusedPrismaClient["$transaction"]>[0]
>[0];

const sessionInclude = {
  goal: { select: { title: true } },
  pomodoroPreset: true,
  pauses: { orderBy: { startedAt: "asc" as const } },
  intervals: {
    orderBy: { startedAt: "asc" as const },
    include: { pauses: { orderBy: { startedAt: "asc" as const } } },
  },
  interruptions: { select: { id: true } },
} satisfies Prisma.FocusSessionInclude;

type SessionRecord = Prisma.FocusSessionGetPayload<{
  include: typeof sessionInclude;
}>;
type PresetRecord = Prisma.PomodoroPresetGetPayload<object>;

export class PrismaFocusRepository implements FocusRepository {
  constructor(private readonly prisma: FocusedPrismaClient) {}

  async overview(userId: string, now: Date): Promise<FocusOverview> {
    const [sessions, presets, goals] = await Promise.all([
      this.prisma.focusSession.findMany({
        where: { userId },
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        take: focusLimits.recentSessions + 1,
        include: sessionInclude,
      }),
      this.prisma.pomodoroPreset.findMany({
        where: { userId, archivedAt: null },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      }),
      this.prisma.goal.findMany({
        where: {
          userId,
          archivedAt: null,
          status: { in: ["ACTIVE", "PAUSED"] },
        },
        orderBy: [{ priority: "asc" }, { position: "asc" }],
        take: 100,
        select: { id: true, title: true },
      }),
    ]);
    const views = sessions.map((session) => toSessionView(session, now));
    return {
      active:
        views.find((session) =>
          ["running", "paused"].includes(session.status),
        ) ?? null,
      recent: views
        .filter((session) =>
          ["completed", "abandoned"].includes(session.status),
        )
        .slice(0, focusLimits.recentSessions),
      presets: presets.map(toPresetView),
      goalOptions: goals,
      serverNow: now.toISOString(),
    };
  }

  async detail(userId: string, sessionId: string, now: Date) {
    const session = await this.prisma.focusSession.findFirst({
      where: { id: sessionId, userId },
      include: sessionInclude,
    });
    return session ? toSessionView(session, now) : null;
  }

  async start(command: Parameters<FocusRepository["start"]>[0]) {
    const replay = await this.prisma.focusSession.findUnique({
      where: {
        userId_clientCommandId: {
          userId: command.userId,
          clientCommandId: command.clientCommandId,
        },
      },
      select: { id: true },
    });
    if (replay)
      return this.detail(
        command.userId,
        replay.id,
        command.now,
      ) as Promise<FocusSessionView>;

    const reference = await this.resolveStartReference(command);
    if (reference === "invalid_reference") return reference;
    const sessionId = randomUUID();
    const intervalId = randomUUID();
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.focusSession.create({
          data: {
            id: sessionId,
            userId: command.userId,
            goalId: command.draft.goalId,
            pomodoroPresetId: reference.presetId,
            clientCommandId: command.clientCommandId,
            kind: databaseFocusKind(command.draft.kind),
            intent: command.draft.intent,
            plannedSeconds: reference.plannedSeconds,
            timeZone: command.draft.timeZone,
            ...(reference.config
              ? {
                  pomodoroConfig:
                    reference.config as unknown as Prisma.InputJsonValue,
                }
              : {}),
            startedAt: command.now,
          },
        });
        await transaction.focusInterval.create({
          data: {
            id: intervalId,
            focusSessionId: sessionId,
            kind: "FOCUS",
            plannedSeconds:
              reference.config?.focusSeconds ?? command.draft.plannedSeconds,
            startedAt: command.now,
          },
        });
        await publish(
          transaction,
          command.userId,
          sessionId,
          1,
          "FocusSessionStarted",
          command.now,
          {
            kind: command.draft.kind,
            goalId: command.draft.goalId,
            plannedSeconds: reference.plannedSeconds,
          },
        );
      });
    } catch (error) {
      if (isUniqueError(error)) {
        const duplicate = await this.prisma.focusSession.findUnique({
          where: {
            userId_clientCommandId: {
              userId: command.userId,
              clientCommandId: command.clientCommandId,
            },
          },
          select: { id: true },
        });
        if (duplicate)
          return this.detail(command.userId, duplicate.id, command.now);
        return "conflict" as const;
      }
      throw error;
    }
    return this.detail(command.userId, sessionId, command.now);
  }

  async pause(
    command: FocusCommandContext & { readonly reason: string | null },
  ) {
    const replay = await this.commandReplay(command);
    if (replay) return replay;
    const result = this.prisma.$transaction(async (transaction) => {
      const current = await activeRecord(transaction, command);
      if (!current) return "missing" as const;
      if (current.version !== command.expectedVersion)
        return "conflict" as const;
      if (current.status !== "RUNNING" || !current.intervals[0])
        return "invalid_state" as const;
      const version = current.version + 1;
      const updated = await transaction.focusSession.updateMany({
        where: {
          id: current.id,
          userId: command.userId,
          version: current.version,
          status: "RUNNING",
        },
        data: { status: "PAUSED", version: { increment: 1 } },
      });
      if (updated.count !== 1) return "conflict" as const;
      await transaction.focusInterval.update({
        where: { id: current.intervals[0].id },
        data: { status: "PAUSED", version: { increment: 1 } },
      });
      await transaction.sessionPause.create({
        data: {
          focusSessionId: current.id,
          focusIntervalId: current.intervals[0].id,
          clientCommandId: command.clientCommandId,
          startedAt: command.now,
          reason: command.reason,
        },
      });
      await recordCommand(transaction, command, "PAUSE", version);
      await publish(
        transaction,
        command.userId,
        current.id,
        version,
        "FocusSessionPaused",
        command.now,
        { reason: command.reason },
      );
      return "ok" as const;
    });
    return this.finishCommand(command, result);
  }

  async resume(command: FocusCommandContext) {
    const replay = await this.commandReplay(command);
    if (replay) return replay;
    const result = this.prisma.$transaction(async (transaction) => {
      const current = await activeRecord(transaction, command);
      if (!current) return "missing" as const;
      if (current.version !== command.expectedVersion)
        return "conflict" as const;
      if (
        current.status !== "PAUSED" ||
        !current.intervals[0] ||
        !current.pauses[0]
      )
        return "invalid_state" as const;
      const version = current.version + 1;
      const updated = await transaction.focusSession.updateMany({
        where: {
          id: current.id,
          userId: command.userId,
          version: current.version,
          status: "PAUSED",
        },
        data: { status: "RUNNING", version: { increment: 1 } },
      });
      if (updated.count !== 1) return "conflict" as const;
      await transaction.focusInterval.update({
        where: { id: current.intervals[0].id },
        data: { status: "RUNNING", version: { increment: 1 } },
      });
      await transaction.sessionPause.update({
        where: { id: current.pauses[0].id },
        data: {
          endedAt: command.now,
          endedByCommandId: command.clientCommandId,
        },
      });
      await recordCommand(transaction, command, "RESUME", version);
      await publish(
        transaction,
        command.userId,
        current.id,
        version,
        "FocusSessionResumed",
        command.now,
        {},
      );
      return "ok" as const;
    });
    return this.finishCommand(command, result);
  }

  async extend(
    command: FocusCommandContext & { readonly additionalSeconds: number },
  ) {
    const replay = await this.commandReplay(command);
    if (replay) return replay;
    const currentView = await this.detail(
      command.userId,
      command.sessionId,
      command.now,
    );
    if (!currentView) return null;
    if (
      !currentView.activeInterval ||
      currentView.activeInterval.plannedSeconds + command.additionalSeconds >
        focusLimits.maximumSeconds
    )
      return "invalid_state" as const;
    const result = this.prisma.$transaction(async (transaction) => {
      const current = await activeRecord(transaction, command);
      if (!current) return "missing" as const;
      if (current.version !== command.expectedVersion)
        return "conflict" as const;
      if (!current.intervals[0]) return "invalid_state" as const;
      const version = current.version + 1;
      const updated = await transaction.focusSession.updateMany({
        where: {
          id: current.id,
          userId: command.userId,
          version: current.version,
          status: { in: ["RUNNING", "PAUSED"] },
        },
        data: {
          plannedSeconds: { increment: command.additionalSeconds },
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) return "conflict" as const;
      await transaction.focusInterval.update({
        where: { id: current.intervals[0].id },
        data: {
          plannedSeconds: { increment: command.additionalSeconds },
          version: { increment: 1 },
        },
      });
      await recordCommand(transaction, command, "EXTEND", version);
      await publish(
        transaction,
        command.userId,
        current.id,
        version,
        "FocusSessionExtended",
        command.now,
        { additionalSeconds: command.additionalSeconds },
      );
      return "ok" as const;
    });
    return this.finishCommand(command, result);
  }

  complete(command: FocusCommandContext & { readonly outcome: string | null }) {
    return this.terminal(command, "COMPLETED", command.outcome);
  }

  abandon(command: FocusCommandContext & { readonly outcome: string | null }) {
    return this.terminal(command, "ABANDONED", command.outcome);
  }

  async interrupt(
    command: FocusCommandContext & {
      readonly category: Parameters<
        FocusRepository["interrupt"]
      >[0]["category"];
      readonly note: string | null;
    },
  ) {
    const replay = await this.commandReplay(command);
    if (replay) return replay;
    const result = this.prisma.$transaction(async (transaction) => {
      const current = await activeRecord(transaction, command);
      if (!current) return "missing" as const;
      if (current.version !== command.expectedVersion)
        return "conflict" as const;
      const version = current.version + 1;
      const updated = await transaction.focusSession.updateMany({
        where: {
          id: current.id,
          userId: command.userId,
          version: current.version,
          status: { in: ["RUNNING", "PAUSED"] },
        },
        data: { version: { increment: 1 } },
      });
      if (updated.count !== 1) return "conflict" as const;
      await transaction.interruption.create({
        data: {
          focusSessionId: current.id,
          clientCommandId: command.clientCommandId,
          category: command.category,
          note: command.note,
          resumed: current.status === "RUNNING",
          occurredAt: command.now,
        },
      });
      await recordCommand(transaction, command, "INTERRUPTION", version);
      await publish(
        transaction,
        command.userId,
        current.id,
        version,
        "FocusInterruptionLogged",
        command.now,
        { category: command.category },
      );
      return "ok" as const;
    });
    return this.finishCommand(command, result);
  }

  async advanceInterval(
    command: FocusCommandContext & { readonly skip: boolean },
  ) {
    const replay = await this.commandReplay(command);
    if (replay) return replay;
    const view = await this.detail(
      command.userId,
      command.sessionId,
      command.now,
    );
    if (!view) return null;
    if (
      view.kind !== "pomodoro" ||
      !view.pomodoroConfig ||
      !view.activeInterval
    )
      return "invalid_state" as const;
    const activeInterval = view.activeInterval;
    if (activeInterval.kind === "focus" && activeInterval.remainingSeconds > 0)
      return "invalid_state" as const;
    const next = nextPomodoroInterval(
      {
        kind: activeInterval.kind,
        cycleNumber: activeInterval.cycleNumber,
      },
      view.pomodoroConfig,
    );
    if (!next) return "invalid_state" as const;
    const result = this.prisma.$transaction(async (transaction) => {
      const current = await activeRecord(transaction, command);
      if (!current) return "missing" as const;
      if (current.version !== command.expectedVersion)
        return "conflict" as const;
      if (!current.intervals[0]) return "invalid_state" as const;
      const version = current.version + 1;
      const updated = await transaction.focusSession.updateMany({
        where: {
          id: current.id,
          userId: command.userId,
          version: current.version,
          status: { in: ["RUNNING", "PAUSED"] },
        },
        data: { status: "RUNNING", version: { increment: 1 } },
      });
      if (updated.count !== 1) return "conflict" as const;
      await transaction.sessionPause.updateMany({
        where: { focusSessionId: current.id, endedAt: null },
        data: {
          endedAt: command.now,
          endedByCommandId: command.clientCommandId,
        },
      });
      await transaction.focusInterval.update({
        where: { id: current.intervals[0].id },
        data: {
          status: command.skip ? "SKIPPED" : "COMPLETED",
          endedAt: command.now,
          version: { increment: 1 },
        },
      });
      await transaction.focusInterval.create({
        data: {
          focusSessionId: current.id,
          kind: databaseIntervalKind(next.kind),
          cycleNumber: next.cycleNumber,
          plannedSeconds: next.plannedSeconds,
          startedAt: command.now,
        },
      });
      await recordCommand(transaction, command, "ADVANCE_INTERVAL", version);
      await publish(
        transaction,
        command.userId,
        current.id,
        version,
        "FocusIntervalAdvanced",
        command.now,
        {
          from: activeInterval.kind,
          to: next.kind,
          cycleNumber: next.cycleNumber,
          skipped: command.skip,
        },
      );
      return "ok" as const;
    });
    return this.finishCommand(command, result);
  }

  async createPreset(command: Parameters<FocusRepository["createPreset"]>[0]) {
    const replay = await this.prisma.pomodoroPreset.findUnique({
      where: {
        userId_createdByCommandId: {
          userId: command.userId,
          createdByCommandId: command.clientCommandId,
        },
      },
    });
    if (replay) return toPresetView(replay);
    try {
      const preset = await this.prisma.$transaction(async (transaction) => {
        if (command.isDefault)
          await transaction.pomodoroPreset.updateMany({
            where: {
              userId: command.userId,
              isDefault: true,
              archivedAt: null,
            },
            data: { isDefault: false, version: { increment: 1 } },
          });
        return transaction.pomodoroPreset.create({
          data: {
            userId: command.userId,
            name: command.name,
            ...command.config,
            isDefault: command.isDefault,
            createdByCommandId: command.clientCommandId,
          },
        });
      });
      return toPresetView(preset);
    } catch (error) {
      if (isUniqueError(error)) {
        const duplicate = await this.prisma.pomodoroPreset.findUnique({
          where: {
            userId_createdByCommandId: {
              userId: command.userId,
              createdByCommandId: command.clientCommandId,
            },
          },
        });
        if (duplicate) return toPresetView(duplicate);
      }
      throw error;
    }
  }

  async updatePreset(command: Parameters<FocusRepository["updatePreset"]>[0]) {
    const preset = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.pomodoroPreset.findFirst({
        where: {
          id: command.presetId,
          userId: command.userId,
          archivedAt: null,
        },
      });
      if (!current) return null;
      if (current.version !== command.expectedVersion)
        return "conflict" as const;
      if (command.isDefault)
        await transaction.pomodoroPreset.updateMany({
          where: {
            userId: command.userId,
            isDefault: true,
            archivedAt: null,
            id: { not: current.id },
          },
          data: { isDefault: false, version: { increment: 1 } },
        });
      const updated = await transaction.pomodoroPreset.updateMany({
        where: {
          id: current.id,
          userId: command.userId,
          version: current.version,
        },
        data: {
          name: command.name,
          ...command.config,
          isDefault: command.isDefault,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) return "conflict" as const;
      return transaction.pomodoroPreset.findUnique({
        where: { id: current.id },
      });
    });
    return typeof preset === "string" || preset === null
      ? preset
      : toPresetView(preset);
  }

  private async terminal(
    command: FocusCommandContext,
    status: "COMPLETED" | "ABANDONED",
    outcome: string | null,
  ): Promise<FocusMutationResult> {
    const replay = await this.commandReplay(command);
    if (replay) return replay;
    const view = await this.detail(
      command.userId,
      command.sessionId,
      command.now,
    );
    if (!view) return null;
    const result = this.prisma.$transaction(async (transaction) => {
      const current = await activeRecord(transaction, command);
      if (!current) return "missing" as const;
      if (current.version !== command.expectedVersion)
        return "conflict" as const;
      if (!current.intervals[0]) return "invalid_state" as const;
      const version = current.version + 1;
      const updated = await transaction.focusSession.updateMany({
        where: {
          id: current.id,
          userId: command.userId,
          version: current.version,
          status: { in: ["RUNNING", "PAUSED"] },
        },
        data: {
          status,
          completedAt: status === "COMPLETED" ? command.now : null,
          abandonedAt: status === "ABANDONED" ? command.now : null,
          completedFocusSeconds: view.focusedSeconds,
          outcome,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) return "conflict" as const;
      await transaction.sessionPause.updateMany({
        where: { focusSessionId: current.id, endedAt: null },
        data: {
          endedAt: command.now,
          endedByCommandId: command.clientCommandId,
        },
      });
      await transaction.focusInterval.update({
        where: { id: current.intervals[0].id },
        data: {
          status: status === "COMPLETED" ? "COMPLETED" : "SKIPPED",
          endedAt: command.now,
          version: { increment: 1 },
        },
      });
      await recordCommand(
        transaction,
        command,
        status === "COMPLETED" ? "COMPLETE" : "ABANDON",
        version,
      );
      await publish(
        transaction,
        command.userId,
        current.id,
        version,
        status === "COMPLETED"
          ? "FocusSessionCompleted"
          : "FocusSessionAbandoned",
        command.now,
        {
          focusedSeconds: view.focusedSeconds,
          interruptionCount: view.interruptionCount,
        },
      );
      return "ok" as const;
    });
    return this.finishCommand(command, result);
  }

  private async resolveStartReference(
    command: Parameters<FocusRepository["start"]>[0],
  ): Promise<
    | {
        readonly presetId: string | null;
        readonly config: PomodoroConfig | null;
        readonly plannedSeconds: number;
      }
    | "invalid_reference"
  > {
    if (command.draft.goalId) {
      const goal = await this.prisma.goal.findFirst({
        where: {
          id: command.draft.goalId,
          userId: command.userId,
          archivedAt: null,
        },
        select: { id: true },
      });
      if (!goal) return "invalid_reference";
    }
    if (command.draft.kind !== "pomodoro")
      return {
        presetId: null,
        config: null,
        plannedSeconds: command.draft.plannedSeconds,
      };
    if (command.draft.pomodoroPresetId) {
      const preset = await this.prisma.pomodoroPreset.findFirst({
        where: {
          id: command.draft.pomodoroPresetId,
          userId: command.userId,
          archivedAt: null,
        },
      });
      if (!preset) return "invalid_reference";
      const config = presetConfig(preset);
      return {
        presetId: preset.id,
        config,
        plannedSeconds: config.focusSeconds * config.cycles,
      };
    }
    const config = command.draft.pomodoroConfig;
    if (!config) return "invalid_reference";
    return {
      presetId: null,
      config,
      plannedSeconds: config.focusSeconds * config.cycles,
    };
  }

  private async commandReplay(command: FocusCommandContext) {
    const replay = await this.prisma.focusSessionCommand.findUnique({
      where: {
        focusSessionId_clientCommandId: {
          focusSessionId: command.sessionId,
          clientCommandId: command.clientCommandId,
        },
      },
      select: { id: true },
    });
    return replay
      ? this.detail(command.userId, command.sessionId, command.now)
      : null;
  }

  private afterMutation(
    command: FocusCommandContext,
    result: "ok" | "missing" | "conflict" | "invalid_state",
  ): Promise<FocusSessionView | "conflict" | "invalid_state" | null> {
    if (result === "conflict" || result === "invalid_state")
      return Promise.resolve(result);
    if (result === "missing") return Promise.resolve(null);
    return this.detail(
      command.userId,
      command.sessionId,
      command.now,
    ) as Promise<FocusSessionView>;
  }

  private async finishCommand(
    command: FocusCommandContext,
    pending: Promise<"ok" | "missing" | "conflict" | "invalid_state">,
  ): Promise<FocusSessionView | "conflict" | "invalid_state" | null> {
    try {
      return this.afterMutation(command, await pending);
    } catch (error) {
      if (isUniqueError(error)) {
        const replay = await this.commandReplay(command);
        if (replay) return replay;
      }
      throw error;
    }
  }
}

async function activeRecord(
  transaction: TransactionClient,
  command: FocusCommandContext,
) {
  return transaction.focusSession.findFirst({
    where: { id: command.sessionId, userId: command.userId },
    select: {
      id: true,
      status: true,
      version: true,
      intervals: {
        where: { status: { in: ["RUNNING", "PAUSED"] } },
        take: 1,
        select: { id: true },
      },
      pauses: {
        where: { endedAt: null },
        take: 1,
        select: { id: true },
      },
    },
  });
}

async function recordCommand(
  transaction: TransactionClient,
  command: FocusCommandContext,
  type: Parameters<
    TransactionClient["focusSessionCommand"]["create"]
  >[0]["data"]["type"],
  resultVersion: number,
) {
  await transaction.focusSessionCommand.create({
    data: {
      id: randomUUID(),
      focusSessionId: command.sessionId,
      clientCommandId: command.clientCommandId,
      type,
      resultVersion,
      occurredAt: command.now,
    },
  });
}

async function publish(
  transaction: TransactionClient,
  userId: string,
  sessionId: string,
  aggregateVersion: number,
  eventType: string,
  occurredAt: Date,
  payload: Readonly<Record<string, unknown>>,
) {
  await appendOutboxEvent(transaction, {
    userId,
    aggregateType: "FocusSession",
    aggregateId: sessionId,
    aggregateVersion,
    eventType,
    payload,
    occurredAt,
  });
  await transaction.dashboardSnapshot.updateMany({
    where: { userId, staleAfter: { gt: occurredAt } },
    data: { staleAfter: occurredAt, version: { increment: 1 } },
  });
}

function toSessionView(record: SessionRecord, now: Date): FocusSessionView {
  const terminalAt = record.completedAt ?? record.abandonedAt;
  const activeRecord = record.intervals.find((interval) =>
    ["RUNNING", "PAUSED"].includes(interval.status),
  );
  const intervalViews = record.intervals.map((interval) => {
    const timer = calculateTimer(
      interval.startedAt,
      interval.endedAt,
      interval.plannedSeconds,
      interval.pauses,
      now,
    );
    return {
      id: interval.id,
      kind: interval.kind.toLowerCase() as FocusIntervalKind,
      status: interval.status.toLowerCase() as FocusIntervalView["status"],
      cycleNumber: interval.cycleNumber,
      plannedSeconds: interval.plannedSeconds,
      ...timer,
      startedAt: interval.startedAt.toISOString(),
      endedAt: interval.endedAt?.toISOString() ?? null,
    } satisfies FocusIntervalView;
  });
  const sessionTimer = calculateTimer(
    record.startedAt,
    terminalAt,
    record.plannedSeconds,
    record.pauses,
    now,
  );
  const calculatedFocusSeconds = intervalViews.reduce(
    (total, interval) =>
      total + (interval.kind === "focus" ? interval.elapsedSeconds : 0),
    0,
  );
  return {
    id: record.id,
    goalId: record.goalId,
    goalTitle: record.goal?.title ?? null,
    pomodoroPresetId: record.pomodoroPresetId,
    kind: record.kind.toLowerCase() as FocusSessionView["kind"],
    status: record.status.toLowerCase() as FocusSessionView["status"],
    intent: record.intent,
    plannedSeconds: record.plannedSeconds,
    focusedSeconds: record.completedFocusSeconds ?? calculatedFocusSeconds,
    pausedSeconds: sessionTimer.pausedSeconds,
    interruptionCount: record.interruptions.length,
    timeZone: record.timeZone,
    startedAt: record.startedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    abandonedAt: record.abandonedAt?.toISOString() ?? null,
    outcome: record.outcome,
    version: record.version,
    activeInterval: activeRecord
      ? (intervalViews.find((interval) => interval.id === activeRecord.id) ??
        null)
      : null,
    pomodoroConfig: parseConfig(record.pomodoroConfig),
    serverNow: now.toISOString(),
  };
}

function toPresetView(record: PresetRecord): PomodoroPresetView {
  return {
    id: record.id,
    name: record.name,
    ...presetConfig(record),
    isDefault: record.isDefault,
    version: record.version,
  };
}

function presetConfig(record: PresetRecord): PomodoroConfig {
  return {
    focusSeconds: record.focusSeconds,
    shortBreakSeconds: record.shortBreakSeconds,
    longBreakSeconds: record.longBreakSeconds,
    cycles: record.cycles,
    longBreakEvery: record.longBreakEvery,
    autoStartBreaks: record.autoStartBreaks,
    autoStartFocus: record.autoStartFocus,
    audioEnabled: record.audioEnabled,
    vibrationEnabled: record.vibrationEnabled,
  };
}

function parseConfig(value: Prisma.JsonValue | null): PomodoroConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const config = value as Record<string, unknown>;
  const numbers = [
    "focusSeconds",
    "shortBreakSeconds",
    "longBreakSeconds",
    "cycles",
    "longBreakEvery",
  ] as const;
  const booleans = [
    "autoStartBreaks",
    "autoStartFocus",
    "audioEnabled",
    "vibrationEnabled",
  ] as const;
  if (
    numbers.some((key) => typeof config[key] !== "number") ||
    booleans.some((key) => typeof config[key] !== "boolean")
  )
    return null;
  return config as unknown as PomodoroConfig;
}

function databaseFocusKind(kind: FocusSessionView["kind"]) {
  return kind.toUpperCase() as "DEEP_WORK" | "POMODORO" | "CUSTOM";
}

function databaseIntervalKind(kind: FocusIntervalKind) {
  return kind.toUpperCase() as "FOCUS" | "SHORT_BREAK" | "LONG_BREAK";
}

function isUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
