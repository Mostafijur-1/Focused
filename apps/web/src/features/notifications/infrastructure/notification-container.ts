import "server-only";

import { getPrismaClient } from "@focused/database";

import type { SecretCipher } from "@/features/auth/application/oauth-ports";
import { AesGcmSecretCipher } from "@/features/auth/infrastructure/crypto/aes-gcm-secret-cipher";
import { NotificationService } from "@/features/notifications/application/notification-service";
import { NotificationWorker } from "@/features/notifications/application/notification-worker";
import { ReminderService } from "@/features/notifications/application/reminder-service";
import { QStashReminderScheduler } from "@/features/notifications/infrastructure/jobs/qstash-reminder-scheduler";
import { QStashSignatureVerifier } from "@/features/notifications/infrastructure/jobs/qstash-signature-verifier";
import { PrismaNotificationRepository } from "@/features/notifications/infrastructure/persistence/prisma-notification-repository";
import { NodeWebPushGateway } from "@/features/notifications/infrastructure/push/web-push-gateway";
import { SystemClock } from "@/infrastructure/time/system-clock";
import { getServerEnvironment } from "@/lib/config/server-env";
import { AppError } from "@/lib/errors/app-error";

let notificationService: NotificationService | undefined;
let reminderService: ReminderService | undefined;
let notificationWorker: NotificationWorker | undefined;
let signatureVerifier: QStashSignatureVerifier | undefined;

export function getNotificationService(): NotificationService {
  if (notificationService) return notificationService;
  const dependencies = notificationDependencies();
  notificationService = new NotificationService({
    ...dependencies,
    worker: getNotificationWorker(),
  });
  return notificationService;
}

export function getReminderService(): ReminderService {
  if (reminderService) return reminderService;
  const environment = getServerEnvironment();
  const { repository, clock } = notificationDependencies();
  reminderService = new ReminderService({
    repository,
    clock,
    scheduler: new QStashReminderScheduler({
      token: environment.QSTASH_TOKEN,
      appUrl: environment.NEXT_PUBLIC_APP_URL,
    }),
  });
  return reminderService;
}

export function getNotificationWorker(): NotificationWorker {
  if (notificationWorker) return notificationWorker;
  notificationWorker = new NotificationWorker(notificationDependencies());
  return notificationWorker;
}

export function getNotificationWorkerVerifier(): QStashSignatureVerifier {
  if (signatureVerifier) return signatureVerifier;
  const environment = getServerEnvironment();
  signatureVerifier = new QStashSignatureVerifier(
    environment.QSTASH_CURRENT_SIGNING_KEY,
    environment.QSTASH_NEXT_SIGNING_KEY,
  );
  return signatureVerifier;
}

function notificationDependencies() {
  const environment = getServerEnvironment();
  if (!environment.DATABASE_URL) {
    throw new AppError({
      code: "DEPENDENCY_UNAVAILABLE",
      safeMessage: "Notifications are not configured for this environment.",
    });
  }
  const cipher: SecretCipher = environment.AUTH_DATA_ENCRYPTION_KEY_BASE64
    ? new AesGcmSecretCipher(environment.AUTH_DATA_ENCRYPTION_KEY_BASE64)
    : new UnavailableSecretCipher();
  const push = new NodeWebPushGateway({
    subject: environment.VAPID_SUBJECT,
    publicKey: environment.VAPID_PUBLIC_KEY,
    privateKey: environment.VAPID_PRIVATE_KEY,
  });
  return {
    repository: new PrismaNotificationRepository(
      getPrismaClient(environment.DATABASE_URL),
    ),
    push,
    cipher,
    clock: new SystemClock(),
  };
}

class UnavailableSecretCipher implements SecretCipher {
  encrypt(): Uint8Array<ArrayBuffer> {
    throw unavailable();
  }

  decrypt(): string {
    throw unavailable();
  }
}

function unavailable(): AppError {
  return new AppError({
    code: "DEPENDENCY_UNAVAILABLE",
    safeMessage: "Push subscription encryption is not configured.",
  });
}
