import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { AdminService } from "@/features/admin/application/admin-service";
import type { AdminRepository } from "@/features/admin/application/ports";
import type { AuthUser } from "@/features/auth/domain/auth-types";

const user: AuthUser = {
  id: "9b523680-d60a-40e9-889b-ded3c417944b",
  email: "admin@example.test",
  displayName: "Admin",
  passwordHash: "hash",
  emailVerifiedAt: new Date(),
  status: "ACTIVE",
  permissionVersion: 1,
  permissions: [
    "admin:access",
    "admin:cases:read",
    "admin:cases:write",
    "admin:health:read",
    "admin:users:read:metadata",
    "admin:users:status:write",
    "admin:sessions:revoke",
    "admin:feature_flags:read",
    "admin:feature_flags:write",
    "admin:audit:read",
    "admin:jobs:retry",
    "admin:roles:read",
    "admin:roles:write",
  ],
};

const context = {
  actor: { user, sessionId: "8ecb5ce5-39bc-40f9-a878-f1eb7f410401" },
  request: {
    requestId: "request-1",
    ipPrefix: null,
    userAgentHash: null,
    deviceName: null,
  },
};

describe("AdminService", () => {
  it("enforces exact member identifiers before repository access", async () => {
    const repository = repositoryDouble();
    const service = buildService(repository);

    expect(() =>
      service.findMember(
        context,
        "27400aaa-0f95-4436-83d6-894e01447601",
        "partial",
      ),
    ).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
    expect(repository.findMember).not.toHaveBeenCalled();
  });

  it("hashes the step-up token and excludes it from the request hash", async () => {
    const repository = repositoryDouble();
    const service = buildService(repository);
    const stepUpToken = "one-time-step-up-secret";

    await service.changeUserStatus(context, {
      caseId: "27400aaa-0f95-4436-83d6-894e01447601",
      clientCommandId: "1d4bdc23-8fe2-4b08-bf7d-fbeb034f7518",
      stepUpToken,
      targetUserId: "f0fed090-f920-46f5-a092-4071bb08d3fd",
      status: "SUSPENDED",
      expectedVersion: 2,
    });

    expect(repository.changeUserStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        stepUpTokenHash: createHash("sha256").update(stepUpToken).digest("hex"),
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
    );
  });

  it("rejects non-operational role keys", async () => {
    expect(() =>
      buildService(repositoryDouble()).requestRoleChange(context, {
        caseId: "27400aaa-0f95-4436-83d6-894e01447601",
        clientCommandId: "1d4bdc23-8fe2-4b08-bf7d-fbeb034f7518",
        stepUpToken: "secret",
        targetUserId: "f0fed090-f920-46f5-a092-4071bb08d3fd",
        roleKey: "member",
        operation: "GRANT",
        expectedUserVersion: 1,
      }),
    ).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });

  it("denies access when the explicit permission is absent", async () => {
    expect(() =>
      buildService(repositoryDouble()).getOverview(
        {
          ...context,
          actor: { ...context.actor, user: { ...user, permissions: [] } },
        },
        "27400aaa-0f95-4436-83d6-894e01447601",
      ),
    ).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });
});

function buildService(repository: AdminRepository) {
  return new AdminService({
    repository,
    now: () => new Date("2026-08-01T12:00:00.000Z"),
  });
}

function repositoryDouble(): AdminRepository {
  return {
    listCases: vi.fn(async () => []),
    openCase: vi.fn(),
    getOverview: vi.fn(),
    findMember: vi.fn(),
    listFeatureFlags: vi.fn(async () => []),
    listAuditEvents: vi.fn(async () => ({ items: [], nextCursor: null })),
    getHealth: vi.fn(),
    listJobs: vi.fn(async () => []),
    changeUserStatus: vi.fn(async (input) => ({
      id: input.targetUserId,
      version: input.expectedVersion + 1,
      state: input.status,
      replayed: false,
    })),
    revokeUserSessions: vi.fn(),
    updateFeatureFlag: vi.fn(),
    retryJob: vi.fn(),
    listApprovals: vi.fn(async () => []),
    requestRoleChange: vi.fn(),
    approveRoleChange: vi.fn(),
  };
}
