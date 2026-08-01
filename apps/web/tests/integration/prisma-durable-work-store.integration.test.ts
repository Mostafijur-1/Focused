/** @vitest-environment node */

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@focused/database/generated/client";

import {
  PrismaBackgroundJobStore,
  PrismaIdempotencyStore,
  PrismaOutboxStore,
  PrismaWebhookInboxStore,
} from "@/features/platform-data/infrastructure/persistence/prisma-durable-work-store";

const connectionString = process.env.INTEGRATION_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("durable persistence against PostgreSQL", () => {
  const userId = randomUUID();
  const now = new Date("2026-07-31T16:00:00.000Z");
  let prisma: PrismaClient;
  let idempotency: PrismaIdempotencyStore;
  let outbox: PrismaOutboxStore;
  let inbox: PrismaWebhookInboxStore;
  let jobs: PrismaBackgroundJobStore;

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: connectionString! }),
    });
    idempotency = new PrismaIdempotencyStore(prisma);
    outbox = new PrismaOutboxStore(prisma);
    inbox = new PrismaWebhookInboxStore(prisma);
    jobs = new PrismaBackgroundJobStore(prisma);
    await prisma.user.create({
      data: {
        id: userId,
        email: `durable-${userId}@example.test`,
        status: "ACTIVE",
      },
    });
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { userId } });
    await prisma.webhookInbox.deleteMany({
      where: { provider: `integration-${userId}` },
    });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("reserves, rejects mismatched reuse, completes, and replays an idempotent request", async () => {
    const request = {
      userId,
      route: "/api/v1/goals",
      key: randomUUID(),
      requestHash: "a".repeat(64),
      requestedAt: now,
      expiresAt: new Date(now.getTime() + 86_400_000),
    };

    const reserved = await idempotency.reserve(request);
    expect(reserved.kind).toBe("reserved");
    if (reserved.kind !== "reserved") throw new Error("Expected reservation");

    await expect(idempotency.reserve(request)).resolves.toMatchObject({
      kind: "in_progress",
      recordId: reserved.recordId,
    });
    await expect(
      idempotency.reserve({ ...request, requestHash: "b".repeat(64) }),
    ).resolves.toEqual({ kind: "conflict" });

    await idempotency.complete({
      recordId: reserved.recordId,
      userId,
      requestHash: request.requestHash,
      statusCode: 201,
      response: { data: { id: userId } },
      resourceId: userId,
      completedAt: now,
    });
    await expect(idempotency.reserve(request)).resolves.toMatchObject({
      kind: "replay",
      statusCode: 201,
      resourceId: userId,
    });
  });

  it("leases distinct outbox events and fences acknowledgements by worker", async () => {
    const eventIds = await Promise.all(
      [1, 2].map((aggregateVersion) =>
        outbox.enqueue({
          userId,
          aggregateType: "goal",
          aggregateId: userId,
          aggregateVersion,
          eventType: "goal.changed",
          payload: { userId },
          occurredAt: now,
        }),
      ),
    );
    const claimInput = {
      now,
      leaseExpiresBefore: new Date(now.getTime() - 60_000),
      limit: 1,
    };
    const [first, second] = await Promise.all([
      outbox.claim({ ...claimInput, workerId: "worker-a" }),
      outbox.claim({ ...claimInput, workerId: "worker-b" }),
    ]);

    expect(new Set([...first, ...second].map((event) => event.id))).toEqual(
      new Set(eventIds),
    );
    expect(await outbox.markPublished(first[0]!.id, "wrong-worker", now)).toBe(
      false,
    );
    expect(await outbox.markPublished(first[0]!.id, "worker-a", now)).toBe(
      true,
    );
    expect(
      await outbox.reschedule({
        itemId: second[0]!.id,
        workerId: "worker-b",
        failureCode: "PROVIDER_REJECTED",
        failedAt: now,
      }),
    ).toBe(true);
  });

  it("deduplicates encrypted webhooks and processes a leased item", async () => {
    const provider = `integration-${userId}`;
    const event = {
      provider,
      externalEventId: randomUUID(),
      payloadHash: "c".repeat(64),
      payloadEncrypted: new Uint8Array(new ArrayBuffer(16)),
      encryptionKeyId: "integration-key-v1",
      receivedAt: now,
    };
    const accepted = await inbox.receive(event);
    expect(accepted.kind).toBe("accepted");
    await expect(inbox.receive(event)).resolves.toMatchObject({
      kind: "duplicate",
    });
    await expect(
      inbox.receive({ ...event, payloadHash: "d".repeat(64) }),
    ).resolves.toEqual({ kind: "conflict" });

    const claimed = await inbox.claim({
      workerId: "webhook-worker",
      now,
      leaseExpiresBefore: new Date(now.getTime() - 60_000),
      limit: 1,
    });
    expect(claimed).toHaveLength(1);
    expect(
      await inbox.markProcessed(claimed[0]!.id, "webhook-worker", now),
    ).toBe(true);
  });

  it("deduplicates, retries, and completes background jobs", async () => {
    const deduplicationKey = randomUUID();
    const job = {
      userId,
      queue: "reports",
      type: "weekly-report",
      deduplicationKey,
      payload: { week: "2026-W31" },
      availableAt: now,
    };
    const jobId = await jobs.enqueue(job);
    await expect(jobs.enqueue(job)).resolves.toBe(jobId);

    const claim = {
      workerId: "job-worker",
      now,
      leaseExpiresBefore: new Date(now.getTime() - 60_000),
      limit: 1,
    };
    const first = await jobs.claim("reports", claim);
    expect(first[0]?.id).toBe(jobId);
    const retryAt = new Date(now.getTime() + 30_000);
    expect(
      await jobs.reschedule({
        itemId: jobId,
        workerId: "job-worker",
        failureCode: "TEMPORARY",
        nextAttemptAt: retryAt,
        failedAt: now,
      }),
    ).toBe(true);

    const second = await jobs.claim("reports", { ...claim, now: retryAt });
    expect(second[0]?.attempts).toBe(2);
    expect(
      await jobs.complete(jobId, "job-worker", retryAt, {
        assetId: "report-1",
      }),
    ).toBe(true);
  });

  it("enforces one active Focus Session per user and uses the partial index", async () => {
    await prisma.focusSession.create({
      data: {
        userId,
        kind: "DEEP_WORK",
        intent: "Integration test",
        plannedSeconds: 1500,
        clientCommandId: randomUUID(),
        timeZone: "UTC",
        startedAt: now,
      },
    });
    await expect(
      prisma.focusSession.create({
        data: {
          userId,
          kind: "POMODORO",
          intent: "Must be rejected",
          plannedSeconds: 1500,
          clientCommandId: randomUUID(),
          timeZone: "UTC",
          pomodoroConfig: {
            focusSeconds: 1500,
            shortBreakSeconds: 300,
            longBreakSeconds: 900,
            cycles: 4,
            longBreakEvery: 4,
            autoStartBreaks: false,
            autoStartFocus: false,
            audioEnabled: true,
            vibrationEnabled: false,
          },
          startedAt: now,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    const plan = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
      return transaction.$queryRaw<Array<{ "QUERY PLAN": string }>>`
        EXPLAIN (COSTS OFF)
        SELECT "id" FROM "focus_sessions"
        WHERE "userId" = ${userId}::uuid AND "status" IN ('RUNNING', 'PAUSED')
      `;
    });
    expect(plan.map((row) => row["QUERY PLAN"]).join(" ")).toMatch(
      /focus_sessions_(one_active_per_user|userId_status)_idx/,
    );
  });
});
