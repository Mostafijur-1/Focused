import "server-only";

import type { AuthUser } from "@/features/auth/domain/auth-types";
import type { AIProposalExecutor } from "@/features/ai/application/ports";
import type { GoalProposalPatch } from "@/features/ai/domain/ai-types";
import { getGoalService } from "@/features/goals/infrastructure/goal-container";

export class GoalProposalExecutor implements AIProposalExecutor {
  async applyGoal(
    actor: AuthUser,
    patch: GoalProposalPatch,
    clientCommandId: string,
  ): Promise<Readonly<{ id: string }>> {
    const goal = await getGoalService().create(actor, {
      parentGoalId: null,
      title: patch.title,
      description: patch.description,
      horizon: patch.horizon,
      priority: patch.priority,
      progressMode: "manual",
      manualProgress: 0,
      successMeasure: patch.successMeasure,
      targetValue: null,
      targetUnit: null,
      targetDate: patch.targetDate,
      clientCommandId,
    });
    return { id: goal.id };
  }
}
