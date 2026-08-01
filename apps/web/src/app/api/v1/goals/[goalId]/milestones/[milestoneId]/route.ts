import type { NextRequest } from "next/server";
import { getGoalService } from "@/features/goals/infrastructure/goal-container";
import { updateMilestoneSchema } from "@/features/goals/transport/goal-schemas";
import { goalActor, resourceId } from "@/features/goals/transport/goal-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";
export const runtime = "nodejs";
interface Context {
  readonly params: Promise<{ goalId: string; milestoneId: string }>;
}
export function PATCH(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, params, input] = await Promise.all([
        goalActor(request),
        context.params,
        parseJson(request, updateMilestoneSchema),
      ]);
      return apiSuccess(
        {
          data: await getGoalService().updateMilestone(
            actor,
            resourceId(params.goalId, "/goalId"),
            resourceId(params.milestoneId, "/milestoneId"),
            input,
          ),
        },
        requestId,
      );
    },
    "Milestone update request failed",
  );
}
