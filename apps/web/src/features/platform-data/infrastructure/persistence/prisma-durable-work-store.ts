import type { FocusedPrismaClient } from "@focused/database";
import { Prisma } from "@focused/database/generated/client";

import type {
  BackgroundJobStore,
  ClaimedBackgroundJob,
  ClaimedOutboxEvent,
  ClaimedWebhookEvent,
  IdempotencyCompletion,
  IdempotencyRequest,
  IdempotencyReservation,
  IdempotencyStore,
  NewBackgroundJob,
  NewOutboxEvent,
  NewWebhookEvent,
  OutboxStore,
  WebhookInboxStore,
  WebhookReceipt,
  WorkerClaim,
  WorkerFailure,
} from "@/features/platform-data/application/durable-work-ports";

type TransactionClient = Parameters<
  Parameters<FocusedPrismaClient["$transaction"]>[0]
>[0];

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function requireSingleUpdate(count: number, operation: string): void {
  if (count !== 1) {
    throw new Error(`Durable state transition rejected: ${operation}`);
  }
}

export class PrismaIdempotencyStore implements IdempotencyStore {
  constructor(private readonly prisma: FocusedPrismaClient) {}

  async reserve(request: IdempotencyRequest): Promise<IdempotencyReservation> {
    const { requestedAt, ...recordData } = request;
    try {
      const record = await this.prisma.idempotencyRecord.create({
        data: recordData,
        select: { id: true },
      });
      return { kind: "reserved", recordId: record.id };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }

    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        userId_route_key: {
          userId: request.userId,
          route: request.route,
          key: request.key,
        },
      },
      select: {
        id: true,
        requestHash: true,
        status: true,
        statusCode: true,
        response: true,
        resourceId: true,
        expiresAt: true,
      },
    });

    if (!existing) return this.reserve(request);
    if (existing.requestHash !== request.requestHash)
      return { kind: "conflict" };
    if (existing.expiresAt <= requestedAt) return { kind: "conflict" };
    if (existing.status === "PROCESSING") {
      return { kind: "in_progress", recordId: existing.id };
    }
    if (existing.statusCode === null) {
      throw new Error("Completed idempotency record has no HTTP status");
    }
    return {
      kind: "replay",
      recordId: existing.id,
      statusCode: existing.statusCode,
      response: existing.response,
      resourceId: existing.resourceId,
    };
  }

  async complete(completion: IdempotencyCompletion): Promise<void> {
    await this.transition(completion, "COMPLETED");
  }

  async fail(completion: IdempotencyCompletion): Promise<void> {
    await this.transition(completion, "FAILED");
  }

  private async transition(
    completion: IdempotencyCompletion,
    status: "COMPLETED" | "FAILED",
  ): Promise<void> {
    const result = await this.prisma.idempotencyRecord.updateMany({
      where: {
        id: completion.recordId,
        userId: completion.userId,
        requestHash: completion.requestHash,
        status: "PROCESSING",
      },
      data: {
        status,
        statusCode: completion.statusCode,
        ...(completion.response
          ? { response: completion.response as Prisma.InputJsonValue }
          : {}),
        ...(completion.resourceId ? { resourceId: completion.resourceId } : {}),
        completedAt: completion.completedAt,
      },
    });
    requireSingleUpdate(result.count, `idempotency.${status.toLowerCase()}`);
  }
}

export class PrismaOutboxStore implements OutboxStore {
  constructor(private readonly prisma: FocusedPrismaClient) {}

  async enqueue(event: NewOutboxEvent): Promise<string> {
    return appendOutboxEvent(this.prisma, event);
  }

  async claim(input: WorkerClaim): Promise<readonly ClaimedOutboxEvent[]> {
    return this.prisma.$queryRaw<ClaimedOutboxEvent[]>(Prisma.sql`
      WITH candidates AS (
        SELECT "id"
        FROM "outbox_events"
        WHERE "publishedAt" IS NULL
          AND "deadLetteredAt" IS NULL
          AND "nextAttemptAt" <= ${input.now}
          AND ("lockedAt" IS NULL OR "lockedAt" < ${input.leaseExpiresBefore})
        ORDER BY "nextAttemptAt", "occurredAt", "id"
        FOR UPDATE SKIP LOCKED
        LIMIT ${input.limit}
      )
      UPDATE "outbox_events" event
      SET "lockedAt" = ${input.now},
          "lockedBy" = ${input.workerId},
          "publishAttempts" = event."publishAttempts" + 1
      FROM candidates
      WHERE event."id" = candidates."id"
      RETURNING event."id", event."aggregateType", event."aggregateId",
        event."eventType", event."eventVersion", event."payload",
        event."occurredAt", event."publishAttempts"
    `);
  }

  async markPublished(
    eventId: string,
    workerId: string,
    publishedAt: Date,
  ): Promise<boolean> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id: eventId,
        lockedBy: workerId,
        publishedAt: null,
        deadLetteredAt: null,
      },
      data: { publishedAt, lockedAt: null, lockedBy: null, failureCode: null },
    });
    return result.count === 1;
  }

  async reschedule(input: WorkerFailure): Promise<boolean> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id: input.itemId,
        lockedBy: input.workerId,
        publishedAt: null,
        deadLetteredAt: null,
      },
      data: {
        failureCode: input.failureCode,
        nextAttemptAt: input.nextAttemptAt ?? input.failedAt,
        deadLetteredAt: input.nextAttemptAt ? null : input.failedAt,
        lockedAt: null,
        lockedBy: null,
      },
    });
    return result.count === 1;
  }
}

export async function appendOutboxEvent(
  transaction: FocusedPrismaClient | TransactionClient,
  event: NewOutboxEvent,
): Promise<string> {
  const created = await transaction.outboxEvent.create({
    data: {
      ...event,
      eventVersion: event.eventVersion ?? 1,
      payload: event.payload as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  return created.id;
}

export class PrismaWebhookInboxStore implements WebhookInboxStore {
  constructor(private readonly prisma: FocusedPrismaClient) {}

  async receive(event: NewWebhookEvent): Promise<WebhookReceipt> {
    try {
      const created = await this.prisma.webhookInbox.create({
        data: event,
        select: { id: true },
      });
      return { kind: "accepted", inboxId: created.id };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }

    const existing = await this.prisma.webhookInbox.findUnique({
      where: {
        provider_externalEventId: {
          provider: event.provider,
          externalEventId: event.externalEventId,
        },
      },
      select: { id: true, payloadHash: true },
    });
    if (!existing) return this.receive(event);
    return existing.payloadHash === event.payloadHash
      ? { kind: "duplicate", inboxId: existing.id }
      : { kind: "conflict" };
  }

  async claim(input: WorkerClaim): Promise<readonly ClaimedWebhookEvent[]> {
    return this.prisma.$queryRaw<ClaimedWebhookEvent[]>(Prisma.sql`
      WITH candidates AS (
        SELECT "id"
        FROM "webhook_inbox"
        WHERE "status" IN ('RECEIVED', 'RETRYABLE_FAILURE')
          AND "nextAttemptAt" <= ${input.now}
          AND ("lockedAt" IS NULL OR "lockedAt" < ${input.leaseExpiresBefore})
        ORDER BY "nextAttemptAt", "receivedAt", "id"
        FOR UPDATE SKIP LOCKED
        LIMIT ${input.limit}
      )
      UPDATE "webhook_inbox" event
      SET "status" = 'PROCESSING',
          "lockedAt" = ${input.now},
          "lockedBy" = ${input.workerId},
          "attempts" = event."attempts" + 1
      FROM candidates
      WHERE event."id" = candidates."id"
      RETURNING event."id", event."provider", event."externalEventId",
        event."payloadEncrypted", event."encryptionKeyId", event."attempts"
    `);
  }

  async markProcessed(
    eventId: string,
    workerId: string,
    processedAt: Date,
  ): Promise<boolean> {
    const result = await this.prisma.webhookInbox.updateMany({
      where: { id: eventId, lockedBy: workerId, status: "PROCESSING" },
      data: {
        status: "PROCESSED",
        processedAt,
        lockedAt: null,
        lockedBy: null,
        failureCode: null,
      },
    });
    return result.count === 1;
  }

  async reschedule(input: WorkerFailure): Promise<boolean> {
    const result = await this.prisma.webhookInbox.updateMany({
      where: {
        id: input.itemId,
        lockedBy: input.workerId,
        status: "PROCESSING",
      },
      data: {
        status: input.nextAttemptAt ? "RETRYABLE_FAILURE" : "DEAD_LETTER",
        nextAttemptAt: input.nextAttemptAt ?? input.failedAt,
        failureCode: input.failureCode,
        lockedAt: null,
        lockedBy: null,
      },
    });
    return result.count === 1;
  }
}

export class PrismaBackgroundJobStore implements BackgroundJobStore {
  constructor(private readonly prisma: FocusedPrismaClient) {}

  async enqueue(job: NewBackgroundJob): Promise<string> {
    try {
      const created = await this.prisma.backgroundJob.create({
        data: {
          ...job,
          payload: job.payload as Prisma.InputJsonValue,
          maxAttempts: job.maxAttempts ?? 5,
        },
        select: { id: true },
      });
      return created.id;
    } catch (error) {
      if (!job.deduplicationKey || !isUniqueConstraintError(error)) throw error;
      const existing = await this.prisma.backgroundJob.findUnique({
        where: {
          queue_deduplicationKey: {
            queue: job.queue,
            deduplicationKey: job.deduplicationKey,
          },
        },
        select: { id: true },
      });
      if (!existing) return this.enqueue(job);
      return existing.id;
    }
  }

  async claim(
    queue: string,
    input: WorkerClaim,
  ): Promise<readonly ClaimedBackgroundJob[]> {
    return this.prisma.$queryRaw<ClaimedBackgroundJob[]>(Prisma.sql`
      WITH candidates AS (
        SELECT "id"
        FROM "background_jobs"
        WHERE "queue" = ${queue}
          AND "status" = 'QUEUED'
          AND "availableAt" <= ${input.now}
          AND ("expiresAt" IS NULL OR "expiresAt" > ${input.now})
          AND ("lockedAt" IS NULL OR "lockedAt" < ${input.leaseExpiresBefore})
          AND "attempts" < "maxAttempts"
        ORDER BY "availableAt", "createdAt", "id"
        FOR UPDATE SKIP LOCKED
        LIMIT ${input.limit}
      )
      UPDATE "background_jobs" job
      SET "status" = 'RUNNING',
          "lockedAt" = ${input.now},
          "lockedBy" = ${input.workerId},
          "startedAt" = COALESCE(job."startedAt", ${input.now}),
          "attempts" = job."attempts" + 1,
          "updatedAt" = ${input.now}
      FROM candidates
      WHERE job."id" = candidates."id"
      RETURNING job."id", job."userId", job."queue", job."type",
        job."payload", job."attempts", job."maxAttempts"
    `);
  }

  async complete(
    jobId: string,
    workerId: string,
    completedAt: Date,
    result?: Readonly<Record<string, unknown>>,
  ): Promise<boolean> {
    const updated = await this.prisma.backgroundJob.updateMany({
      where: { id: jobId, lockedBy: workerId, status: "RUNNING" },
      data: {
        status: "COMPLETED",
        completedAt,
        ...(result ? { result: result as Prisma.InputJsonValue } : {}),
        lockedAt: null,
        lockedBy: null,
        failureCode: null,
      },
    });
    return updated.count === 1;
  }

  async reschedule(input: WorkerFailure): Promise<boolean> {
    const current = await this.prisma.backgroundJob.findFirst({
      where: { id: input.itemId, lockedBy: input.workerId, status: "RUNNING" },
      select: { attempts: true, maxAttempts: true },
    });
    if (!current) return false;
    const canRetry =
      Boolean(input.nextAttemptAt) && current.attempts < current.maxAttempts;
    const updated = await this.prisma.backgroundJob.updateMany({
      where: { id: input.itemId, lockedBy: input.workerId, status: "RUNNING" },
      data: {
        status: canRetry ? "QUEUED" : "FAILED",
        availableAt: input.nextAttemptAt ?? input.failedAt,
        completedAt: canRetry ? null : input.failedAt,
        failureCode: input.failureCode,
        lockedAt: null,
        lockedBy: null,
      },
    });
    return updated.count === 1;
  }
}
