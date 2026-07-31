export type JsonObject = Readonly<Record<string, unknown>>;

export interface IdempotencyRequest {
  readonly userId: string;
  readonly route: string;
  readonly key: string;
  readonly requestHash: string;
  readonly requestedAt: Date;
  readonly expiresAt: Date;
}

export type IdempotencyReservation =
  | { readonly kind: "reserved"; readonly recordId: string }
  | { readonly kind: "in_progress"; readonly recordId: string }
  | { readonly kind: "conflict" }
  | {
      readonly kind: "replay";
      readonly recordId: string;
      readonly statusCode: number;
      readonly response: unknown;
      readonly resourceId: string | null;
    };

export interface IdempotencyCompletion {
  readonly recordId: string;
  readonly userId: string;
  readonly requestHash: string;
  readonly statusCode: number;
  readonly response?: JsonObject;
  readonly resourceId?: string;
  readonly completedAt: Date;
}

export interface IdempotencyStore {
  reserve(request: IdempotencyRequest): Promise<IdempotencyReservation>;
  complete(completion: IdempotencyCompletion): Promise<void>;
  fail(completion: IdempotencyCompletion): Promise<void>;
}

export interface NewOutboxEvent {
  readonly userId?: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly eventType: string;
  readonly eventVersion?: number;
  readonly payload: JsonObject;
  readonly occurredAt: Date;
}

export interface ClaimedOutboxEvent {
  readonly id: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly payload: unknown;
  readonly occurredAt: Date;
  readonly publishAttempts: number;
}

export interface OutboxStore {
  enqueue(event: NewOutboxEvent): Promise<string>;
  claim(input: WorkerClaim): Promise<readonly ClaimedOutboxEvent[]>;
  markPublished(
    eventId: string,
    workerId: string,
    publishedAt: Date,
  ): Promise<boolean>;
  reschedule(input: WorkerFailure): Promise<boolean>;
}

export interface NewWebhookEvent {
  readonly provider: string;
  readonly externalEventId: string;
  readonly payloadHash: string;
  readonly payloadEncrypted: Uint8Array<ArrayBuffer>;
  readonly encryptionKeyId: string;
  readonly receivedAt: Date;
}

export type WebhookReceipt =
  | { readonly kind: "accepted"; readonly inboxId: string }
  | { readonly kind: "duplicate"; readonly inboxId: string }
  | { readonly kind: "conflict" };

export interface ClaimedWebhookEvent {
  readonly id: string;
  readonly provider: string;
  readonly externalEventId: string;
  readonly payloadEncrypted: Uint8Array<ArrayBuffer>;
  readonly encryptionKeyId: string;
  readonly attempts: number;
}

export interface WebhookInboxStore {
  receive(event: NewWebhookEvent): Promise<WebhookReceipt>;
  claim(input: WorkerClaim): Promise<readonly ClaimedWebhookEvent[]>;
  markProcessed(
    eventId: string,
    workerId: string,
    processedAt: Date,
  ): Promise<boolean>;
  reschedule(input: WorkerFailure): Promise<boolean>;
}

export interface NewBackgroundJob {
  readonly userId?: string;
  readonly queue: string;
  readonly type: string;
  readonly deduplicationKey?: string;
  readonly payload: JsonObject;
  readonly maxAttempts?: number;
  readonly availableAt: Date;
  readonly expiresAt?: Date;
}

export interface ClaimedBackgroundJob {
  readonly id: string;
  readonly userId: string | null;
  readonly queue: string;
  readonly type: string;
  readonly payload: unknown;
  readonly attempts: number;
  readonly maxAttempts: number;
}

export interface BackgroundJobStore {
  enqueue(job: NewBackgroundJob): Promise<string>;
  claim(
    queue: string,
    input: WorkerClaim,
  ): Promise<readonly ClaimedBackgroundJob[]>;
  complete(
    jobId: string,
    workerId: string,
    completedAt: Date,
    result?: JsonObject,
  ): Promise<boolean>;
  reschedule(input: WorkerFailure): Promise<boolean>;
}

export interface WorkerClaim {
  readonly workerId: string;
  readonly now: Date;
  readonly leaseExpiresBefore: Date;
  readonly limit: number;
}

export interface WorkerFailure {
  readonly itemId: string;
  readonly workerId: string;
  readonly failureCode: string;
  readonly nextAttemptAt?: Date;
  readonly failedAt: Date;
}
