/** @vitest-environment node */

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@focused/database/generated/client";

import type { RequestSecurityContext } from "@/features/auth/domain/auth-types";
import { NodeTokenGenerator } from "@/features/auth/infrastructure/crypto/node-token-generator";
import { PrismaAuthRepository } from "@/features/auth/infrastructure/persistence/prisma-auth-repository";

const connectionString = process.env.INTEGRATION_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("PrismaAuthRepository against PostgreSQL", () => {
  const tokens = new NodeTokenGenerator();
  const userId = randomUUID();
  const verificationToken = tokens.opaque();
  const now = new Date("2026-07-31T12:00:00.000Z");
  const context: RequestSecurityContext = {
    requestId: `integration-${userId}`,
    ipPrefix: "127.0.0.0/24",
    userAgentHash: tokens.digest("vitest-postgresql"),
    deviceName: "Integration test",
  };
  let prisma: PrismaClient;
  let repository: PrismaAuthRepository;

  beforeAll(() => {
    const adapter = new PrismaPg({ connectionString: connectionString! });
    prisma = new PrismaClient({ adapter });
    repository = new PrismaAuthRepository(prisma);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.auditEvent.deleteMany({
      where: { correlationId: context.requestId },
    });
    await prisma.$disconnect();
  });

  it("persists registration, consumes verification once, and revokes a replayed refresh family", async () => {
    await expect(
      repository.createUser({
        id: userId,
        email: `integration-${userId}@example.test`,
        displayName: "Integration Member",
        passwordHash: "$argon2id$integration-placeholder",
        locale: "bn-BD",
        timeZone: "Asia/Dhaka",
        verificationTokenHash: tokens.digest(verificationToken),
        verificationExpiresAt: new Date(now.getTime() + 30 * 60_000),
        context,
      }),
    ).resolves.toBe("created");

    const verified = await repository.consumeOneTimeToken(
      "EMAIL_VERIFICATION",
      tokens.digest(verificationToken),
      now,
      context,
    );
    expect(verified?.status).toBe("ACTIVE");
    await expect(
      repository.consumeOneTimeToken(
        "EMAIL_VERIFICATION",
        tokens.digest(verificationToken),
        now,
        context,
      ),
    ).resolves.toBeNull();

    const sessionId = randomUUID();
    const familyId = randomUUID();
    const originalRefresh = tokens.opaque();
    await repository.createSession({
      sessionId,
      familyId,
      refreshTokenId: randomUUID(),
      refreshTokenHash: tokens.digest(originalRefresh),
      refreshTokenExpiresAt: new Date(now.getTime() + 30 * 86_400_000),
      sessionExpiresAt: new Date(now.getTime() + 90 * 86_400_000),
      authMethod: "password",
      userId,
      context,
      now,
    });

    const rotation = await repository.rotateRefreshToken({
      presentedTokenHash: tokens.digest(originalRefresh),
      replacementTokenId: randomUUID(),
      replacementTokenHash: tokens.digest(tokens.opaque()),
      replacementExpiresAt: new Date(now.getTime() + 30 * 86_400_000),
      context,
      now: new Date(now.getTime() + 1_000),
    });
    expect(rotation.kind).toBe("rotated");

    const replay = await repository.rotateRefreshToken({
      presentedTokenHash: tokens.digest(originalRefresh),
      replacementTokenId: randomUUID(),
      replacementTokenHash: tokens.digest(tokens.opaque()),
      replacementExpiresAt: new Date(now.getTime() + 30 * 86_400_000),
      context,
      now: new Date(now.getTime() + 2_000),
    });
    expect(replay.kind).toBe("replayed");

    const persistedSession = await prisma.authSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    const activeFamilyMembers = await prisma.refreshToken.count({
      where: { familyId, revokedAt: null },
    });
    expect(persistedSession.status).toBe("REVOKED");
    expect(activeFamilyMembers).toBe(0);
  });
});
