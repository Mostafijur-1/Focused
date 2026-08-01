/** @vitest-environment node */

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@focused/database/generated/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaFocusRepository } from "@/features/focus/infrastructure/persistence/prisma-focus-repository";

const connectionString = process.env.INTEGRATION_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("PrismaFocusRepository against PostgreSQL", () => {
  const userId = randomUUID();
  const startedAt = new Date("2026-08-01T06:00:00.000Z");
  let prisma: PrismaClient;
  let repository: PrismaFocusRepository;

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: connectionString! }),
    });
    repository = new PrismaFocusRepository(prisma);
    await prisma.user.create({
      data: {
        id: userId,
        email: `focus-${userId}@example.test`,
        emailVerifiedAt: startedAt,
        status: "ACTIVE",
      },
    });
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("replays commands and preserves the explicit state machine", async () => {
    const startCommandId = randomUUID();
    const started = await repository.start({
      userId,
      clientCommandId: startCommandId,
      now: startedAt,
      draft: {
        kind: "deep_work",
        intent: "Integration focus",
        plannedSeconds: 1_500,
        goalId: null,
        pomodoroPresetId: null,
        pomodoroConfig: null,
        timeZone: "Asia/Dhaka",
      },
    });
    expect(started).toMatchObject({ status: "running", version: 1 });
    if (!started || typeof started === "string")
      throw new Error("start failed");

    const startReplay = await repository.start({
      userId,
      clientCommandId: startCommandId,
      now: startedAt,
      draft: {
        kind: "deep_work",
        intent: "Integration focus",
        plannedSeconds: 1_500,
        goalId: null,
        pomodoroPresetId: null,
        pomodoroConfig: null,
        timeZone: "Asia/Dhaka",
      },
    });
    expect(startReplay).toMatchObject({ id: started.id, version: 1 });

    const pauseCommandId = randomUUID();
    const paused = await repository.pause({
      userId,
      sessionId: started.id,
      expectedVersion: 1,
      clientCommandId: pauseCommandId,
      reason: null,
      now: new Date(startedAt.getTime() + 300_000),
    });
    expect(paused).toMatchObject({ status: "paused", version: 2 });

    const pauseReplay = await repository.pause({
      userId,
      sessionId: started.id,
      expectedVersion: 1,
      clientCommandId: pauseCommandId,
      reason: null,
      now: new Date(startedAt.getTime() + 301_000),
    });
    expect(pauseReplay).toMatchObject({ status: "paused", version: 2 });

    const resumed = await repository.resume({
      userId,
      sessionId: started.id,
      expectedVersion: 2,
      clientCommandId: randomUUID(),
      now: new Date(startedAt.getTime() + 600_000),
    });
    expect(resumed).toMatchObject({ status: "running", version: 3 });

    const completed = await repository.complete({
      userId,
      sessionId: started.id,
      expectedVersion: 3,
      clientCommandId: randomUUID(),
      outcome: "Completed integration flow",
      now: new Date(startedAt.getTime() + 1_800_000),
    });
    expect(completed).toMatchObject({
      status: "completed",
      version: 4,
      pausedSeconds: 300,
      focusedSeconds: 1_500,
    });
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: started.id, aggregateType: "FocusSession" },
      }),
    ).toBe(4);
  });

  it("advances Pomodoro focus and break intervals without counting breaks", async () => {
    const config = {
      focusSeconds: 60,
      shortBreakSeconds: 60,
      longBreakSeconds: 60,
      cycles: 2,
      longBreakEvery: 2,
      autoStartBreaks: false,
      autoStartFocus: false,
      audioEnabled: false,
      vibrationEnabled: false,
    } as const;
    const started = await repository.start({
      userId,
      clientCommandId: randomUUID(),
      now: new Date("2026-08-02T06:00:00.000Z"),
      draft: {
        kind: "pomodoro",
        intent: "Pomodoro integration",
        plannedSeconds: 120,
        goalId: null,
        pomodoroPresetId: null,
        pomodoroConfig: config,
        timeZone: "UTC",
      },
    });
    if (!started || typeof started === "string")
      throw new Error("start failed");
    expect(started.activeInterval).toMatchObject({
      kind: "focus",
      cycleNumber: 1,
    });

    const breakStarted = await repository.advanceInterval({
      userId,
      sessionId: started.id,
      expectedVersion: 1,
      clientCommandId: randomUUID(),
      skip: false,
      now: new Date("2026-08-02T06:01:00.000Z"),
    });
    expect(breakStarted).toMatchObject({
      version: 2,
      focusedSeconds: 60,
      activeInterval: { kind: "short_break", cycleNumber: 1 },
    });

    const focusStarted = await repository.advanceInterval({
      userId,
      sessionId: started.id,
      expectedVersion: 2,
      clientCommandId: randomUUID(),
      skip: true,
      now: new Date("2026-08-02T06:01:05.000Z"),
    });
    expect(focusStarted).toMatchObject({
      version: 3,
      focusedSeconds: 60,
      activeInterval: { kind: "focus", cycleNumber: 2 },
    });
  });
});
