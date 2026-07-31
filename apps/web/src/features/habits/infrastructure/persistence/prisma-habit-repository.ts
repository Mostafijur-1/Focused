import { randomUUID } from "node:crypto";

import type { FocusedPrismaClient } from "@focused/database";
import { Prisma } from "@focused/database/generated/client";

import type {
  HabitCheckInCommand,
  HabitCreateCommand,
  HabitExpansionCommand,
  HabitPauseCommand,
  HabitRepository,
  HabitStateCommand,
  HabitUpdateCommand,
} from "@/features/habits/application/ports";
import {
  calculateConsistency,
  addDays,
  isPausedOn,
  occurrenceDates,
} from "@/features/habits/domain/habit-schedule";
import type {
  HabitEntryView,
  HabitHistoryPage,
  HabitKind,
  HabitListView,
  HabitOccurrenceStatus,
  HabitOccurrenceView,
  HabitSchedule,
  HabitScheduleVersionView,
  HabitSummary,
} from "@/features/habits/domain/habit-types";
import { appendOutboxEvent } from "@/features/platform-data/infrastructure/persistence/prisma-durable-work-store";
import { AppError } from "@/lib/errors/app-error";

type TransactionClient = Parameters<
  Parameters<FocusedPrismaClient["$transaction"]>[0]
>[0];

const summaryInclude = {
  currentScheduleVersion: true,
  occurrences: {
    orderBy: { localDate: "desc" },
    take: 42,
    include: { entry: true },
  },
} satisfies Prisma.HabitInclude;

type HabitRecord = Prisma.HabitGetPayload<{ include: typeof summaryInclude }>;

export class PrismaHabitRepository implements HabitRepository {
  constructor(private readonly prisma: FocusedPrismaClient) {}

  async listExpansionCandidates(
    afterUserId: string | undefined,
    limit: number,
  ) {
    const members = await this.prisma.user.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        habits: { some: { archivedAt: null } },
        ...(afterUserId ? { id: { gt: afterUserId } } : {}),
      },
      orderBy: { id: "asc" },
      take: Math.min(Math.max(limit, 1), 100),
      select: { id: true },
    });
    return members.map((member) => member.id);
  }

  async getProfile(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timeZone: true },
    });
    if (!profile)
      throw new AppError({
        code: "NOT_FOUND",
        safeMessage: "Profile not found.",
      });
    return profile;
  }

  async countActive(userId: string): Promise<number> {
    return this.prisma.habit.count({ where: { userId, archivedAt: null } });
  }

  async expandOccurrences(command: HabitExpansionCommand): Promise<number> {
    const habits = await this.prisma.habit.findMany({
      where: {
        userId: command.userId,
        archivedAt: null,
        startsOn: { lte: databaseDate(command.through) },
      },
      take: 100,
      select: {
        id: true,
        startsOn: true,
        pauses: {
          where: {
            startsOn: { lte: databaseDate(command.through) },
            OR: [
              { endsOn: null },
              { endsOn: { gte: databaseDate(command.from) } },
            ],
          },
          select: { startsOn: true, endsOn: true },
        },
        scheduleVersions: {
          where: {
            effectiveFrom: { lte: databaseDate(command.through) },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: databaseDate(command.from) } },
            ],
          },
          orderBy: { revision: "desc" },
        },
      },
    });
    const rows = habits.flatMap((habit) =>
      habit.scheduleVersions.flatMap((version) => {
        const schedule = parseSchedule(version.rule);
        if (!schedule) return [];
        const startsOn = isoDate(habit.startsOn);
        const from = maxDate(
          command.from,
          startsOn,
          isoDate(version.effectiveFrom),
        );
        const through = minDate(
          command.through,
          version.effectiveTo ? isoDate(version.effectiveTo) : command.through,
        );
        if (through < from) return [];
        const pauses = habit.pauses.map((pause) => ({
          startsOn: isoDate(pause.startsOn),
          endsOn: pause.endsOn ? isoDate(pause.endsOn) : null,
        }));
        return occurrenceDates(schedule, startsOn, from, through).map(
          (localDate) => ({
            habitId: habit.id,
            scheduleVersionId: version.id,
            localDate: databaseDate(localDate),
            timeZone: version.timeZone,
            targetValue: version.targetValue,
            unit: version.unit,
            status: isPausedOn(localDate, pauses)
              ? ("EXCUSED" as const)
              : ("DUE" as const),
            updatedAt: command.now,
          }),
        );
      }),
    );
    if (rows.length === 0) return 0;
    const result = await this.prisma.habitOccurrence.createMany({
      data: rows,
      skipDuplicates: true,
    });
    return result.count;
  }

  async list(userId: string, localDate: string): Promise<HabitListView> {
    const [profile, habits] = await Promise.all([
      this.getProfile(userId),
      this.prisma.habit.findMany({
        where: { userId },
        orderBy: [{ archivedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        take: 150,
        include: summaryInclude,
      }),
    ]);
    const summaries = habits.flatMap((habit) => {
      const summary = toSummary(habit, localDate);
      return summary ? [summary] : [];
    });
    const syncToken = habits.reduce(
      (latest, habit) => (habit.updatedAt > latest ? habit.updatedAt : latest),
      new Date(0),
    );
    return {
      localDate,
      timeZone: profile.timeZone,
      active: summaries.filter((habit) => !habit.archived),
      archived: summaries.filter((habit) => habit.archived),
      syncToken: syncToken.toISOString(),
    };
  }

  async findSummary(userId: string, habitId: string, localDate: string) {
    const habit = await this.prisma.habit.findFirst({
      where: { id: habitId, userId },
      include: summaryInclude,
    });
    return habit ? toSummary(habit, localDate) : null;
  }

  async create(command: HabitCreateCommand): Promise<HabitSummary> {
    const replay = await this.prisma.habit.findUnique({
      where: {
        userId_createdByCommandId: {
          userId: command.userId,
          createdByCommandId: command.clientCommandId,
        },
      },
      select: { id: true },
    });
    if (replay)
      return this.requireSummary(command.userId, replay.id, command.startsOn);
    const habitId = randomUUID();
    const scheduleId = randomUUID();
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.habit.create({
          data: {
            id: habitId,
            userId: command.userId,
            title: command.title,
            kind: databaseKind(command.kind),
            targetValue: command.target.value,
            unit: command.target.unit,
            schedule: command.schedule as Prisma.InputJsonValue,
            startsOn: databaseDate(command.startsOn),
            createdByCommandId: command.clientCommandId,
          },
        });
        await transaction.habitScheduleVersion.create({
          data: {
            id: scheduleId,
            habitId,
            revision: 1,
            kind: databaseScheduleKind(command.schedule),
            rule: command.schedule as Prisma.InputJsonValue,
            targetValue: command.target.value,
            unit: command.target.unit,
            timeZone: command.timeZone,
            effectiveFrom: databaseDate(command.startsOn),
          },
        });
        await transaction.habit.update({
          where: { id: habitId },
          data: { currentScheduleVersionId: scheduleId },
        });
        await publish(
          transaction,
          command.userId,
          habitId,
          1,
          "HabitCreated",
          command.now,
          {
            habitId,
            scheduleRevision: 1,
          },
        );
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      const concurrentReplay = await this.prisma.habit.findUnique({
        where: {
          userId_createdByCommandId: {
            userId: command.userId,
            createdByCommandId: command.clientCommandId,
          },
        },
        select: { id: true },
      });
      if (!concurrentReplay) throw error;
      return this.requireSummary(
        command.userId,
        concurrentReplay.id,
        command.startsOn,
      );
    }
    await this.expandOccurrences({
      userId: command.userId,
      from: command.startsOn,
      through: addDays(command.startsOn, 14),
      now: command.now,
    });
    return this.requireSummary(command.userId, habitId, command.startsOn);
  }

  async update(command: HabitUpdateCommand) {
    const result = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.habit.findFirst({
        where: { id: command.habitId, userId: command.userId },
        select: {
          id: true,
          version: true,
          currentScheduleVersionId: true,
          currentScheduleVersion: {
            select: { revision: true, effectiveFrom: true },
          },
        },
      });
      if (!current) return null;
      if (
        current.version !== command.expectedVersion ||
        !current.currentScheduleVersion
      )
        return "conflict" as const;
      const nextVersion = current.version + 1;
      const nextRevision = current.currentScheduleVersion.revision + 1;
      const scheduleId = randomUUID();
      const priorEffectiveTo =
        command.effectiveOn >
        isoDate(current.currentScheduleVersion.effectiveFrom)
          ? addDays(command.effectiveOn, -1)
          : command.effectiveOn;
      const locked = await transaction.habit.updateMany({
        where: {
          id: command.habitId,
          userId: command.userId,
          version: command.expectedVersion,
        },
        data: {
          title: command.title,
          kind: databaseKind(command.kind),
          targetValue: command.target.value,
          unit: command.target.unit,
          schedule: command.schedule as Prisma.InputJsonValue,
          version: nextVersion,
        },
      });
      if (locked.count !== 1) return "conflict" as const;
      await transaction.habitScheduleVersion.updateMany({
        where: { id: current.currentScheduleVersionId!, effectiveTo: null },
        data: { effectiveTo: databaseDate(priorEffectiveTo) },
      });
      await transaction.habitScheduleVersion.create({
        data: {
          id: scheduleId,
          habitId: command.habitId,
          revision: nextRevision,
          kind: databaseScheduleKind(command.schedule),
          rule: command.schedule as Prisma.InputJsonValue,
          targetValue: command.target.value,
          unit: command.target.unit,
          timeZone: command.timeZone,
          effectiveFrom: databaseDate(command.effectiveOn),
        },
      });
      await transaction.habit.update({
        where: { id: command.habitId },
        data: { currentScheduleVersionId: scheduleId },
      });
      await transaction.habitOccurrence.deleteMany({
        where: {
          habitId: command.habitId,
          localDate: { gte: databaseDate(command.effectiveOn) },
          entry: null,
        },
      });
      await publish(
        transaction,
        command.userId,
        command.habitId,
        nextVersion,
        "HabitScheduleChanged",
        command.now,
        {
          habitId: command.habitId,
          scheduleRevision: nextRevision,
          effectiveOn: command.effectiveOn,
        },
      );
      return "updated" as const;
    });
    if (result !== "updated") return result;
    await this.expandOccurrences({
      userId: command.userId,
      from: command.effectiveOn,
      through: addDays(command.effectiveOn, 14),
      now: command.now,
    });
    return this.requireSummary(
      command.userId,
      command.habitId,
      command.effectiveOn,
    );
  }

  async setArchived(command: HabitStateCommand, archived: boolean) {
    const changed = await this.prisma.$transaction(async (transaction) => {
      const current = await ownerVersion(transaction, command);
      if (current === null || current === "conflict") return current;
      const version = current.version + 1;
      const locked = await transaction.habit.updateMany({
        where: {
          id: command.habitId,
          userId: command.userId,
          version: command.expectedVersion,
        },
        data: { archivedAt: archived ? command.now : null, version },
      });
      if (locked.count !== 1) return "conflict" as const;
      await publish(
        transaction,
        command.userId,
        command.habitId,
        version,
        archived ? "HabitArchived" : "HabitRestored",
        command.now,
        { habitId: command.habitId },
      );
      return "updated" as const;
    });
    return changed === "updated"
      ? this.requireSummary(command.userId, command.habitId, command.localDate)
      : changed;
  }

  async pause(command: HabitPauseCommand) {
    const changed = await this.prisma.$transaction(async (transaction) => {
      const current = await ownerVersion(transaction, command);
      if (current === null || current === "conflict") return current;
      const activePause = await transaction.habitPause.findFirst({
        where: { habitId: command.habitId, endsOn: null },
        select: { id: true },
      });
      if (activePause) return "conflict" as const;
      const version = current.version + 1;
      const locked = await transaction.habit.updateMany({
        where: {
          id: command.habitId,
          userId: command.userId,
          version: command.expectedVersion,
        },
        data: { pausedAt: command.now, version },
      });
      if (locked.count !== 1) return "conflict" as const;
      await transaction.habitPause.create({
        data: {
          habitId: command.habitId,
          startsOn: databaseDate(command.localDate),
          reason: command.reason,
        },
      });
      await transaction.habitOccurrence.updateMany({
        where: {
          habitId: command.habitId,
          localDate: { gte: databaseDate(command.localDate) },
          status: "DUE",
          entry: null,
        },
        data: { status: "EXCUSED", version: { increment: 1 } },
      });
      await publish(
        transaction,
        command.userId,
        command.habitId,
        version,
        "HabitPaused",
        command.now,
        { habitId: command.habitId, startsOn: command.localDate },
      );
      return "updated" as const;
    });
    return changed === "updated"
      ? this.requireSummary(command.userId, command.habitId, command.localDate)
      : changed;
  }

  async resume(command: HabitStateCommand) {
    const changed = await this.prisma.$transaction(async (transaction) => {
      const current = await ownerVersion(transaction, command);
      if (current === null || current === "conflict") return current;
      const activePause = await transaction.habitPause.findFirst({
        where: { habitId: command.habitId, endsOn: null },
        select: { id: true },
      });
      if (!activePause) return "conflict" as const;
      const version = current.version + 1;
      const locked = await transaction.habit.updateMany({
        where: {
          id: command.habitId,
          userId: command.userId,
          version: command.expectedVersion,
        },
        data: { pausedAt: null, version },
      });
      if (locked.count !== 1) return "conflict" as const;
      await transaction.habitPause.update({
        where: { id: activePause.id },
        data: {
          endsOn: databaseDate(command.localDate),
          resumedAt: command.now,
          version: { increment: 1 },
        },
      });
      await publish(
        transaction,
        command.userId,
        command.habitId,
        version,
        "HabitResumed",
        command.now,
        { habitId: command.habitId, effectiveAfter: command.localDate },
      );
      return "updated" as const;
    });
    return changed === "updated"
      ? this.requireSummary(command.userId, command.habitId, command.localDate)
      : changed;
  }

  async recordEntry(command: HabitCheckInCommand) {
    const result = await this.prisma.$transaction(async (transaction) => {
      const habit = await transaction.habit.findFirst({
        where: { id: command.habitId, userId: command.userId },
        select: { id: true, archivedAt: true, version: true },
      });
      if (!habit) return null;
      if (habit.archivedAt) return "conflict" as const;
      const occurrence = await transaction.habitOccurrence.findUnique({
        where: {
          habitId_localDate: {
            habitId: command.habitId,
            localDate: databaseDate(command.localDate),
          },
        },
        include: { entry: true },
      });
      if (!occurrence || occurrence.status === "EXCUSED")
        return "not_due" as const;
      if (occurrence.entry?.clientCommandId === command.clientCommandId)
        return "replay" as const;
      if (occurrence.entry) {
        const replayedRevision =
          await transaction.habitEntryRevision.findUnique({
            where: {
              entryId_clientCommandId: {
                entryId: occurrence.entry.id,
                clientCommandId: command.clientCommandId,
              },
            },
            select: { id: true },
          });
        if (replayedRevision) return "replay" as const;
      }
      const status = command.skippedReason
        ? "SKIPPED"
        : command.completed
          ? "COMPLETED"
          : "DUE";
      const nextHabitVersion = habit.version + 1;
      const locked = await transaction.habit.updateMany({
        where: {
          id: command.habitId,
          userId: command.userId,
          version: habit.version,
        },
        data: { version: nextHabitVersion },
      });
      if (locked.count !== 1) return "conflict" as const;
      if (occurrence.entry) {
        if (
          command.expectedVersion === undefined ||
          occurrence.entry.version !== command.expectedVersion
        )
          return "conflict" as const;
        await transaction.habitEntryRevision.updateMany({
          where: {
            entryId: occurrence.entry.id,
            revision: occurrence.entry.version,
            supersededAt: null,
          },
          data: { supersededAt: command.now },
        });
        const nextEntryVersion = occurrence.entry.version + 1;
        await transaction.habitEntry.update({
          where: { id: occurrence.entry.id },
          data: {
            clientCommandId: command.clientCommandId,
            value: command.value,
            completed: command.completed,
            skippedReason: command.skippedReason,
            note: command.note,
            evidenceRef: command.evidenceRef,
            correctedAt: command.now,
            undoneAt: null,
            version: nextEntryVersion,
          },
        });
        await transaction.habitEntryRevision.create({
          data: {
            entryId: occurrence.entry.id,
            revision: nextEntryVersion,
            value: command.value,
            completed: command.completed,
            skippedReason: command.skippedReason,
            note: command.note,
            evidenceRef: command.evidenceRef,
            source: "MANUAL",
            clientCommandId: command.clientCommandId,
            recordedAt: command.now,
          },
        });
      } else {
        const entry = await transaction.habitEntry.create({
          data: {
            habitId: command.habitId,
            occurrenceId: occurrence.id,
            clientCommandId: command.clientCommandId,
            localDate: databaseDate(command.localDate),
            timeZone: command.timeZone,
            value: command.value,
            completed: command.completed,
            skippedReason: command.skippedReason,
            note: command.note,
            evidenceRef: command.evidenceRef,
            recordedAt: command.now,
          },
        });
        await transaction.habitEntryRevision.create({
          data: {
            entryId: entry.id,
            revision: 1,
            value: command.value,
            completed: command.completed,
            skippedReason: command.skippedReason,
            note: command.note,
            evidenceRef: command.evidenceRef,
            source: "MANUAL",
            clientCommandId: command.clientCommandId,
            recordedAt: command.now,
          },
        });
      }
      await transaction.habitOccurrence.update({
        where: { id: occurrence.id },
        data: { status, version: { increment: 1 } },
      });
      await publish(
        transaction,
        command.userId,
        command.habitId,
        nextHabitVersion,
        "HabitEntryRecorded",
        command.now,
        {
          habitId: command.habitId,
          localDate: command.localDate,
          status: status.toLowerCase(),
          clientCommandId: command.clientCommandId,
        },
      );
      return "updated" as const;
    });
    if (result === "updated" || result === "replay") {
      return this.requireSummary(
        command.userId,
        command.habitId,
        command.localDate,
      );
    }
    return result;
  }

  async undoEntry(
    command: HabitStateCommand & { readonly clientCommandId: string },
  ) {
    const changed = await this.prisma.$transaction(async (transaction) => {
      const habit = await transaction.habit.findFirst({
        where: { id: command.habitId, userId: command.userId },
        select: { version: true },
      });
      if (!habit) return null;
      const occurrence = await transaction.habitOccurrence.findUnique({
        where: {
          habitId_localDate: {
            habitId: command.habitId,
            localDate: databaseDate(command.localDate),
          },
        },
        include: { entry: true },
      });
      if (!occurrence?.entry) return "conflict" as const;
      if (occurrence.entry.clientCommandId === command.clientCommandId)
        return "replay" as const;
      const replayedRevision = await transaction.habitEntryRevision.findUnique({
        where: {
          entryId_clientCommandId: {
            entryId: occurrence.entry.id,
            clientCommandId: command.clientCommandId,
          },
        },
        select: { id: true },
      });
      if (replayedRevision) return "replay" as const;
      if (occurrence.entry.version !== command.expectedVersion)
        return "conflict" as const;
      const version = habit.version + 1;
      const locked = await transaction.habit.updateMany({
        where: {
          id: command.habitId,
          userId: command.userId,
          version: habit.version,
        },
        data: { version },
      });
      if (locked.count !== 1) return "conflict" as const;
      const revision = occurrence.entry.version + 1;
      await transaction.habitEntryRevision.updateMany({
        where: { entryId: occurrence.entry.id, supersededAt: null },
        data: { supersededAt: command.now },
      });
      await transaction.habitEntry.update({
        where: { id: occurrence.entry.id },
        data: {
          clientCommandId: command.clientCommandId,
          undoneAt: command.now,
          correctedAt: command.now,
          version: revision,
        },
      });
      await transaction.habitEntryRevision.create({
        data: {
          entryId: occurrence.entry.id,
          revision,
          value: occurrence.entry.value,
          completed: occurrence.entry.completed,
          skippedReason: occurrence.entry.skippedReason,
          note: occurrence.entry.note,
          evidenceRef: occurrence.entry.evidenceRef,
          source: occurrence.entry.source,
          clientCommandId: command.clientCommandId,
          recordedAt: command.now,
          undone: true,
        },
      });
      await transaction.habitOccurrence.update({
        where: { id: occurrence.id },
        data: { status: "DUE", version: { increment: 1 } },
      });
      await publish(
        transaction,
        command.userId,
        command.habitId,
        version,
        "HabitEntryCorrected",
        command.now,
        {
          habitId: command.habitId,
          localDate: command.localDate,
          undone: true,
        },
      );
      return "updated" as const;
    });
    return changed === "updated" || changed === "replay"
      ? this.requireSummary(command.userId, command.habitId, command.localDate)
      : changed;
  }

  async history(
    userId: string,
    habitId: string,
    localDate: string,
    cursor?: string,
  ): Promise<HabitHistoryPage | null> {
    const habit = await this.prisma.habit.findFirst({
      where: { id: habitId, userId },
      include: summaryInclude,
    });
    if (!habit) return null;
    const occurrences = await this.prisma.habitOccurrence.findMany({
      where: {
        habitId,
        ...(cursor ? { localDate: { lt: databaseDate(cursor) } } : {}),
      },
      orderBy: { localDate: "desc" },
      take: 43,
      include: { entry: true },
    });
    const hasMore = occurrences.length > 42;
    const page = occurrences.slice(0, 42);
    return {
      habit: toSummary(habit, localDate)!,
      occurrences: page.map(toOccurrence),
      nextCursor: hasMore ? isoDate(page.at(-1)!.localDate) : null,
    };
  }

  private async requireSummary(
    userId: string,
    habitId: string,
    localDate: string,
  ): Promise<HabitSummary> {
    const summary = await this.findSummary(userId, habitId, localDate);
    if (!summary)
      throw new Error("Habit disappeared after a committed mutation.");
    return summary;
  }
}

async function ownerVersion(
  transaction: TransactionClient,
  command: HabitStateCommand,
) {
  const habit = await transaction.habit.findFirst({
    where: { id: command.habitId, userId: command.userId },
    select: { version: true },
  });
  if (!habit) return null;
  return habit.version === command.expectedVersion
    ? habit
    : ("conflict" as const);
}

async function publish(
  transaction: TransactionClient,
  userId: string,
  habitId: string,
  aggregateVersion: number,
  eventType: string,
  occurredAt: Date,
  payload: Readonly<Record<string, unknown>>,
) {
  const eventId = await appendOutboxEvent(transaction, {
    userId,
    aggregateType: "Habit",
    aggregateId: habitId,
    aggregateVersion,
    eventType,
    payload,
    occurredAt,
  });
  await transaction.dashboardSnapshot.updateMany({
    where: { userId, staleAfter: { gt: occurredAt } },
    data: { staleAfter: occurredAt, version: { increment: 1 } },
  });
  return eventId;
}

function toSummary(habit: HabitRecord, localDate: string): HabitSummary | null {
  if (!habit.currentScheduleVersion) return null;
  const scheduleVersion = toScheduleVersion(habit.currentScheduleVersion);
  if (!scheduleVersion) return null;
  const occurrences = habit.occurrences.map(toOccurrence);
  return {
    id: habit.id,
    title: habit.title,
    kind: applicationKind(habit.kind),
    startsOn: isoDate(habit.startsOn),
    paused: habit.pausedAt !== null,
    archived: habit.archivedAt !== null,
    version: habit.version,
    scheduleVersion,
    today:
      occurrences.find((occurrence) => occurrence.localDate === localDate) ??
      null,
    consistency: calculateConsistency(
      [...occurrences].reverse().map((occurrence) => occurrence.status),
    ),
  };
}

function toScheduleVersion(
  version: HabitRecord["currentScheduleVersion"],
): HabitScheduleVersionView | null {
  if (!version) return null;
  const schedule = parseSchedule(version.rule);
  return schedule
    ? {
        id: version.id,
        revision: version.revision,
        schedule,
        target: {
          value: decimalNumber(version.targetValue),
          unit: version.unit,
        },
        timeZone: version.timeZone,
        effectiveFrom: isoDate(version.effectiveFrom),
        effectiveTo: version.effectiveTo ? isoDate(version.effectiveTo) : null,
      }
    : null;
}

function toOccurrence(
  occurrence: HabitRecord["occurrences"][number],
): HabitOccurrenceView {
  return {
    id: occurrence.id,
    localDate: isoDate(occurrence.localDate),
    status: occurrence.status.toLowerCase() as HabitOccurrenceStatus,
    target: {
      value: decimalNumber(occurrence.targetValue),
      unit: occurrence.unit,
    },
    entry: occurrence.entry ? toEntry(occurrence.entry) : null,
  };
}

function toEntry(
  entry: NonNullable<HabitRecord["occurrences"][number]["entry"]>,
): HabitEntryView {
  return {
    id: entry.id,
    value: decimalNumber(entry.value),
    completed: entry.completed,
    skippedReason: entry.skippedReason,
    note: entry.note,
    evidenceRef: entry.evidenceRef,
    recordedAt: entry.recordedAt.toISOString(),
    correctedAt: entry.correctedAt?.toISOString() ?? null,
    undoneAt: entry.undoneAt?.toISOString() ?? null,
    version: entry.version,
  };
}

function parseSchedule(value: Prisma.JsonValue): HabitSchedule | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.type !== "string"
  )
    return null;
  if (value.type === "daily") return { type: "daily" };
  if (
    value.type === "weekdays" &&
    Array.isArray(value.weekdays) &&
    value.weekdays.every((day) => typeof day === "number")
  ) {
    return { type: "weekdays", weekdays: value.weekdays };
  }
  if (
    value.type === "interval" &&
    typeof value.everyDays === "number" &&
    typeof value.anchorDate === "string"
  ) {
    return {
      type: "interval",
      everyDays: value.everyDays,
      anchorDate: value.anchorDate,
    };
  }
  if (
    value.type === "custom_dates" &&
    Array.isArray(value.dates) &&
    value.dates.every((date) => typeof date === "string")
  ) {
    return { type: "custom_dates", dates: value.dates };
  }
  return null;
}

function databaseKind(kind: HabitKind) {
  return kind.toUpperCase() as "BOOLEAN" | "COUNT" | "DURATION" | "AVOIDANCE";
}

function applicationKind(kind: string): HabitKind {
  return kind.toLowerCase() as HabitKind;
}

function databaseScheduleKind(schedule: HabitSchedule) {
  return schedule.type.toUpperCase() as
    "DAILY" | "WEEKDAYS" | "INTERVAL" | "CUSTOM_DATES";
}

function decimalNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

function databaseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function maxDate(...dates: readonly string[]): string {
  return [...dates].sort().at(-1)!;
}

function minDate(...dates: readonly string[]): string {
  return [...dates].sort()[0]!;
}
