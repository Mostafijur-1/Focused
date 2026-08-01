import { createHash } from "node:crypto";

import type { FocusedPrismaClient } from "@focused/database";
import { Prisma } from "@focused/database/generated/client";

import type { SecretCipher } from "@/features/auth/application/oauth-ports";
import type {
  AnalyticsProjectionResult,
  AnalyticsRepository,
} from "@/features/analytics/application/ports";
import {
  analyticsLimits,
  emptyDailyValues,
} from "@/features/analytics/domain/analytics-policy";
import {
  analyticsMetricVersion,
  type AnalyticsExportFormat,
  type AnalyticsExportView,
  type AnalyticsRange,
  type AnalyticsReportView,
  type AnalyticsSnapshot,
  type DailyAnalyticsValues,
  type GamificationView,
  type StoredAnalyticsDay,
} from "@/features/analytics/domain/analytics-types";
import {
  analyticsDateRange,
  analyticsLocalDate,
  analyticsLocalHour,
  databaseAnalyticsDate,
} from "@/features/analytics/domain/analytics-time";
import { AppError } from "@/lib/errors/app-error";

interface MutableDaily {
  focusedSeconds: number;
  plannedSeconds: number;
  completedSessions: number;
  abandonedSessions: number;
  outcomesCaptured: number;
  interruptionCount: number;
  interruptionsByCategory: Record<string, number>;
  interruptionsByHour: Record<string, number>;
  habitDue: number;
  habitCompleted: number;
  habitSkipped: number;
  habitExcused: number;
  goalCheckIns: number;
  goalProgressTotal: number;
  weeklyPlansFinalized: number;
}

interface MetricFact {
  readonly name: string;
  readonly localDate: string;
  readonly occurredAt: Date;
  readonly value: number;
  readonly sourceEventId: string;
  readonly dimensions: Prisma.InputJsonValue;
}

export class PrismaAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly prisma: FocusedPrismaClient) {}

  async identity(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE", deletedAt: null },
      select: { profile: { select: { timeZone: true } } },
    });
    if (!user?.profile) {
      throw new AppError({
        code: "NOT_FOUND",
        safeMessage: "Analytics profile not found.",
      });
    }
    return user.profile;
  }

  async readProjection(input: {
    readonly userId: string;
    readonly range: AnalyticsRange;
    readonly now: Date;
  }): Promise<AnalyticsProjectionResult> {
    const [stored, cursor, latest] = await Promise.all([
      this.readStoredDays(input),
      this.prisma.analyticsProjectionCursor.findUnique({
        where: { userId: input.userId },
      }),
      this.prisma.outboxEvent.findFirst({
        where: { userId: input.userId },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        select: { id: true, occurredAt: true },
      }),
    ]);
    const expectedDays = analyticsDateRange(
      input.range.start,
      input.range.end,
    ).length;
    const current =
      stored.length === expectedDays &&
      cursor !== null &&
      ((latest === null && cursor.lastEventId === null) ||
        (latest !== null &&
          cursor.lastEventId === latest.id &&
          cursor.lastEventOccurredAt?.getTime() ===
            latest.occurredAt.getTime() &&
          stored.every(
            (item) =>
              item.sourceThrough.getTime() >= latest.occurredAt.getTime(),
          )));
    if (!current) {
      const identity = await this.identity(input.userId);
      return this.rebuildProjection({ ...input, timeZone: identity.timeZone });
    }
    const computedAt = stored.reduce(
      (minimum, item) =>
        item.computedAt < minimum ? item.computedAt : minimum,
      input.now,
    );
    const sourceThrough = stored.reduce(
      (minimum, item) =>
        item.sourceThrough < minimum ? item.sourceThrough : minimum,
      input.now,
    );
    return {
      days: stored.map((item) => ({
        localDate: item.localDate,
        ...item.values,
      })),
      computedAt,
      sourceThrough,
      partial: false,
      limitations: [],
    };
  }

  async rebuildProjection(input: {
    readonly userId: string;
    readonly range: AnalyticsRange;
    readonly timeZone: string;
    readonly now: Date;
  }): Promise<AnalyticsProjectionResult> {
    const localDates = analyticsDateRange(input.range.start, input.range.end);
    const byDate = new Map<string, MutableDaily>(
      localDates.map((date) => [date, mutableDaily()]),
    );
    const broadStart = new Date(`${input.range.start}T00:00:00.000Z`);
    broadStart.setUTCDate(broadStart.getUTCDate() - 2);
    const broadEnd = new Date(`${input.range.end}T23:59:59.999Z`);
    broadEnd.setUTCDate(broadEnd.getUTCDate() + 2);

    const [sessions, interruptions, occurrences, checkIns, plans, latestEvent] =
      await Promise.all([
        this.prisma.focusSession.findMany({
          where: {
            userId: input.userId,
            OR: [
              { completedAt: { gte: broadStart, lte: broadEnd } },
              { abandonedAt: { gte: broadStart, lte: broadEnd } },
            ],
          },
          select: {
            id: true,
            status: true,
            plannedSeconds: true,
            completedFocusSeconds: true,
            timeZone: true,
            completedAt: true,
            abandonedAt: true,
            outcome: true,
          },
        }),
        this.prisma.interruption.findMany({
          where: {
            focusSession: { userId: input.userId },
            occurredAt: { gte: broadStart, lte: broadEnd },
          },
          select: {
            id: true,
            category: true,
            occurredAt: true,
            focusSession: { select: { timeZone: true } },
          },
        }),
        this.prisma.habitOccurrence.findMany({
          where: {
            habit: { userId: input.userId },
            localDate: {
              gte: databaseAnalyticsDate(input.range.start),
              lte: databaseAnalyticsDate(input.range.end),
            },
          },
          select: { id: true, localDate: true, status: true, updatedAt: true },
        }),
        this.prisma.goalCheckIn.findMany({
          where: {
            goal: { userId: input.userId },
            recordedAt: { gte: broadStart, lte: broadEnd },
          },
          select: {
            id: true,
            progress: true,
            recordedAt: true,
            timeZone: true,
          },
        }),
        this.prisma.plan.findMany({
          where: {
            userId: input.userId,
            type: "WEEKLY",
            periodStart: {
              gte: databaseAnalyticsDate(input.range.start),
              lte: databaseAnalyticsDate(input.range.end),
            },
            finalizedAt: { not: null },
          },
          select: { id: true, periodStart: true, finalizedAt: true },
        }),
        this.prisma.outboxEvent.findFirst({
          where: { userId: input.userId },
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          select: { id: true, occurredAt: true },
        }),
      ]);

    const facts: MetricFact[] = [];
    for (const session of sessions) {
      const occurredAt = session.completedAt ?? session.abandonedAt;
      if (!occurredAt) continue;
      const localDate = analyticsLocalDate(occurredAt, session.timeZone);
      const day = byDate.get(localDate);
      if (!day) continue;
      if (session.status === "COMPLETED") {
        const focused = Math.max(0, session.completedFocusSeconds ?? 0);
        day.focusedSeconds += focused;
        day.plannedSeconds += Math.max(0, session.plannedSeconds);
        day.completedSessions += 1;
        if (session.outcome?.trim()) day.outcomesCaptured += 1;
        facts.push({
          name: "focus_seconds",
          localDate,
          occurredAt,
          value: focused,
          sourceEventId: `focus-session:${session.id}`,
          dimensions: { status: "completed" },
        });
      } else if (session.status === "ABANDONED") {
        day.abandonedSessions += 1;
      }
    }

    for (const interruption of interruptions) {
      const interruptionDate = analyticsLocalDate(
        interruption.occurredAt,
        interruption.focusSession.timeZone,
      );
      const day = byDate.get(interruptionDate);
      if (!day) continue;
      const hour = analyticsLocalHour(
        interruption.occurredAt,
        interruption.focusSession.timeZone,
      );
      day.interruptionCount += 1;
      increment(day.interruptionsByCategory, interruption.category);
      increment(day.interruptionsByHour, hour);
      facts.push({
        name: "interruptions_self_reported",
        localDate: interruptionDate,
        occurredAt: interruption.occurredAt,
        value: 1,
        sourceEventId: `interruption:${interruption.id}`,
        dimensions: { category: interruption.category, hour },
      });
    }

    for (const occurrence of occurrences) {
      const localDate = occurrence.localDate.toISOString().slice(0, 10);
      const day = byDate.get(localDate);
      if (!day) continue;
      if (occurrence.status === "COMPLETED") day.habitCompleted += 1;
      else if (occurrence.status === "EXCUSED") day.habitExcused += 1;
      else if (occurrence.status === "SKIPPED") day.habitSkipped += 1;
      else day.habitDue += 1;
      facts.push({
        name: "habit_occurrence",
        localDate,
        occurredAt: occurrence.updatedAt,
        value: occurrence.status === "COMPLETED" ? 1 : 0,
        sourceEventId: `habit-occurrence:${occurrence.id}`,
        dimensions: { status: occurrence.status.toLowerCase() },
      });
    }

    let historicTimezoneFallback = false;
    for (const checkIn of checkIns) {
      const timeZone = checkIn.timeZone ?? input.timeZone;
      historicTimezoneFallback ||= checkIn.timeZone === null;
      const localDate = analyticsLocalDate(checkIn.recordedAt, timeZone);
      const day = byDate.get(localDate);
      if (!day) continue;
      const progress = Number(checkIn.progress);
      day.goalCheckIns += 1;
      day.goalProgressTotal += progress;
      facts.push({
        name: "goal_check_in",
        localDate,
        occurredAt: checkIn.recordedAt,
        value: progress,
        sourceEventId: `goal-check-in:${checkIn.id}`,
        dimensions: {},
      });
    }

    for (const plan of plans) {
      const localDate = plan.periodStart.toISOString().slice(0, 10);
      const day = byDate.get(localDate);
      if (!day || !plan.finalizedAt) continue;
      day.weeklyPlansFinalized += 1;
      facts.push({
        name: "weekly_plan_finalized",
        localDate,
        occurredAt: plan.finalizedAt,
        value: 1,
        sourceEventId: `weekly-plan:${plan.id}`,
        dimensions: {},
      });
    }

    const sourceThrough = input.now;
    await this.prisma.$transaction(async (transaction) => {
      await transaction.metricEvent.deleteMany({
        where: {
          userId: input.userId,
          localDate: {
            gte: databaseAnalyticsDate(input.range.start),
            lte: databaseAnalyticsDate(input.range.end),
          },
        },
      });
      if (facts.length > 0) {
        await transaction.metricEvent.createMany({
          data: facts.map((fact) => ({
            userId: input.userId,
            name: fact.name,
            occurredAt: fact.occurredAt,
            localDate: databaseAnalyticsDate(fact.localDate),
            value: fact.value,
            sourceEventId: fact.sourceEventId,
            dimensions: fact.dimensions,
          })),
          skipDuplicates: true,
        });
      }
      for (const localDate of localDates) {
        const values = byDate.get(localDate)!;
        await transaction.dailyMetricSnapshot.upsert({
          where: {
            userId_localDate_metricVersion: {
              userId: input.userId,
              localDate: databaseAnalyticsDate(localDate),
              metricVersion: analyticsMetricVersion,
            },
          },
          create: {
            userId: input.userId,
            localDate: databaseAnalyticsDate(localDate),
            metricVersion: analyticsMetricVersion,
            values: values as unknown as Prisma.InputJsonValue,
            computedAt: input.now,
            sourceThrough,
          },
          update: {
            values: values as unknown as Prisma.InputJsonValue,
            computedAt: input.now,
            sourceThrough,
          },
        });
      }
      await transaction.analyticsProjectionCursor.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          lastEventId: latestEvent?.id ?? null,
          lastEventOccurredAt: latestEvent?.occurredAt ?? null,
          reconciledAt: input.now,
        },
        update: {
          lastEventId: latestEvent?.id ?? null,
          lastEventOccurredAt: latestEvent?.occurredAt ?? null,
          reconciledAt: input.now,
          version: { increment: 1 },
        },
      });
    });

    const days = localDates.map((localDate) => ({
      localDate,
      ...byDate.get(localDate)!,
    }));
    return {
      days,
      computedAt: input.now,
      sourceThrough,
      partial: false,
      limitations: historicTimezoneFallback
        ? ["historic_goal_check_in_timezone_fallback"]
        : [],
    };
  }

  async readStoredDays(input: {
    readonly userId: string;
    readonly range: AnalyticsRange;
  }): Promise<readonly StoredAnalyticsDay[]> {
    const rows = await this.prisma.dailyMetricSnapshot.findMany({
      where: {
        userId: input.userId,
        metricVersion: analyticsMetricVersion,
        localDate: {
          gte: databaseAnalyticsDate(input.range.start),
          lte: databaseAnalyticsDate(input.range.end),
        },
      },
      orderBy: { localDate: "asc" },
    });
    return rows.map((row) => ({
      localDate: row.localDate.toISOString().slice(0, 10),
      values: parseDaily(row.values),
      computedAt: row.computedAt,
      sourceThrough: row.sourceThrough,
    }));
  }

  async createReport(input: {
    readonly userId: string;
    readonly clientCommandId: string;
    readonly snapshot: AnalyticsSnapshot;
    readonly now: Date;
    readonly expiresAt: Date;
  }): Promise<AnalyticsReportView> {
    const row = await this.prisma.reportJob.upsert({
      where: {
        userId_clientCommandId: {
          userId: input.userId,
          clientCommandId: input.clientCommandId,
        },
      },
      create: {
        userId: input.userId,
        clientCommandId: input.clientCommandId,
        type: "analytics_summary",
        status: "COMPLETED",
        parameters: input.snapshot.range,
        result: input.snapshot as unknown as Prisma.InputJsonValue,
        schemaVersion: analyticsMetricVersion,
        startedAt: input.now,
        completedAt: input.now,
        expiresAt: input.expiresAt,
      },
      update: {},
    });
    if (
      JSON.stringify(row.parameters) !== JSON.stringify(input.snapshot.range)
    ) {
      throw idempotencyConflict();
    }
    return reportView(row);
  }

  async listReports(userId: string): Promise<readonly AnalyticsReportView[]> {
    const rows = await this.prisma.reportJob.findMany({
      where: { userId, type: "analytics_summary", status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return rows.flatMap((row) => (row.result ? [reportView(row)] : []));
  }

  async createExport(input: {
    readonly userId: string;
    readonly clientCommandId: string;
    readonly snapshot: AnalyticsSnapshot;
    readonly format: AnalyticsExportFormat;
    readonly cipher: SecretCipher;
    readonly now: Date;
    readonly expiresAt: Date;
  }): Promise<AnalyticsExportView> {
    const content =
      input.format === "csv"
        ? analyticsCsv(input.snapshot)
        : JSON.stringify(input.snapshot, null, 2);
    const sizeBytes = Buffer.byteLength(content, "utf8");
    if (sizeBytes > analyticsLimits.maximumArtifactBytes) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        status: 422,
        safeMessage: "The export is too large. Choose a shorter date range.",
      });
    }
    const checksum = createHash("sha256").update(content).digest("hex");
    const extension = input.format;
    const contentType =
      input.format === "csv"
        ? "text/csv; charset=utf-8"
        : "application/json; charset=utf-8";
    const fileName = `focused-analytics-${input.snapshot.range.start}-${input.snapshot.range.end}.${extension}`;
    const row = await this.prisma.exportJob.upsert({
      where: {
        userId_clientCommandId: {
          userId: input.userId,
          clientCommandId: input.clientCommandId,
        },
      },
      create: {
        userId: input.userId,
        clientCommandId: input.clientCommandId,
        status: "COMPLETED",
        categories: ["analytics"],
        rangeStart: databaseAnalyticsDate(input.snapshot.range.start),
        rangeEnd: databaseAnalyticsDate(input.snapshot.range.end),
        schemaVersion: analyticsMetricVersion,
        format: input.format,
        fileName,
        contentType,
        artifactEncrypted: input.cipher.encrypt(content),
        encryptionKeyId: "auth-data-v1",
        checksum,
        sizeBytes,
        completedAt: input.now,
        expiresAt: input.expiresAt,
      },
      update: {},
    });
    if (
      row.format !== input.format ||
      row.rangeStart?.toISOString().slice(0, 10) !==
        input.snapshot.range.start ||
      row.rangeEnd?.toISOString().slice(0, 10) !== input.snapshot.range.end
    ) {
      throw idempotencyConflict();
    }
    return exportView(row);
  }

  async listExports(userId: string): Promise<readonly AnalyticsExportView[]> {
    const rows = await this.prisma.exportJob.findMany({
      where: { userId, categories: { has: "analytics" }, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return rows.flatMap((row) =>
      row.fileName && row.contentType && row.checksum ? [exportView(row)] : [],
    );
  }

  async downloadExport(input: {
    readonly userId: string;
    readonly exportId: string;
    readonly cipher: SecretCipher;
    readonly now: Date;
  }) {
    const row = await this.prisma.exportJob.findFirst({
      where: {
        id: input.exportId,
        userId: input.userId,
        categories: { has: "analytics" },
      },
    });
    if (
      !row?.artifactEncrypted ||
      !row.fileName ||
      !row.contentType ||
      !row.checksum
    )
      return "not_found" as const;
    if (!row.expiresAt || row.expiresAt <= input.now) return "expired" as const;
    const content = input.cipher.decrypt(row.artifactEncrypted);
    const checksum = createHash("sha256").update(content).digest("hex");
    if (checksum !== row.checksum) {
      throw new AppError({
        code: "INTERNAL_ERROR",
        safeMessage: "Export integrity check failed.",
      });
    }
    await this.prisma.exportJob.update({
      where: { id: row.id },
      data: { downloadedAt: input.now },
    });
    return {
      content,
      contentType: row.contentType,
      fileName: row.fileName,
      checksum,
    };
  }

  async gamification(userId: string): Promise<GamificationView> {
    const [preference, level, nextLevel, awards, streaks] = await Promise.all([
      this.prisma.analyticsPreference.findUnique({ where: { userId } }),
      this.prisma.userLevel.findUnique({
        where: { userId },
        include: { levelDefinition: true },
      }),
      this.prisma.levelDefinition.findFirst({
        where: { active: true },
        orderBy: { minimumXp: "asc" },
      }),
      this.prisma.achievementAward.findMany({
        where: { userId, revokedAt: null },
        include: { definition: true },
        orderBy: { awardedAt: "desc" },
        take: 20,
      }),
      this.prisma.streak.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ]);
    const currentXp = level?.totalXp ?? 0;
    const following = await this.prisma.levelDefinition.findFirst({
      where: { active: true, minimumXp: { gt: currentXp } },
      orderBy: { minimumXp: "asc" },
    });
    return {
      enabled: preference?.gamificationEnabled ?? true,
      version: preference?.version ?? 1,
      totalXp: currentXp,
      level: level?.levelDefinition.level ?? nextLevel?.level ?? 1,
      levelTitle: level?.levelDefinition.title ?? nextLevel?.title ?? "শুরু",
      nextLevelXp: following?.minimumXp ?? null,
      achievements: awards.map((award) => ({
        key: award.definition.key,
        title: award.definition.title,
        awardedAt: award.awardedAt.toISOString(),
      })),
      streaks: streaks.map((streak) => ({
        subjectType: streak.subjectType,
        currentCount: streak.currentCount,
        bestCount: streak.bestCount,
        lastQualifiedDate:
          streak.lastQualifiedDate?.toISOString().slice(0, 10) ?? null,
      })),
    };
  }

  async setGamification(input: {
    readonly userId: string;
    readonly enabled: boolean;
    readonly expectedVersion: number;
  }) {
    const existing = await this.prisma.analyticsPreference.findUnique({
      where: { userId: input.userId },
    });
    if (!existing && input.expectedVersion === 1) {
      try {
        await this.prisma.analyticsPreference.create({
          data: { userId: input.userId, gamificationEnabled: input.enabled },
        });
        return this.gamification(input.userId);
      } catch (error) {
        if (isUniqueConstraintError(error)) return "conflict" as const;
        throw error;
      }
    }
    const changed = await this.prisma.analyticsPreference.updateMany({
      where: { userId: input.userId, version: input.expectedVersion },
      data: { gamificationEnabled: input.enabled, version: { increment: 1 } },
    });
    return changed.count === 1
      ? this.gamification(input.userId)
      : ("conflict" as const);
  }

  async reconcileGamification(input: {
    readonly userId: string;
    readonly snapshot: AnalyticsSnapshot;
    readonly now: Date;
  }): Promise<void> {
    const preference = await this.prisma.analyticsPreference.findUnique({
      where: { userId: input.userId },
    });
    if (preference?.gamificationEnabled === false) return;
    await this.prisma.$transaction(async (transaction) => {
      for (const day of input.snapshot.daily) {
        const amount = Math.min(
          50,
          day.completedSessions * 10 + day.habitCompleted * 2,
        );
        if (amount === 0) continue;
        const sourceEventId = `analytics:${input.snapshot.metricVersion}:${day.localDate}`;
        await transaction.xPLedgerEntry.upsert({
          where: {
            userId_sourceEventId_ruleKey: {
              userId: input.userId,
              sourceEventId,
              ruleKey: "positive_progress",
            },
          },
          create: {
            userId: input.userId,
            amount,
            ruleKey: "positive_progress",
            ruleVersion: 1,
            sourceEventId,
          },
          update: {},
        });
      }
      const total = await transaction.xPLedgerEntry.aggregate({
        where: { userId: input.userId },
        _sum: { amount: true },
      });
      const totalXp = Math.max(0, total._sum.amount ?? 0);
      const definition = await transaction.levelDefinition.findFirst({
        where: { active: true, minimumXp: { lte: totalXp } },
        orderBy: { minimumXp: "desc" },
      });
      if (definition) {
        await transaction.userLevel.upsert({
          where: { userId: input.userId },
          create: {
            userId: input.userId,
            levelDefinitionId: definition.id,
            totalXp,
          },
          update: { levelDefinitionId: definition.id, totalXp },
        });
      }
    });
  }
}

function mutableDaily(): MutableDaily {
  return {
    ...emptyDailyValues(),
    interruptionsByCategory: {},
    interruptionsByHour: {},
  };
}

function increment(values: Record<string, number>, key: string) {
  values[key] = (values[key] ?? 0) + 1;
}

function parseDaily(value: Prisma.JsonValue): DailyAnalyticsValues {
  const item = value as Partial<DailyAnalyticsValues>;
  return {
    ...emptyDailyValues(),
    ...item,
    interruptionsByCategory: item.interruptionsByCategory ?? {},
    interruptionsByHour: item.interruptionsByHour ?? {},
  };
}

function reportView(row: {
  id: string;
  type: string;
  status: string;
  schemaVersion: string;
  createdAt: Date;
  expiresAt: Date | null;
  result: Prisma.JsonValue | null;
}): AnalyticsReportView {
  return {
    id: row.id,
    type: "analytics_summary",
    status: "completed",
    schemaVersion: analyticsMetricVersion,
    createdAt: row.createdAt.toISOString(),
    expiresAt: (row.expiresAt ?? row.createdAt).toISOString(),
    snapshot: row.result as unknown as AnalyticsSnapshot,
  };
}

function exportView(row: {
  id: string;
  status: string;
  format: string;
  fileName: string | null;
  contentType: string | null;
  checksum: string | null;
  sizeBytes: bigint | null;
  createdAt: Date;
  expiresAt: Date | null;
}): AnalyticsExportView {
  return {
    id: row.id,
    status: "completed",
    format: row.format === "csv" ? "csv" : "json",
    fileName: row.fileName ?? "focused-analytics.json",
    contentType: row.contentType ?? "application/json",
    checksum: row.checksum ?? "",
    sizeBytes: Number(row.sizeBytes ?? 0),
    createdAt: row.createdAt.toISOString(),
    expiresAt: (row.expiresAt ?? row.createdAt).toISOString(),
  };
}

function analyticsCsv(snapshot: AnalyticsSnapshot): string {
  const header = [
    "date",
    "focused_seconds",
    "planned_seconds",
    "completed_sessions",
    "abandoned_sessions",
    "self_reported_interruptions",
    "habit_due",
    "habit_completed",
    "habit_skipped",
    "habit_excused",
    "goal_check_ins",
    "weekly_plans_finalized",
  ];
  const rows = snapshot.daily.map((day) => [
    day.localDate,
    day.focusedSeconds,
    day.plannedSeconds,
    day.completedSessions,
    day.abandonedSessions,
    day.interruptionCount,
    day.habitDue + day.habitCompleted + day.habitSkipped + day.habitExcused,
    day.habitCompleted,
    day.habitSkipped,
    day.habitExcused,
    day.goalCheckIns,
    day.weeklyPlansFinalized,
  ]);
  return `\uFEFF${[header, ...rows].map((row) => row.join(",")).join("\n")}\n`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function idempotencyConflict() {
  return new AppError({
    code: "CONFLICT",
    safeMessage:
      "This command identifier was already used for a different request.",
  });
}
