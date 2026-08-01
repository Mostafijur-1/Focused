import "server-only";

import { getPrismaClient } from "@focused/database";

import type { SecretCipher } from "@/features/auth/application/oauth-ports";
import { AnalyticsService } from "@/features/analytics/application/analytics-service";
import { AesGcmSecretCipher } from "@/features/auth/infrastructure/crypto/aes-gcm-secret-cipher";
import { PrismaAnalyticsRepository } from "@/features/analytics/infrastructure/persistence/prisma-analytics-repository";
import { SystemClock } from "@/infrastructure/time/system-clock";
import { getServerEnvironment } from "@/lib/config/server-env";
import { AppError } from "@/lib/errors/app-error";

let service: AnalyticsService | undefined;

export function getAnalyticsService(): AnalyticsService {
  if (service) return service;
  const environment = getServerEnvironment();
  if (!environment.DATABASE_URL) {
    throw new AppError({
      code: "DEPENDENCY_UNAVAILABLE",
      safeMessage: "Analytics is not configured for this environment.",
    });
  }
  const cipher: SecretCipher = environment.AUTH_DATA_ENCRYPTION_KEY_BASE64
    ? new AesGcmSecretCipher(environment.AUTH_DATA_ENCRYPTION_KEY_BASE64)
    : new UnavailableExportCipher();
  service = new AnalyticsService({
    repository: new PrismaAnalyticsRepository(
      getPrismaClient(environment.DATABASE_URL),
    ),
    cipher,
    clock: new SystemClock(),
  });
  return service;
}

class UnavailableExportCipher implements SecretCipher {
  encrypt(): Uint8Array<ArrayBuffer> {
    throw unavailable();
  }
  decrypt(): string {
    throw unavailable();
  }
}

function unavailable() {
  return new AppError({
    code: "DEPENDENCY_UNAVAILABLE",
    safeMessage: "Export encryption is not configured.",
  });
}
