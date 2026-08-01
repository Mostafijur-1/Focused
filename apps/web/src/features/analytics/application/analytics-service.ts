import type { Clock } from "@/application/ports/clock";
import { requirePermission } from "@/features/auth/application/authorization-policy";
import type { SecretCipher } from "@/features/auth/application/oauth-ports";
import type { AuthUser } from "@/features/auth/domain/auth-types";
import type { AnalyticsRepository } from "@/features/analytics/application/ports";
import {
  analyticsLimits,
  summarizeAnalytics,
} from "@/features/analytics/domain/analytics-policy";
import type {
  AnalyticsExportFormat,
  AnalyticsRange,
  AnalyticsSnapshot,
} from "@/features/analytics/domain/analytics-types";
import {
  addAnalyticsDays,
  analyticsDaysInclusive,
  analyticsLocalDate,
} from "@/features/analytics/domain/analytics-time";
import { AppError } from "@/lib/errors/app-error";

interface AnalyticsServiceDependencies {
  readonly repository: AnalyticsRepository;
  readonly cipher: SecretCipher;
  readonly clock: Clock;
}

export class AnalyticsService {
  constructor(private readonly dependencies: AnalyticsServiceDependencies) {}

  async getAnalytics(user: AuthUser, requested?: Partial<AnalyticsRange>) {
    requirePermission(user, "analytics:read:own");
    const now = this.dependencies.clock.now();
    const identity = await this.dependencies.repository.identity(user.id);
    const range = resolveRange(requested, now, identity.timeZone);
    const projection = await this.dependencies.repository.readProjection({
      userId: user.id,
      range,
      now,
    });
    const snapshot = summarizeAnalytics({
      range,
      timeZone: identity.timeZone,
      ...projection,
    });
    await this.dependencies.repository.reconcileGamification({
      userId: user.id,
      snapshot,
      now,
    });
    return snapshot;
  }

  async rebuild(user: AuthUser, range: AnalyticsRange) {
    requirePermission(user, "analytics:write:own");
    const now = this.dependencies.clock.now();
    const identity = await this.dependencies.repository.identity(user.id);
    const validated = resolveRange(range, now, identity.timeZone);
    const projection = await this.dependencies.repository.rebuildProjection({
      userId: user.id,
      range: validated,
      timeZone: identity.timeZone,
      now,
    });
    return summarizeAnalytics({
      range: validated,
      timeZone: identity.timeZone,
      ...projection,
    });
  }

  async createReport(
    user: AuthUser,
    range: AnalyticsRange,
    clientCommandId: string,
  ) {
    requirePermission(user, "reports:write:own");
    const snapshot = await this.getAnalytics(user, range);
    const now = this.dependencies.clock.now();
    return this.dependencies.repository.createReport({
      userId: user.id,
      clientCommandId,
      snapshot,
      now,
      expiresAt: new Date(
        now.getTime() + analyticsLimits.reportTtlMilliseconds,
      ),
    });
  }

  async listReports(user: AuthUser) {
    requirePermission(user, "reports:read:own");
    return this.dependencies.repository.listReports(user.id);
  }

  async createExport(
    user: AuthUser,
    range: AnalyticsRange,
    format: AnalyticsExportFormat,
    clientCommandId: string,
  ) {
    requirePermission(user, "exports:write:own");
    const snapshot = await this.getAnalytics(user, range);
    const now = this.dependencies.clock.now();
    return this.dependencies.repository.createExport({
      userId: user.id,
      clientCommandId,
      snapshot,
      format,
      cipher: this.dependencies.cipher,
      now,
      expiresAt: new Date(
        now.getTime() + analyticsLimits.exportTtlMilliseconds,
      ),
    });
  }

  async listExports(user: AuthUser) {
    requirePermission(user, "exports:read:own");
    return this.dependencies.repository.listExports(user.id);
  }

  async downloadExport(user: AuthUser, exportId: string) {
    requirePermission(user, "exports:read:own");
    const result = await this.dependencies.repository.downloadExport({
      userId: user.id,
      exportId,
      cipher: this.dependencies.cipher,
      now: this.dependencies.clock.now(),
    });
    if (result === "not_found") {
      throw new AppError({
        code: "NOT_FOUND",
        safeMessage: "Export not found.",
      });
    }
    if (result === "expired") {
      throw new AppError({
        code: "NOT_FOUND",
        safeMessage: "This export has expired.",
      });
    }
    return result;
  }

  async gamification(user: AuthUser) {
    requirePermission(user, "gamification:read:own");
    return this.dependencies.repository.gamification(user.id);
  }

  async setGamification(
    user: AuthUser,
    input: Readonly<{ enabled: boolean; expectedVersion: number }>,
  ) {
    requirePermission(user, "gamification:write:own");
    const result = await this.dependencies.repository.setGamification({
      userId: user.id,
      ...input,
    });
    if (result === "conflict") {
      throw new AppError({
        code: "CONFLICT",
        safeMessage:
          "Analytics settings changed on another device. Refresh and try again.",
      });
    }
    return result;
  }
}

export function resolveRange(
  requested: Partial<AnalyticsRange> | undefined,
  now: Date,
  timeZone: string,
): AnalyticsRange {
  const today = analyticsLocalDate(now, timeZone);
  const end = requested?.end ?? today;
  const start =
    requested?.start ??
    addAnalyticsDays(end, -(analyticsLimits.defaultRangeDays - 1));
  let days: number;
  try {
    days = analyticsDaysInclusive(start, end);
  } catch {
    throw invalidRange();
  }
  if (days < 1 || days > analyticsLimits.maximumRangeDays || end > today) {
    throw invalidRange();
  }
  return { start, end };
}

function invalidRange() {
  return new AppError({
    code: "VALIDATION_ERROR",
    status: 422,
    safeMessage: `Choose a valid date range of 1–${analyticsLimits.maximumRangeDays} days that does not end in the future.`,
    details: { errors: [{ pointer: "/range", code: "invalid_date_range" }] },
  });
}

export type { AnalyticsSnapshot };
