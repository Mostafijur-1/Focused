import { z } from "zod";

import { adminReasonCodes } from "@/features/admin/domain/admin-types";
import { adminStepUpScopes } from "@/features/admin/domain/admin-security-types";

export const openAdminCaseSchema = z
  .object({
    externalReference: z.string().trim().min(3).max(160).optional(),
    reasonCode: z.enum(adminReasonCodes),
    summary: z.string().trim().min(12).max(300),
    durationMinutes: z.number().int().min(15).max(480),
  })
  .strict();

export const caseBoundQuerySchema = z.object({ caseId: z.uuid() }).strict();

export const memberQuerySchema = caseBoundQuerySchema
  .extend({ identifier: z.string().trim().min(3).max(320) })
  .strict();

export const auditQuerySchema = caseBoundQuerySchema
  .extend({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const verifyAdminMfaSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/u),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const createAdminStepUpSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/u),
    password: z.string().min(1).max(256).optional(),
    expectedMfaVersion: z.number().int().positive(),
    scope: z.enum(adminStepUpScopes),
    targetType: z.string().trim().min(1).max(80).optional(),
    targetId: z.uuid().optional(),
  })
  .strict()
  .refine((value) => (value.targetId ? Boolean(value.targetType) : true), {
    path: ["targetType"],
    message: "Target type is required for a target ID.",
  });

const adminCommandSchema = z.object({
  caseId: z.uuid(),
  clientCommandId: z.uuid(),
});

export const changeAdminUserStatusSchema = adminCommandSchema
  .extend({
    status: z.enum(["ACTIVE", "SUSPENDED"]),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const revokeAdminUserSessionsSchema = adminCommandSchema.strict();

export const updateAdminFeatureFlagSchema = adminCommandSchema
  .extend({
    expectedVersion: z.number().int().positive(),
    enabled: z.boolean(),
    owner: z.string().trim().min(2).max(120),
    purpose: z.string().trim().min(12).max(1000),
    audience: z.record(z.string().min(1).max(80), z.json()),
    reviewAt: z.iso.datetime().optional(),
    expiresAt: z.iso.datetime().optional(),
    rollbackPlan: z.string().trim().min(12).max(1000),
  })
  .strict();

export const retryAdminJobSchema = adminCommandSchema
  .extend({ expectedVersion: z.number().int().positive() })
  .strict();

export const requestRoleChangeSchema = adminCommandSchema
  .extend({
    targetUserId: z.uuid(),
    roleKey: z.enum([
      "support-administrator",
      "platform-administrator",
      "content-curator",
      "auditor",
    ]),
    operation: z.enum(["GRANT", "REVOKE"]),
    expectedUserVersion: z.number().int().positive(),
    expiresAt: z.iso.datetime().optional(),
  })
  .strict();

export const approveRoleChangeSchema = adminCommandSchema
  .extend({ expectedApprovalVersion: z.number().int().positive() })
  .strict();
