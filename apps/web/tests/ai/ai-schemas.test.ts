import { describe, expect, it } from "vitest";

import {
  coachMessageSchema,
  dailyReviewRequestSchema,
  proposalDecisionSchema,
} from "@/features/ai/transport/ai-schemas";

describe("AI transport schemas", () => {
  it("rejects undeclared sensitive context categories", () => {
    expect(
      coachMessageSchema.safeParse({
        conversationId: null,
        clientRequestId: crypto.randomUUID(),
        locale: "bn-BD",
        message: "আজকের অগ্রাধিকার কী হওয়া উচিত?",
        contextScopes: ["journal"],
      }).success,
    ).toBe(false);
  });

  it("requires an idempotency identifier for daily review generation", () => {
    expect(
      dailyReviewRequestSchema.safeParse({
        locale: "en",
        contextScopes: [],
        includeGoalProposal: false,
      }).success,
    ).toBe(false);
  });

  it("requires optimistic version and explicit apply decision", () => {
    expect(
      proposalDecisionSchema.safeParse({
        decision: "apply",
        expectedVersion: 1,
        clientCommandId: crypto.randomUUID(),
        editedPatch: null,
        note: null,
      }).success,
    ).toBe(true);
    expect(
      proposalDecisionSchema.safeParse({ decision: "apply" }).success,
    ).toBe(false);
  });
});
