import { describe, expect, it } from "vitest";

import {
  auditQuerySchema,
  changeAdminUserStatusSchema,
  createAdminStepUpSchema,
  openAdminCaseSchema,
  requestRoleChangeSchema,
  updateAdminFeatureFlagSchema,
  verifyAdminMfaSchema,
} from "@/features/admin/transport/admin-schemas";

const caseId = "27400aaa-0f95-4436-83d6-894e01447601";
const commandId = "1d4bdc23-8fe2-4b08-bf7d-fbeb034f7518";
const targetId = "f0fed090-f920-46f5-a092-4071bb08d3fd";

describe("Admin transport schemas", () => {
  it("accepts a bounded reason-coded case and rejects unknown fields", () => {
    expect(
      openAdminCaseSchema.parse({
        reasonCode: "ACCOUNT_ACCESS",
        summary: "Investigate an account access support ticket.",
        durationMinutes: 60,
      }),
    ).toMatchObject({ durationMinutes: 60 });
    expect(
      openAdminCaseSchema.safeParse({
        reasonCode: "ACCOUNT_ACCESS",
        summary: "Investigate an account access support ticket.",
        durationMinutes: 60,
        privateNote: "not allowed",
      }).success,
    ).toBe(false);
  });

  it("requires target type whenever a step-up grant binds a target ID", () => {
    expect(
      createAdminStepUpSchema.safeParse({
        code: "123456",
        expectedMfaVersion: 2,
        scope: "USER_STATUS_WRITE",
        targetId,
      }).success,
    ).toBe(false);
    expect(
      createAdminStepUpSchema.safeParse({
        code: "123456",
        expectedMfaVersion: 2,
        scope: "USER_STATUS_WRITE",
        targetType: "User",
        targetId,
      }).success,
    ).toBe(true);
    expect(
      createAdminStepUpSchema.safeParse({
        code: "123456",
        expectedMfaVersion: 2,
        scope: "FEATURE_FLAG_WRITE",
      }).success,
    ).toBe(true);
  });

  it("validates MFA, status, Feature Flag, and role command boundaries", () => {
    expect(
      verifyAdminMfaSchema.safeParse({ code: "12A456", expectedVersion: 1 })
        .success,
    ).toBe(false);
    expect(
      changeAdminUserStatusSchema.parse({
        caseId,
        clientCommandId: commandId,
        status: "SUSPENDED",
        expectedVersion: 3,
      }).status,
    ).toBe("SUSPENDED");
    expect(
      updateAdminFeatureFlagSchema.safeParse({
        caseId,
        clientCommandId: commandId,
        expectedVersion: 1,
        enabled: true,
        owner: "platform",
        purpose: "Gradually expose the new safe workflow.",
        audience: { percentage: 10 },
        rollbackPlan: "Disable the flag and verify service health.",
      }).success,
    ).toBe(true);
    expect(
      requestRoleChangeSchema.safeParse({
        caseId,
        clientCommandId: commandId,
        targetUserId: targetId,
        roleKey: "member",
        operation: "GRANT",
        expectedUserVersion: 1,
      }).success,
    ).toBe(false);
  });

  it("coerces and bounds audit pagination", () => {
    expect(auditQuerySchema.parse({ caseId, limit: "50" }).limit).toBe(50);
    expect(auditQuerySchema.safeParse({ caseId, limit: "101" }).success).toBe(
      false,
    );
  });
});
