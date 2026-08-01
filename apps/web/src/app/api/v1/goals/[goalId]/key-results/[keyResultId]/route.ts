import type { NextRequest } from "next/server";
import { getGoalService } from "@/features/goals/infrastructure/goal-container";
import { updateKeyResultSchema } from "@/features/goals/transport/goal-schemas";
import { goalActor, resourceId } from "@/features/goals/transport/goal-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";
export const runtime = "nodejs";
interface Context {
  readonly params: Promise<{ goalId: string; keyResultId: string }>;
}
export function PATCH(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, params, input] = await Promise.all([
        goalActor(request),
        context.params,
        parseJson(request, updateKeyResultSchema),
      ]);
      return apiSuccess(
        {
          data: await getGoalService().updateKeyResult(
            actor,
            resourceId(params.goalId, "/goalId"),
            resourceId(params.keyResultId, "/keyResultId"),
            input,
          ),
        },
        requestId,
      );
    },
    "Key result update request failed",
  );
}
