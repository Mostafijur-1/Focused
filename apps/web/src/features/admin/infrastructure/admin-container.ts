import "server-only";

import { getPrismaClient } from "@focused/database";

import { AdminService } from "@/features/admin/application/admin-service";
import { AdminSecurityService } from "@/features/admin/application/admin-security-service";
import { AesGcmSecretCipher } from "@/features/auth/infrastructure/crypto/aes-gcm-secret-cipher";
import { ArgonPasswordHasher } from "@/features/auth/infrastructure/crypto/argon-password-hasher";
import { NodeTokenGenerator } from "@/features/auth/infrastructure/crypto/node-token-generator";
import { PrismaAdminRepository } from "@/features/admin/infrastructure/persistence/prisma-admin-repository";
import { getServerEnvironment } from "@/lib/config/server-env";
import { AppError } from "@/lib/errors/app-error";

let service: AdminService | undefined;
let securityService: AdminSecurityService | undefined;

export function getAdminService(): AdminService {
  if (service) return service;
  const environment = getServerEnvironment();
  if (!environment.DATABASE_URL) {
    throw new AppError({
      code: "DEPENDENCY_UNAVAILABLE",
      safeMessage: "Administration is not configured for this environment.",
    });
  }
  service = new AdminService({
    repository: new PrismaAdminRepository(
      getPrismaClient(environment.DATABASE_URL),
      {
        groqConfigured: Boolean(environment.GROQ_API_KEY),
        geminiConfigured: Boolean(environment.GEMINI_API_KEY),
        redisConfigured: Boolean(
          environment.UPSTASH_REDIS_REST_URL &&
          environment.UPSTASH_REDIS_REST_TOKEN,
        ),
        pushConfigured: Boolean(
          environment.VAPID_SUBJECT &&
          environment.VAPID_PUBLIC_KEY &&
          environment.VAPID_PRIVATE_KEY,
        ),
      },
    ),
    now: () => new Date(),
  });
  return service;
}

export function getAdminSecurityService(): AdminSecurityService {
  if (securityService) return securityService;
  const environment = getServerEnvironment();
  if (
    !environment.DATABASE_URL ||
    !environment.AUTH_DATA_ENCRYPTION_KEY_BASE64
  ) {
    throw new AppError({
      code: "DEPENDENCY_UNAVAILABLE",
      safeMessage:
        "Administrative security is not configured for this environment.",
    });
  }
  const repository = new PrismaAdminRepository(
    getPrismaClient(environment.DATABASE_URL),
    {
      groqConfigured: Boolean(environment.GROQ_API_KEY),
      geminiConfigured: Boolean(environment.GEMINI_API_KEY),
      redisConfigured: Boolean(
        environment.UPSTASH_REDIS_REST_URL &&
        environment.UPSTASH_REDIS_REST_TOKEN,
      ),
      pushConfigured: Boolean(
        environment.VAPID_SUBJECT &&
        environment.VAPID_PUBLIC_KEY &&
        environment.VAPID_PRIVATE_KEY,
      ),
    },
  );
  securityService = new AdminSecurityService({
    repository,
    cipher: new AesGcmSecretCipher(environment.AUTH_DATA_ENCRYPTION_KEY_BASE64),
    passwordHasher: new ArgonPasswordHasher(),
    tokens: new NodeTokenGenerator(),
    encryptionKeyId: environment.AUTH_JWT_KEY_ID,
    now: () => new Date(),
  });
  return securityService;
}
