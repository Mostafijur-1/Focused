import type { NextRequest } from "next/server";
import { getGoalService } from "@/features/goals/infrastructure/goal-container";
import { publishLifeVisionSchema } from "@/features/goals/transport/goal-schemas";
import { goalActor, resourceId } from "@/features/goals/transport/goal-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";
export const runtime = "nodejs";
interface Context {
  readonly params: Promise<{ visionId: string }>;
}
export function POST(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, params, input] = await Promise.all([
        goalActor(request),
        context.params,
        parseJson(request, publishLifeVisionSchema),
      ]);
      return apiSuccess(
        {
          data: await getGoalService().publishLifeVision(
            actor,
            resourceId(params.visionId, "/visionId"),
            input.expectedVersion,
            input.clientCommandId,
          ),
        },
        requestId,
      );
    },
    "Life Vision publish request failed",
  );
}
