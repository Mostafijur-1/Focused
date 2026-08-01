import type { NextRequest } from "next/server";
import { getGoalService } from "@/features/goals/infrastructure/goal-container";
import { checkInGoalSchema } from "@/features/goals/transport/goal-schemas";
import { goalActor, resourceId } from "@/features/goals/transport/goal-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";
export const runtime = "nodejs";
interface Context {
  readonly params: Promise<{ goalId: string }>;
}
export function POST(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, params, input] = await Promise.all([
        goalActor(request),
        context.params,
        parseJson(request, checkInGoalSchema),
      ]);
      return apiSuccess(
        {
          data: await getGoalService().checkIn(
            actor,
            resourceId(params.goalId, "/goalId"),
            input,
          ),
        },
        requestId,
        { status: 201 },
      );
    },
    "Goal check-in request failed",
  );
}
