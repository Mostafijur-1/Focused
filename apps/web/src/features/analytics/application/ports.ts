import type { SecretCipher } from "@/features/auth/application/oauth-ports";
import type {
  AnalyticsExportFormat,
  AnalyticsExportView,
  AnalyticsIdentity,
  AnalyticsRange,
  AnalyticsReportView,
  AnalyticsSnapshot,
  DailyAnalyticsPoint,
  GamificationView,
  StoredAnalyticsDay,
} from "@/features/analytics/domain/analytics-types";

export interface AnalyticsProjectionResult {
  readonly days: readonly DailyAnalyticsPoint[];
  readonly computedAt: Date;
  readonly sourceThrough: Date;
  readonly partial: boolean;
  readonly limitations: readonly string[];
}

export interface AnalyticsRepository {
  identity(userId: string): Promise<AnalyticsIdentity>;
  readProjection(input: {
    readonly userId: string;
    readonly range: AnalyticsRange;
    readonly now: Date;
  }): Promise<AnalyticsProjectionResult>;
  rebuildProjection(input: {
    readonly userId: string;
    readonly range: AnalyticsRange;
    readonly timeZone: string;
    readonly now: Date;
  }): Promise<AnalyticsProjectionResult>;
  readStoredDays(input: {
    readonly userId: string;
    readonly range: AnalyticsRange;
  }): Promise<readonly StoredAnalyticsDay[]>;
  createReport(input: {
    readonly userId: string;
    readonly clientCommandId: string;
    readonly snapshot: AnalyticsSnapshot;
    readonly now: Date;
    readonly expiresAt: Date;
  }): Promise<AnalyticsReportView>;
  listReports(userId: string): Promise<readonly AnalyticsReportView[]>;
  createExport(input: {
    readonly userId: string;
    readonly clientCommandId: string;
    readonly snapshot: AnalyticsSnapshot;
    readonly format: AnalyticsExportFormat;
    readonly cipher: SecretCipher;
    readonly now: Date;
    readonly expiresAt: Date;
  }): Promise<AnalyticsExportView>;
  listExports(userId: string): Promise<readonly AnalyticsExportView[]>;
  downloadExport(input: {
    readonly userId: string;
    readonly exportId: string;
    readonly cipher: SecretCipher;
    readonly now: Date;
  }): Promise<
    | Readonly<{
        content: string;
        contentType: string;
        fileName: string;
        checksum: string;
      }>
    | "not_found"
    | "expired"
  >;
  gamification(userId: string): Promise<GamificationView>;
  setGamification(input: {
    readonly userId: string;
    readonly enabled: boolean;
    readonly expectedVersion: number;
  }): Promise<GamificationView | "conflict">;
  reconcileGamification(input: {
    readonly userId: string;
    readonly snapshot: AnalyticsSnapshot;
    readonly now: Date;
  }): Promise<void>;
}
