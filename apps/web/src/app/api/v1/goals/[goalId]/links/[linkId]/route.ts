import type { NextRequest } from "next/server";
import { getGoalService } from "@/features/goals/infrastructure/goal-container";
import { unlinkGoalSchema } from "@/features/goals/transport/goal-schemas";
import { goalActor, resourceId } from "@/features/goals/transport/goal-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute } from "@/lib/http/api-route";
export const runtime = "nodejs";
interface Context {
  readonly params: Promise<{ goalId: string; linkId: string }>;
}
export function DELETE(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, params] = await Promise.all([
        goalActor(request),
        context.params,
      ]);
      const query = unlinkGoalSchema.parse({
        expectedVersion: request.nextUrl.searchParams.get("expectedVersion"),
      });
      return apiSuccess(
        {
          data: await getGoalService().unlink(
            actor,
            resourceId(params.goalId, "/goalId"),
            resourceId(params.linkId, "/linkId"),
            query.expectedVersion,
          ),
        },
        requestId,
      );
    },
    "Goal unlink request failed",
  );
}
