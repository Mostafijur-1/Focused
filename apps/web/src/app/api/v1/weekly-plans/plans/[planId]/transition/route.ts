import type { NextRequest } from "next/server";
import { getGoalService } from "@/features/goals/infrastructure/goal-container";
import { transitionWeeklyPlanSchema } from "@/features/goals/transport/goal-schemas";
import { goalActor, resourceId } from "@/features/goals/transport/goal-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";
export const runtime = "nodejs";
interface Context {
  readonly params: Promise<{ planId: string }>;
}
export function POST(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, params, input] = await Promise.all([
        goalActor(request),
        context.params,
        parseJson(request, transitionWeeklyPlanSchema),
      ]);
      return apiSuccess(
        {
          data: await getGoalService().transitionWeeklyPlan(
            actor,
            resourceId(params.planId, "/planId"),
            input.toStatus,
            input.expectedVersion,
          ),
        },
        requestId,
      );
    },
    "Weekly plan transition request failed",
  );
}
