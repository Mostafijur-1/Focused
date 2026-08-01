/** @vitest-environment node */

import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@focused/database/generated/client";
import { PrismaGoalRepository } from "@/features/goals/infrastructure/persistence/prisma-goal-repository";

const connectionString = process.env.INTEGRATION_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("PrismaGoalRepository against PostgreSQL", () => {
  const ownerId = randomUUID();
  const otherId = randomUUID();
  const commandId = randomUUID();
  const now = new Date("2026-08-01T06:00:00.000Z");
  let prisma: PrismaClient;
  let repository: PrismaGoalRepository;

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: connectionString! }),
    });
    repository = new PrismaGoalRepository(prisma);
    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          email: `goal-${ownerId}@example.test`,
          status: "ACTIVE",
        },
        {
          id: otherId,
          email: `goal-${otherId}@example.test`,
          status: "ACTIVE",
        },
      ],
    });
    await prisma.userProfile.createMany({
      data: [
        {
          userId: ownerId,
          displayName: "Goal Owner",
          locale: "bn-BD",
          timeZone: "Asia/Dhaka",
        },
        {
          userId: otherId,
          displayName: "Other",
          locale: "en",
          timeZone: "UTC",
        },
      ],
    });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    await prisma.$disconnect();
  });

  it("replays creation without duplication and isolates owners", async () => {
    const command = {
      userId: ownerId,
      now,
      localDate: "2026-08-01",
      clientCommandId: commandId,
      draft: {
        parentGoalId: null,
        title: "Build Focused",
        description: null,
        horizon: "year",
        priority: 1 as const,
        progressMode: "manual" as const,
        manualProgress: 0,
        successMeasure: null,
        targetValue: null,
        targetUnit: null,
        targetDate: "2026-12-31",
      },
    };
    const first = await repository.create(command);
    expect((await repository.create(command)).id).toBe(first.id);
    expect(await prisma.goal.count({ where: { userId: ownerId } })).toBe(1);
    expect(await repository.find(otherId, first.id, "2026-08-01")).toBeNull();
  });

  it("rejects stale concurrent check-ins while preserving one history row", async () => {
    const goal = await repository.create({
      userId: ownerId,
      now,
      localDate: "2026-08-01",
      clientCommandId: randomUUID(),
      draft: {
        parentGoalId: null,
        title: "Read",
        description: null,
        horizon: "quarter",
        priority: 2,
        progressMode: "manual",
        manualProgress: 0,
        successMeasure: null,
        targetValue: null,
        targetUnit: null,
        targetDate: null,
      },
    });
    const accepted = await repository.checkIn({
      userId: ownerId,
      goalId: goal.id,
      now,
      localDate: "2026-08-01",
      progress: 25,
      value: null,
      note: null,
      evidenceRef: null,
      clientCommandId: randomUUID(),
      expectedVersion: 1,
    });
    const rejected = await repository.checkIn({
      userId: ownerId,
      goalId: goal.id,
      now,
      localDate: "2026-08-01",
      progress: 50,
      value: null,
      note: null,
      evidenceRef: null,
      clientCommandId: randomUUID(),
      expectedVersion: 1,
    });
    expect(accepted).not.toBe("conflict");
    expect(rejected).toBe("conflict");
    expect(await prisma.goalCheckIn.count({ where: { goalId: goal.id } })).toBe(
      1,
    );
  });
});
