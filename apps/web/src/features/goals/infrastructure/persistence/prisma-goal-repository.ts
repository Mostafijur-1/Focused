import { randomUUID } from "node:crypto";

import type { FocusedPrismaClient } from "@focused/database";
import { Prisma } from "@focused/database/generated/client";

import type {
  AddKeyResultCommand,
  AddMilestoneCommand,
  CheckInGoalCommand,
  CreateGoalCommand,
  GoalRepository,
  LifeVisionDraftCommand,
  LinkGoalCommand,
  TransitionGoalCommand,
  UpdateGoalCommand,
  UpdateMilestoneCommand,
  UpdateKeyResultCommand,
  WeeklyPlanCommand,
} from "@/features/goals/application/ports";
import {
  calculateGoalProgress,
  goalLimits,
  isGoalOverdue,
  weeklyCapacity,
} from "@/features/goals/domain/goal-policy";
import type {
  GoalLinkType,
  GoalListView,
  GoalProgressMode,
  GoalStatus,
  GoalView,
  LifeVisionView,
  WeeklyPlanView,
} from "@/features/goals/domain/goal-types";
import { addDays } from "@/features/habits/domain/habit-schedule";
import { appendOutboxEvent } from "@/features/platform-data/infrastructure/persistence/prisma-durable-work-store";
import { AppError } from "@/lib/errors/app-error";

type TransactionClient = Parameters<
  Parameters<FocusedPrismaClient["$transaction"]>[0]
>[0];

const goalInclude = {
  milestones: { orderBy: { position: "asc" }, take: 50 },
  keyResults: { orderBy: { position: "asc" }, take: 20 },
  links: { orderBy: { createdAt: "asc" }, take: 50 },
  checkIns: { orderBy: [{ recordedAt: "desc" }, { id: "desc" }], take: 10 },
} satisfies Prisma.GoalInclude;
type GoalRecord = Prisma.GoalGetPayload<{ include: typeof goalInclude }>;

const visionInclude = {
  areas: { orderBy: { position: "asc" } },
} satisfies Prisma.LifeVisionInclude;
type VisionRecord = Prisma.LifeVisionGetPayload<{
  include: typeof visionInclude;
}>;

const planInclude = {
  items: { orderBy: { position: "asc" } },
} satisfies Prisma.PlanInclude;
type PlanRecord = Prisma.PlanGetPayload<{ include: typeof planInclude }>;

export class PrismaGoalRepository implements GoalRepository {
  constructor(private readonly prisma: FocusedPrismaClient) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timeZone: true, weekStartsOn: true },
    });
    if (!profile)
      throw new AppError({
        code: "NOT_FOUND",
        safeMessage: "Profile not found.",
      });
    return profile;
  }

  countOpen(userId: string) {
    return this.prisma.goal.count({
      where: {
        userId,
        deletedAt: null,
        archivedAt: null,
        status: { in: ["DRAFT", "ACTIVE", "PAUSED"] },
      },
    });
  }

  async list(
    userId: string,
    today: string,
    filter: Readonly<{
      status?: GoalStatus;
      query?: string;
      cursor?: string;
      limit: number;
    }>,
  ): Promise<GoalListView> {
    const where = {
      userId,
      deletedAt: null,
      ...(filter.status ? { status: databaseGoalStatus(filter.status) } : {}),
      ...(filter.query
        ? {
            OR: [
              {
                title: { contains: filter.query, mode: "insensitive" as const },
              },
              {
                description: {
                  contains: filter.query,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.goal.count({ where }),
      this.prisma.goal.findMany({
        where,
        orderBy: [
          { archivedAt: "asc" },
          { priority: "asc" },
          { position: "asc" },
          { updatedAt: "desc" },
          { id: "asc" },
        ],
        take: filter.limit + 1,
        ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
        include: goalInclude,
      }),
    ]);
    const hasMore = rows.length > filter.limit;
    const data = rows.slice(0, filter.limit);
    return {
      data: data.map((goal) => toGoal(goal, today)),
      nextCursor: hasMore ? data.at(-1)!.id : null,
      total,
    };
  }

  async find(userId: string, goalId: string, today: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId, deletedAt: null },
      include: goalInclude,
    });
    return goal ? toGoal(goal, today) : null;
  }

  async validateParent(
    userId: string,
    goalId: string | null,
    parentGoalId: string | null,
  ): Promise<boolean> {
    if (!parentGoalId) return true;
    const goals = await this.prisma.goal.findMany({
      where: { userId, deletedAt: null },
      take: goalLimits.activePerMember + 1,
      select: { id: true, parentGoalId: true },
    });
    const parents = new Map(goals.map((goal) => [goal.id, goal.parentGoalId]));
    if (!parents.has(parentGoalId) || parentGoalId === goalId) return false;
    let cursor: string | null = parentGoalId;
    let parentDepth = 0;
    while (cursor) {
      if (cursor === goalId) return false;
      parentDepth += 1;
      cursor = parents.get(cursor) ?? null;
      if (parentDepth > goalLimits.hierarchyDepth) return false;
    }
    const subtreeDepth = goalId ? descendantDepth(goalId, goals) : 1;
    return parentDepth + subtreeDepth <= goalLimits.hierarchyDepth;
  }

  async create(command: CreateGoalCommand): Promise<GoalView> {
    const replay = await this.prisma.goal.findUnique({
      where: {
        userId_createdByCommandId: {
          userId: command.userId,
          createdByCommandId: command.clientCommandId,
        },
      },
      include: goalInclude,
    });
    if (replay) return toGoal(replay, command.localDate);
    const goalId = randomUUID();
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.goal.create({
          data: {
            id: goalId,
            userId: command.userId,
            parentGoalId: command.draft.parentGoalId,
            title: command.draft.title,
            description: command.draft.description,
            horizon: command.draft.horizon,
            priority: command.draft.priority,
            progressMode: databaseProgressMode(command.draft.progressMode),
            manualProgress: command.draft.manualProgress,
            successMeasure: command.draft.successMeasure,
            targetValue: command.draft.targetValue,
            targetUnit: command.draft.targetUnit,
            targetDate: command.draft.targetDate
              ? databaseDate(command.draft.targetDate)
              : null,
            createdByCommandId: command.clientCommandId,
          },
        });
        await transaction.goalStatusTransition.create({
          data: {
            goalId,
            fromStatus: null,
            toStatus: "DRAFT",
            clientCommandId: command.clientCommandId,
            occurredAt: command.now,
          },
        });
        await publish(
          transaction,
          command.userId,
          goalId,
          1,
          "GoalCreated",
          command.now,
          { goalId, status: "draft" },
        );
      });
    } catch (error) {
      const concurrent = await replayGoal(
        this.prisma,
        command.userId,
        command.clientCommandId,
      );
      if (!concurrent || !isUnique(error)) throw error;
      return toGoal(concurrent, command.localDate);
    }
    return this.requireGoal(command.userId, goalId, command.localDate);
  }

  async update(command: UpdateGoalCommand) {
    const changed = await this.prisma.$transaction(async (transaction) => {
      const locked = await transaction.goal.updateMany({
        where: {
          id: command.goalId,
          userId: command.userId,
          deletedAt: null,
          version: command.expectedVersion,
        },
        data: {
          parentGoalId: command.draft.parentGoalId,
          title: command.draft.title,
          description: command.draft.description,
          horizon: command.draft.horizon,
          priority: command.draft.priority,
          progressMode: databaseProgressMode(command.draft.progressMode),
          manualProgress: command.draft.manualProgress,
          successMeasure: command.draft.successMeasure,
          targetValue: command.draft.targetValue,
          targetUnit: command.draft.targetUnit,
          targetDate: command.draft.targetDate
            ? databaseDate(command.draft.targetDate)
            : null,
          version: { increment: 1 },
        },
      });
      if (locked.count !== 1)
        return (await ownerExists(transaction, command.userId, command.goalId))
          ? ("conflict" as const)
          : null;
      await publish(
        transaction,
        command.userId,
        command.goalId,
        command.expectedVersion + 1,
        "GoalChanged",
        command.now,
        { goalId: command.goalId },
      );
      return "updated" as const;
    });
    return changed === "updated"
      ? this.requireGoal(command.userId, command.goalId, command.localDate)
      : changed;
  }

  async transition(command: TransitionGoalCommand) {
    const replay = await this.prisma.goalStatusTransition.findUnique({
      where: {
        goalId_clientCommandId: {
          goalId: command.goalId,
          clientCommandId: command.clientCommandId,
        },
      },
      select: { id: true },
    });
    if (replay)
      return this.requireGoal(
        command.userId,
        command.goalId,
        command.localDate,
      );
    const changed = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.goal.findFirst({
        where: { id: command.goalId, userId: command.userId, deletedAt: null },
        select: { status: true },
      });
      if (!current) return null;
      const statusDates =
        command.toStatus === "achieved"
          ? { achievedAt: command.now }
          : command.toStatus === "abandoned"
            ? { abandonedAt: command.now }
            : command.toStatus === "active"
              ? { achievedAt: null, abandonedAt: null }
              : {};
      const locked = await transaction.goal.updateMany({
        where: {
          id: command.goalId,
          userId: command.userId,
          version: command.expectedVersion,
        },
        data: {
          status: databaseGoalStatus(command.toStatus),
          archivedAt: command.toStatus === "archived" ? command.now : null,
          ...statusDates,
          version: { increment: 1 },
        },
      });
      if (locked.count !== 1) return "conflict" as const;
      await transaction.goalStatusTransition.create({
        data: {
          goalId: command.goalId,
          fromStatus: current.status,
          toStatus: databaseGoalStatus(command.toStatus),
          reason: command.reason,
          clientCommandId: command.clientCommandId,
          occurredAt: command.now,
        },
      });
      await publish(
        transaction,
        command.userId,
        command.goalId,
        command.expectedVersion + 1,
        "GoalStatusChanged",
        command.now,
        {
          goalId: command.goalId,
          from: applicationGoalStatus(current.status),
          to: command.toStatus,
        },
      );
      return "updated" as const;
    });
    return changed === "updated"
      ? this.requireGoal(command.userId, command.goalId, command.localDate)
      : changed;
  }

  async checkIn(command: CheckInGoalCommand) {
    const replay = await this.prisma.goalCheckIn.findUnique({
      where: {
        goalId_clientCommandId: {
          goalId: command.goalId,
          clientCommandId: command.clientCommandId,
        },
      },
      select: { id: true },
    });
    if (replay)
      return this.requireGoal(
        command.userId,
        command.goalId,
        command.localDate,
      );
    const changed = await this.prisma.$transaction(async (transaction) => {
      const goal = await transaction.goal.findFirst({
        where: { id: command.goalId, userId: command.userId, deletedAt: null },
        select: { targetValue: true, targetUnit: true, progressMode: true },
      });
      if (!goal) return null;
      const locked = await transaction.goal.updateMany({
        where: {
          id: command.goalId,
          userId: command.userId,
          version: command.expectedVersion,
        },
        data: {
          ...(goal.progressMode === "MANUAL"
            ? { manualProgress: command.progress }
            : {}),
          version: { increment: 1 },
        },
      });
      if (locked.count !== 1) return "conflict" as const;
      await transaction.goalCheckIn.create({
        data: {
          goalId: command.goalId,
          clientCommandId: command.clientCommandId,
          progress: command.progress ?? 0,
          value: command.value,
          note: command.note,
          evidenceRef: command.evidenceRef,
          recordedAt: command.now,
          timeZone: command.timeZone ?? null,
          targetSnapshot: {
            targetValue: decimalNumber(goal.targetValue),
            targetUnit: goal.targetUnit,
            progressMode: goal.progressMode.toLowerCase(),
          },
        },
      });
      await publish(
        transaction,
        command.userId,
        command.goalId,
        command.expectedVersion + 1,
        "GoalCheckInRecorded",
        command.now,
        { goalId: command.goalId, progress: command.progress },
      );
      return "updated" as const;
    });
    return changed === "updated"
      ? this.requireGoal(command.userId, command.goalId, command.localDate)
      : changed;
  }

  async addMilestone(command: AddMilestoneCommand) {
    const replay = await this.prisma.milestone.findUnique({
      where: {
        goalId_clientCommandId: {
          goalId: command.goalId,
          clientCommandId: command.clientCommandId,
        },
      },
      select: { id: true },
    });
    if (replay)
      return this.requireGoal(
        command.userId,
        command.goalId,
        command.localDate,
      );
    const changed = await this.prisma.$transaction(async (transaction) => {
      const count = await transaction.milestone.count({
        where: { goalId: command.goalId, goal: { userId: command.userId } },
      });
      if (count >= goalLimits.milestonesPerGoal) return "conflict" as const;
      const locked = await lockGoal(
        transaction,
        command.userId,
        command.goalId,
        command.expectedVersion,
      );
      if (locked === null || locked === "conflict") return locked;
      await transaction.milestone.create({
        data: {
          goalId: command.goalId,
          title: command.title,
          dueDate: command.dueDate ? databaseDate(command.dueDate) : null,
          position: count,
          weight: command.weight,
          clientCommandId: command.clientCommandId,
        },
      });
      await publish(
        transaction,
        command.userId,
        command.goalId,
        command.expectedVersion + 1,
        "GoalMilestoneAdded",
        command.now,
        { goalId: command.goalId },
      );
      return "updated" as const;
    });
    return changed === "updated"
      ? this.requireGoal(command.userId, command.goalId, command.localDate)
      : changed;
  }

  async updateMilestone(command: UpdateMilestoneCommand) {
    const changed = await this.prisma.$transaction(async (transaction) => {
      const locked = await lockGoal(
        transaction,
        command.userId,
        command.goalId,
        command.expectedGoalVersion,
      );
      if (locked === null || locked === "conflict") return locked;
      const milestone = await transaction.milestone.updateMany({
        where: {
          id: command.milestoneId,
          goalId: command.goalId,
          version: command.expectedVersion,
        },
        data: {
          title: command.title,
          dueDate: command.dueDate ? databaseDate(command.dueDate) : null,
          status: command.status.toUpperCase() as
            "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "DEFERRED" | "CANCELLED",
          weight: command.weight,
          completedAt: command.status === "completed" ? command.now : null,
          version: { increment: 1 },
        },
      });
      if (milestone.count !== 1)
        throw new AppError({
          code: "CONFLICT",
          safeMessage: "The milestone changed on another device.",
        });
      await publish(
        transaction,
        command.userId,
        command.goalId,
        command.expectedGoalVersion + 1,
        "GoalMilestoneChanged",
        command.now,
        { goalId: command.goalId, milestoneId: command.milestoneId },
      );
      return "updated" as const;
    });
    return changed === "updated"
      ? this.requireGoal(command.userId, command.goalId, command.localDate)
      : changed;
  }

  async addKeyResult(command: AddKeyResultCommand) {
    const replay = await this.prisma.goalKeyResult.findUnique({
      where: {
        goalId_clientCommandId: {
          goalId: command.goalId,
          clientCommandId: command.clientCommandId,
        },
      },
      select: { id: true },
    });
    if (replay)
      return this.requireGoal(
        command.userId,
        command.goalId,
        command.localDate,
      );
    const changed = await this.prisma.$transaction(async (transaction) => {
      const count = await transaction.goalKeyResult.count({
        where: { goalId: command.goalId, goal: { userId: command.userId } },
      });
      if (count >= goalLimits.keyResultsPerGoal) return "conflict" as const;
      const locked = await lockGoal(
        transaction,
        command.userId,
        command.goalId,
        command.expectedVersion,
      );
      if (locked === null || locked === "conflict") return locked;
      await transaction.goalKeyResult.create({
        data: {
          goalId: command.goalId,
          title: command.title,
          targetValue: command.targetValue,
          currentValue: command.currentValue,
          unit: command.unit,
          weight: command.weight,
          position: count,
          clientCommandId: command.clientCommandId,
        },
      });
      await publish(
        transaction,
        command.userId,
        command.goalId,
        command.expectedVersion + 1,
        "GoalKeyResultAdded",
        command.now,
        { goalId: command.goalId },
      );
      return "updated" as const;
    });
    return changed === "updated"
      ? this.requireGoal(command.userId, command.goalId, command.localDate)
      : changed;
  }

  async updateKeyResult(command: UpdateKeyResultCommand) {
    const changed = await this.prisma.$transaction(async (transaction) => {
      const locked = await lockGoal(
        transaction,
        command.userId,
        command.goalId,
        command.expectedGoalVersion,
      );
      if (locked === null || locked === "conflict") return locked;
      const result = await transaction.goalKeyResult.updateMany({
        where: {
          id: command.keyResultId,
          goalId: command.goalId,
          version: command.expectedVersion,
        },
        data: {
          title: command.title,
          targetValue: command.targetValue,
          currentValue: command.currentValue,
          unit: command.unit,
          weight: command.weight,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1)
        throw new AppError({
          code: "CONFLICT",
          safeMessage: "The key result changed on another device.",
        });
      await publish(
        transaction,
        command.userId,
        command.goalId,
        command.expectedGoalVersion + 1,
        "GoalKeyResultChanged",
        command.now,
        { goalId: command.goalId, keyResultId: command.keyResultId },
      );
      return "updated" as const;
    });
    return changed === "updated"
      ? this.requireGoal(command.userId, command.goalId, command.localDate)
      : changed;
  }

  async link(command: LinkGoalCommand) {
    if (
      !(await linkedResourceOwned(
        this.prisma,
        command.userId,
        command.type,
        command.resourceId,
      ))
    )
      return "invalid_reference" as const;
    const changed = await this.prisma.$transaction(async (transaction) => {
      const count = await transaction.goalLink.count({
        where: { goalId: command.goalId, goal: { userId: command.userId } },
      });
      if (count >= goalLimits.linksPerGoal) return "conflict" as const;
      const locked = await lockGoal(
        transaction,
        command.userId,
        command.goalId,
        command.expectedVersion,
      );
      if (locked === null || locked === "conflict") return locked;
      await transaction.goalLink.upsert({
        where: {
          goalId_type_resourceId: {
            goalId: command.goalId,
            type: databaseLinkType(command.type),
            resourceId: command.resourceId,
          },
        },
        create: {
          goalId: command.goalId,
          type: databaseLinkType(command.type),
          resourceId: command.resourceId,
          label: command.label,
        },
        update: { label: command.label },
      });
      await publish(
        transaction,
        command.userId,
        command.goalId,
        command.expectedVersion + 1,
        "GoalLinked",
        command.now,
        {
          goalId: command.goalId,
          type: command.type,
          resourceId: command.resourceId,
        },
      );
      return "updated" as const;
    });
    return changed === "updated"
      ? this.requireGoal(command.userId, command.goalId, command.localDate)
      : changed;
  }

  async unlink(command: {
    readonly userId: string;
    readonly now: Date;
    readonly localDate: string;
    readonly goalId: string;
    readonly linkId: string;
    readonly expectedVersion: number;
  }) {
    const changed = await this.prisma.$transaction(async (transaction) => {
      const link = await transaction.goalLink.findFirst({
        where: {
          id: command.linkId,
          goalId: command.goalId,
          goal: { userId: command.userId },
        },
        select: { id: true },
      });
      if (!link) return null;
      const locked = await lockGoal(
        transaction,
        command.userId,
        command.goalId,
        command.expectedVersion,
      );
      if (locked === null || locked === "conflict") return locked;
      await transaction.goalLink.delete({ where: { id: link.id } });
      await publish(
        transaction,
        command.userId,
        command.goalId,
        command.expectedVersion + 1,
        "GoalUnlinked",
        command.now,
        { goalId: command.goalId, linkId: command.linkId },
      );
      return "updated" as const;
    });
    return changed === "updated"
      ? this.requireGoal(command.userId, command.goalId, command.localDate)
      : changed;
  }

  async currentLifeVision(userId: string) {
    const vision = await this.prisma.lifeVision.findFirst({
      where: { userId, status: { not: "ARCHIVED" } },
      orderBy: { revision: "desc" },
      include: visionInclude,
    });
    return vision ? toVision(vision) : null;
  }

  async saveLifeVision(command: LifeVisionDraftCommand) {
    const replay = await this.prisma.lifeVision.findUnique({
      where: {
        userId_clientCommandId: {
          userId: command.userId,
          clientCommandId: command.clientCommandId,
        },
      },
      include: visionInclude,
    });
    if (replay) return toVision(replay);
    const result = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.lifeVision.findFirst({
        where: { userId: command.userId, status: { not: "ARCHIVED" } },
        orderBy: { revision: "desc" },
        select: { id: true, revision: true, status: true, version: true },
      });
      if (
        current?.status === "DRAFT" &&
        (command.expectedVersion === undefined ||
          current.version !== command.expectedVersion)
      )
        return "conflict" as const;
      if (current?.status === "DRAFT")
        await transaction.lifeVision.update({
          where: { id: current.id },
          data: { status: "ARCHIVED", archivedAt: command.now },
        });
      const id = randomUUID();
      await transaction.lifeVision.create({
        data: {
          id,
          userId: command.userId,
          revision: (current?.revision ?? 0) + 1,
          narrative: command.narrative,
          values: [...command.values],
          antiGoals: [...command.antiGoals],
          clientCommandId: command.clientCommandId,
          areas: {
            create: command.areas.map((area, position) => ({
              ...area,
              position,
            })),
          },
        },
      });
      await publish(
        transaction,
        command.userId,
        id,
        1,
        "LifeVisionDraftSaved",
        command.now,
        { visionId: id, revision: (current?.revision ?? 0) + 1 },
      );
      return id;
    });
    if (result === "conflict") return result;
    const vision = await this.prisma.lifeVision.findUniqueOrThrow({
      where: { id: result },
      include: visionInclude,
    });
    return toVision(vision);
  }

  async publishLifeVision(command: {
    readonly userId: string;
    readonly now: Date;
    readonly localDate: string;
    readonly visionId: string;
    readonly expectedVersion: number;
    readonly clientCommandId: string;
  }) {
    const replay = await this.prisma.lifeVision.findUnique({
      where: {
        userId_publishedByCommandId: {
          userId: command.userId,
          publishedByCommandId: command.clientCommandId,
        },
      },
      include: visionInclude,
    });
    if (replay) return toVision(replay);
    const changed = await this.prisma.$transaction(async (transaction) => {
      const locked = await transaction.lifeVision.updateMany({
        where: {
          id: command.visionId,
          userId: command.userId,
          status: "DRAFT",
          version: command.expectedVersion,
        },
        data: {
          status: "PUBLISHED",
          publishedAt: command.now,
          publishedByCommandId: command.clientCommandId,
          version: { increment: 1 },
        },
      });
      if (locked.count !== 1)
        return (await transaction.lifeVision.count({
          where: { id: command.visionId, userId: command.userId },
        }))
          ? ("conflict" as const)
          : null;
      await publish(
        transaction,
        command.userId,
        command.visionId,
        command.expectedVersion + 1,
        "LifeVisionPublished",
        command.now,
        { visionId: command.visionId },
      );
      return "updated" as const;
    });
    if (changed !== "updated") return changed;
    const vision = await this.prisma.lifeVision.findUniqueOrThrow({
      where: { id: command.visionId },
      include: visionInclude,
    });
    return toVision(vision);
  }

  async weeklyPlan(userId: string, weekStart: string) {
    const plan = await this.prisma.plan.findUnique({
      where: {
        userId_type_periodStart: {
          userId,
          type: "WEEKLY",
          periodStart: databaseDate(weekStart),
        },
      },
      include: planInclude,
    });
    return plan ? toWeeklyPlan(plan) : null;
  }

  async saveWeeklyPlan(command: WeeklyPlanCommand) {
    const replay = await this.prisma.plan.findUnique({
      where: {
        userId_type_clientCommandId: {
          userId: command.userId,
          type: "WEEKLY",
          clientCommandId: command.clientCommandId,
        },
      },
      include: planInclude,
    });
    if (replay) return toWeeklyPlan(replay);
    const result = await this.prisma.$transaction(async (transaction) => {
      const linkedGoalIds = [
        ...new Set(
          command.outcomes.flatMap((outcome) =>
            outcome.goalId ? [outcome.goalId] : [],
          ),
        ),
      ];
      if (
        linkedGoalIds.length > 0 &&
        (await transaction.goal.count({
          where: {
            id: { in: linkedGoalIds },
            userId: command.userId,
            deletedAt: null,
          },
        })) !== linkedGoalIds.length
      )
        return "invalid_reference" as const;
      const current = await transaction.plan.findUnique({
        where: {
          userId_type_periodStart: {
            userId: command.userId,
            type: "WEEKLY",
            periodStart: databaseDate(command.weekStart),
          },
        },
        select: { id: true, version: true, status: true },
      });
      let planId: string;
      if (!current) {
        planId = randomUUID();
        await transaction.plan.create({
          data: {
            id: planId,
            userId: command.userId,
            type: "WEEKLY",
            periodStart: databaseDate(command.weekStart),
            periodEnd: databaseDate(addDays(command.weekStart, 6)),
            timeZone: command.timeZone,
            theme: command.theme,
            capacityMinutes: command.capacityMinutes,
            notDoing: [...command.notDoing],
            fixedCommitments:
              command.fixedCommitments as unknown as Prisma.InputJsonValue,
            reflection: command.reflection,
            clientCommandId: command.clientCommandId,
          },
        });
      } else {
        if (current.status !== "DRAFT" || command.expectedVersion === undefined)
          return "conflict" as const;
        const locked = await transaction.plan.updateMany({
          where: {
            id: current.id,
            userId: command.userId,
            version: command.expectedVersion,
            status: "DRAFT",
          },
          data: {
            theme: command.theme,
            capacityMinutes: command.capacityMinutes,
            notDoing: [...command.notDoing],
            fixedCommitments:
              command.fixedCommitments as unknown as Prisma.InputJsonValue,
            reflection: command.reflection,
            clientCommandId: command.clientCommandId,
            version: { increment: 1 },
          },
        });
        if (locked.count !== 1) return "conflict" as const;
        planId = current.id;
        await transaction.planItem.deleteMany({ where: { planId } });
      }
      if (command.outcomes.length)
        await transaction.planItem.createMany({
          data: command.outcomes.map((outcome, position) => ({
            planId,
            goalId: outcome.goalId,
            title: outcome.title,
            estimateMinutes: outcome.estimateMinutes,
            isPrimary: position < 3,
            position,
          })),
        });
      const aggregateVersion = current ? command.expectedVersion! + 1 : 1;
      await publish(
        transaction,
        command.userId,
        planId,
        aggregateVersion,
        "WeeklyPlanDraftSaved",
        command.now,
        { planId, weekStart: command.weekStart },
      );
      return planId;
    });
    if (result === "conflict" || result === "invalid_reference") return result;
    const plan = await this.prisma.plan.findUniqueOrThrow({
      where: { id: result },
      include: planInclude,
    });
    return toWeeklyPlan(plan);
  }

  async transitionWeeklyPlan(command: {
    readonly userId: string;
    readonly now: Date;
    readonly localDate: string;
    readonly planId: string;
    readonly toStatus: "active" | "closed";
    readonly expectedVersion: number;
  }) {
    const target = command.toStatus === "active" ? "ACTIVE" : "CLOSED";
    const allowed = command.toStatus === "active" ? "DRAFT" : "ACTIVE";
    const changed = await this.prisma.$transaction(async (transaction) => {
      const transitionDate =
        command.toStatus === "active"
          ? { finalizedAt: command.now }
          : { closedAt: command.now };
      const locked = await transaction.plan.updateMany({
        where: {
          id: command.planId,
          userId: command.userId,
          type: "WEEKLY",
          status: allowed,
          version: command.expectedVersion,
        },
        data: { status: target, ...transitionDate, version: { increment: 1 } },
      });
      if (locked.count !== 1)
        return (await transaction.plan.count({
          where: { id: command.planId, userId: command.userId },
        }))
          ? ("conflict" as const)
          : null;
      await publish(
        transaction,
        command.userId,
        command.planId,
        command.expectedVersion + 1,
        command.toStatus === "active"
          ? "WeeklyPlanFinalized"
          : "WeeklyPlanClosed",
        command.now,
        { planId: command.planId },
      );
      return "updated" as const;
    });
    if (changed !== "updated") return changed;
    const plan = await this.prisma.plan.findUniqueOrThrow({
      where: { id: command.planId },
      include: planInclude,
    });
    return toWeeklyPlan(plan);
  }

  private async requireGoal(userId: string, goalId: string, today: string) {
    const goal = await this.find(userId, goalId, today);
    if (!goal) throw new Error("Goal disappeared after a committed mutation.");
    return goal;
  }
}

async function lockGoal(
  transaction: TransactionClient,
  userId: string,
  goalId: string,
  version: number,
) {
  const locked = await transaction.goal.updateMany({
    where: { id: goalId, userId, deletedAt: null, version },
    data: { version: { increment: 1 } },
  });
  if (locked.count === 1) return "locked" as const;
  return (await ownerExists(transaction, userId, goalId))
    ? ("conflict" as const)
    : null;
}
async function ownerExists(
  transaction: TransactionClient,
  userId: string,
  goalId: string,
) {
  return (
    (await transaction.goal.count({
      where: { id: goalId, userId, deletedAt: null },
    })) > 0
  );
}
async function replayGoal(
  prisma: FocusedPrismaClient,
  userId: string,
  commandId: string,
) {
  return prisma.goal.findUnique({
    where: {
      userId_createdByCommandId: { userId, createdByCommandId: commandId },
    },
    include: goalInclude,
  });
}
function isUnique(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function linkedResourceOwned(
  prisma: FocusedPrismaClient,
  userId: string,
  type: GoalLinkType,
  resourceId: string,
) {
  if (type === "vision_area")
    return (
      (await prisma.lifeVisionArea.count({
        where: { id: resourceId, lifeVision: { userId } },
      })) === 1
    );
  if (type === "plan_item")
    return (
      (await prisma.planItem.count({
        where: { id: resourceId, plan: { userId } },
      })) === 1
    );
  if (type === "habit")
    return (
      (await prisma.habit.count({ where: { id: resourceId, userId } })) === 1
    );
  if (type === "learning_item")
    return (
      (await prisma.trackerItem.count({
        where: { id: resourceId, userId },
      })) === 1
    );
  return (
    (await prisma.focusSession.count({ where: { id: resourceId, userId } })) ===
    1
  );
}

async function publish(
  transaction: TransactionClient,
  userId: string,
  aggregateId: string,
  aggregateVersion: number,
  eventType: string,
  occurredAt: Date,
  payload: Readonly<Record<string, unknown>>,
) {
  await appendOutboxEvent(transaction, {
    userId,
    aggregateType: eventType.startsWith("WeeklyPlan")
      ? "WeeklyPlan"
      : eventType.startsWith("LifeVision")
        ? "LifeVision"
        : "Goal",
    aggregateId,
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

function toGoal(goal: GoalRecord, today: string): GoalView {
  const mode = goal.progressMode.toLowerCase() as GoalProgressMode;
  const milestones = goal.milestones.map((item) => ({
    id: item.id,
    title: item.title,
    dueDate: item.dueDate ? isoDate(item.dueDate) : null,
    status: item.status.toLowerCase() as
      "planned" | "in_progress" | "completed" | "deferred" | "cancelled",
    weight: decimalNumber(item.weight)!,
    position: item.position,
    version: item.version,
  }));
  const keyResults = goal.keyResults.map((item) => ({
    id: item.id,
    title: item.title,
    targetValue: decimalNumber(item.targetValue)!,
    currentValue: decimalNumber(item.currentValue)!,
    unit: item.unit,
    weight: decimalNumber(item.weight)!,
    position: item.position,
    version: item.version,
  }));
  const status = applicationGoalStatus(goal.status);
  const targetDate = goal.targetDate ? isoDate(goal.targetDate) : null;
  return {
    id: goal.id,
    parentGoalId: goal.parentGoalId,
    title: goal.title,
    description: goal.description,
    status,
    horizon: goal.horizon,
    priority: goal.priority as 1 | 2 | 3,
    position: goal.position,
    progressMode: mode,
    progress: calculateGoalProgress(
      mode,
      decimalNumber(goal.manualProgress)!,
      milestones,
      keyResults,
    ),
    successMeasure: goal.successMeasure,
    targetValue: decimalNumber(goal.targetValue),
    targetUnit: goal.targetUnit,
    targetDate,
    overdue: isGoalOverdue(status, targetDate, today),
    archived: goal.archivedAt !== null,
    version: goal.version,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
    milestones,
    keyResults,
    links: goal.links.map((link) => ({
      id: link.id,
      type: link.type.toLowerCase() as GoalLinkType,
      resourceId: link.resourceId,
      label: link.label,
    })),
    recentCheckIns: goal.checkIns.map((item) => ({
      id: item.id,
      progress: decimalNumber(item.progress)!,
      value: decimalNumber(item.value),
      note: item.note,
      evidenceRef: item.evidenceRef,
      recordedAt: item.recordedAt.toISOString(),
    })),
  };
}

function toVision(vision: VisionRecord): LifeVisionView {
  return {
    id: vision.id,
    revision: vision.revision,
    status: vision.status.toLowerCase() as "draft" | "published" | "archived",
    narrative: vision.narrative,
    values: stringArray(vision.values),
    antiGoals: stringArray(vision.antiGoals),
    areas: vision.areas.map((area) => ({
      id: area.id,
      key: area.key,
      title: area.title,
      statement: area.statement,
      position: area.position,
    })),
    publishedAt: vision.publishedAt?.toISOString() ?? null,
    version: vision.version,
  };
}
function toWeeklyPlan(plan: PlanRecord): WeeklyPlanView {
  const commitments = fixedCommitments(plan.fixedCommitments);
  const outcomes = plan.items.map((item) => ({
    id: item.id,
    goalId: item.goalId,
    title: item.title,
    estimateMinutes: item.estimateMinutes ?? 0,
    status: item.status.toLowerCase() as
      "planned" | "in_progress" | "completed" | "deferred" | "cancelled",
    position: item.position,
  }));
  const capacity = weeklyCapacity(
    plan.capacityMinutes ?? 0,
    commitments,
    outcomes,
  );
  return {
    id: plan.id,
    weekStart: isoDate(plan.periodStart),
    weekEnd: isoDate(plan.periodEnd),
    timeZone: plan.timeZone,
    status: plan.status.toLowerCase() as
      "draft" | "active" | "closed" | "archived",
    theme: plan.theme,
    capacityMinutes: plan.capacityMinutes ?? 0,
    committedMinutes: capacity.committedMinutes,
    warning: capacity.warning,
    fixedCommitments: commitments,
    outcomes,
    notDoing: stringArray(plan.notDoing),
    reflection: plan.reflection,
    version: plan.version,
  };
}
function fixedCommitments(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) =>
    item &&
    typeof item === "object" &&
    !Array.isArray(item) &&
    typeof item.title === "string" &&
    typeof item.minutes === "number"
      ? [{ title: item.title, minutes: item.minutes }]
      : [],
  );
}
function stringArray(value: Prisma.JsonValue) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
function databaseGoalStatus(value: GoalStatus) {
  return value.toUpperCase() as
    "DRAFT" | "ACTIVE" | "PAUSED" | "ACHIEVED" | "ABANDONED" | "ARCHIVED";
}
function applicationGoalStatus(value: string) {
  return value.toLowerCase() as GoalStatus;
}
function databaseProgressMode(value: GoalProgressMode) {
  return value.toUpperCase() as "MANUAL" | "MILESTONES" | "KEY_RESULTS";
}
function databaseLinkType(value: GoalLinkType) {
  return value.toUpperCase() as
    "VISION_AREA" | "PLAN_ITEM" | "HABIT" | "LEARNING_ITEM" | "FOCUS_SESSION";
}
function databaseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
function decimalNumber(value: Prisma.Decimal | null) {
  return value === null ? null : value.toNumber();
}
function descendantDepth(
  goalId: string,
  goals: readonly Readonly<{ id: string; parentGoalId: string | null }>[],
): number {
  const children = goals.filter((goal) => goal.parentGoalId === goalId);
  return children.length === 0
    ? 1
    : 1 +
        Math.max(...children.map((child) => descendantDepth(child.id, goals)));
}
