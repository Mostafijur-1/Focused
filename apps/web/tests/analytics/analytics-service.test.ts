import { describe, expect, it, vi } from "vitest";

import type { SecretCipher } from "@/features/auth/application/oauth-ports";
import type { AuthUser } from "@/features/auth/domain/auth-types";
import {
  AnalyticsService,
  resolveRange,
} from "@/features/analytics/application/analytics-service";
import type { AnalyticsRepository } from "@/features/analytics/application/ports";
import { emptyDailyValues } from "@/features/analytics/domain/analytics-policy";
import { analyticsDateRange } from "@/features/analytics/domain/analytics-time";
import { AppError } from "@/lib/errors/app-error";

const now = new Date("2026-08-01T12:00:00.000Z");
const actor: AuthUser = {
  id: "9b523680-d60a-40e9-889b-ded3c417944b",
  email: "analytics@example.test",
  displayName: "Mostafijur",
  passwordHash: null,
  emailVerifiedAt: now,
  status: "ACTIVE",
  permissionVersion: 1,
  permissions: [
    "analytics:read:own",
    "analytics:write:own",
    "reports:read:own",
    "reports:write:own",
    "exports:read:own",
    "exports:write:own",
    "gamification:read:own",
    "gamification:write:own",
  ],
};

describe("AnalyticsService", () => {
  it("uses a 28-day local-date default and reconciles positive gamification", async () => {
    const repository = repositoryDouble();
    const service = buildService(repository);

    const result = await service.getAnalytics(actor);

    expect(result.range).toEqual({
      start: "2026-07-05",
      end: "2026-08-01",
      days: 28,
    });
    expect(repository.readProjection).toHaveBeenCalledWith({
      userId: actor.id,
      range: { start: "2026-07-05", end: "2026-08-01" },
      now,
    });
    expect(repository.reconcileGamification).toHaveBeenCalledOnce();
  });

  it("rejects future, reversed, and overlong ranges", () => {
    expect(() =>
      resolveRange(
        { start: "2026-08-01", end: "2026-08-02" },
        now,
        "Asia/Dhaka",
      ),
    ).toThrow(AppError);
    expect(() =>
      resolveRange(
        { start: "2026-08-01", end: "2026-07-01" },
        now,
        "Asia/Dhaka",
      ),
    ).toThrow(AppError);
    expect(() =>
      resolveRange(
        { start: "2025-01-01", end: "2026-08-01" },
        now,
        "Asia/Dhaka",
      ),
    ).toThrow(AppError);
  });

  it("enforces owner-scoped analytics permission", async () => {
    await expect(
      buildService(repositoryDouble()).getAnalytics({
        ...actor,
        permissions: [],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("turns preference concurrency failures into a stable conflict", async () => {
    const repository = repositoryDouble();
    repository.setGamification.mockResolvedValue("conflict");
    await expect(
      buildService(repository).setGamification(actor, {
        enabled: false,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });
});

function buildService(repository: ReturnType<typeof repositoryDouble>) {
  const cipher: SecretCipher = {
    encrypt: (value) => Uint8Array.from(Buffer.from(value)),
    decrypt: (value) => Buffer.from(value).toString("utf8"),
  };
  return new AnalyticsService({
    repository,
    cipher,
    clock: { now: () => now },
  });
}

function repositoryDouble() {
  return {
    identity: vi.fn<AnalyticsRepository["identity"]>(async () => ({
      timeZone: "Asia/Dhaka",
    })),
    readProjection: vi.fn<AnalyticsRepository["readProjection"]>(
      async (input) => ({
        days: analyticsDateRange(input.range.start, input.range.end).map(
          (localDate) => ({ localDate, ...emptyDailyValues() }),
        ),
        computedAt: input.now,
        sourceThrough: input.now,
        partial: false,
        limitations: [],
      }),
    ),
    rebuildProjection: vi.fn<AnalyticsRepository["rebuildProjection"]>(),
    readStoredDays: vi.fn<AnalyticsRepository["readStoredDays"]>(
      async () => [],
    ),
    createReport: vi.fn<AnalyticsRepository["createReport"]>(),
    listReports: vi.fn<AnalyticsRepository["listReports"]>(async () => []),
    createExport: vi.fn<AnalyticsRepository["createExport"]>(),
    listExports: vi.fn<AnalyticsRepository["listExports"]>(async () => []),
    downloadExport: vi.fn<AnalyticsRepository["downloadExport"]>(),
    gamification: vi.fn<AnalyticsRepository["gamification"]>(),
    setGamification: vi.fn<AnalyticsRepository["setGamification"]>(),
    reconcileGamification: vi.fn<AnalyticsRepository["reconcileGamification"]>(
      async () => undefined,
    ),
  } satisfies AnalyticsRepository;
}
