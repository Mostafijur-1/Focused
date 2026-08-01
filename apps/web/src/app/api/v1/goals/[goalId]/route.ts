import type { NextRequest } from "next/server";
import { getGoalService } from "@/features/goals/infrastructure/goal-container";
import { updateGoalSchema } from "@/features/goals/transport/goal-schemas";
import { goalActor, resourceId } from "@/features/goals/transport/goal-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";
export const runtime = "nodejs";
interface Context {
  readonly params: Promise<{ goalId: string }>;
}
export function GET(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, params] = await Promise.all([
        goalActor(request),
        context.params,
      ]);
      return apiSuccess(
        {
          data: await getGoalService().detail(
            actor,
            resourceId(params.goalId, "/goalId"),
          ),
        },
        requestId,
      );
    },
    "Goal detail request failed",
  );
}
export function PATCH(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, params, input] = await Promise.all([
        goalActor(request),
        context.params,
        parseJson(request, updateGoalSchema),
      ]);
      return apiSuccess(
        {
          data: await getGoalService().update(
            actor,
            resourceId(params.goalId, "/goalId"),
            input,
          ),
        },
        requestId,
      );
    },
    "Goal update request failed",
  );
}
