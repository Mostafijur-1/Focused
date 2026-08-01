import { describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@/features/auth/domain/auth-types";
import { AIService } from "@/features/ai/application/ai-service";
import type {
  AIProposalExecutor,
  AIProviderRouter,
  AIRepository,
} from "@/features/ai/application/ports";
import type { AIProposalView } from "@/features/ai/domain/ai-types";

const now = new Date("2026-08-01T12:00:00.000Z");
const actor: AuthUser = {
  id: "23238b54-ab60-4167-b760-e312b39a53af",
  email: "ai@example.test",
  displayName: "AI Owner",
  passwordHash: null,
  emailVerifiedAt: now,
  status: "ACTIVE",
  permissionVersion: 1,
  permissions: ["ai:read:own", "ai:write:own", "ai:proposal:apply:own"],
};

describe("AIService proposal agency boundary", () => {
  it("does not mutate a Goal until an explicit, versioned apply decision", async () => {
    const proposal = proposalView();
    const beginProposalApply = vi.fn().mockResolvedValue({
      ...proposal,
      status: "applying",
      version: 2,
    });
    const repository = {
      findProposal: vi.fn().mockResolvedValue(proposal),
      beginProposalApply,
      completeProposalApply: vi.fn().mockResolvedValue({
        ...proposal,
        status: "accepted",
        appliedResourceId: "e968e93d-d9c7-44c7-bf57-e5cb020c3f4d",
        version: 3,
      }),
      failProposalApply: vi.fn(),
    } as unknown as AIRepository;
    const executor: AIProposalExecutor = {
      applyGoal: vi.fn().mockResolvedValue({
        id: "e968e93d-d9c7-44c7-bf57-e5cb020c3f4d",
      }),
    };
    const service = buildService(repository, executor);
    expect(executor.applyGoal).not.toHaveBeenCalled();

    const commandId = crypto.randomUUID();
    const result = await service.decideProposal(actor, proposal.id, {
      decision: "apply",
      expectedVersion: 1,
      clientCommandId: commandId,
      editedPatch: { ...proposal.patch, title: "Edited by member" },
      note: null,
    });

    expect(beginProposalApply.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(executor.applyGoal).mock.invocationCallOrder[0]!,
    );
    expect(executor.applyGoal).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ title: "Edited by member" }),
      commandId,
    );
    expect(result.status).toBe("accepted");
  });

  it("records rejection without invoking the owning Goal use case", async () => {
    const proposal = proposalView();
    const repository = {
      findProposal: vi.fn().mockResolvedValue(proposal),
      rejectProposal: vi.fn().mockResolvedValue({
        ...proposal,
        status: "rejected",
        version: 2,
      }),
    } as unknown as AIRepository;
    const executor: AIProposalExecutor = { applyGoal: vi.fn() };
    const result = await buildService(repository, executor).decideProposal(
      actor,
      proposal.id,
      {
        decision: "reject",
        expectedVersion: 1,
        clientCommandId: crypto.randomUUID(),
        note: "Not relevant",
      },
    );
    expect(result.status).toBe("rejected");
    expect(executor.applyGoal).not.toHaveBeenCalled();
  });
});

function buildService(repository: AIRepository, executor: AIProposalExecutor) {
  return new AIService({
    repository,
    proposalExecutor: executor,
    router: {
      select: vi.fn().mockReturnValue(null),
      fallback: vi.fn().mockReturnValue(null),
    } satisfies AIProviderRouter,
    rateLimiter: {
      check: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 1 }),
    },
    clock: { now: () => now },
    privacy: {
      groqConfigured: false,
      groqZeroDataRetention: false,
      geminiConfigured: false,
      geminiServiceTier: "unpaid",
    },
  });
}

function proposalView(): AIProposalView {
  return {
    id: "d749881d-06fb-4a52-982e-574fcfb28e05",
    runId: "f410b3aa-f092-4131-8a4f-048801288d05",
    targetType: "goal",
    operation: "create",
    patch: {
      title: "Original proposal",
      description: null,
      horizon: "quarter",
      priority: 1,
      successMeasure: null,
      targetDate: null,
    },
    editedPatch: null,
    rationale: "Based on the selected Goal summary.",
    status: "pending",
    expiresAt: "2026-08-08T12:00:00.000Z",
    appliedResourceId: null,
    version: 1,
  };
}
