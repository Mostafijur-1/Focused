import type { NextRequest } from "next/server";
import { getGoalService } from "@/features/goals/infrastructure/goal-container";
import { saveLifeVisionSchema } from "@/features/goals/transport/goal-schemas";
import { goalActor } from "@/features/goals/transport/goal-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const actor = await goalActor(request);
      const response = apiSuccess(
        { data: await getGoalService().lifeVision(actor) },
        requestId,
      );
      response.headers.set("cache-control", "private, no-store");
      return response;
    },
    "Life Vision request failed",
  );
}
export function PUT(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, input] = await Promise.all([
        goalActor(request),
        parseJson(request, saveLifeVisionSchema),
      ]);
      return apiSuccess(
        { data: await getGoalService().saveLifeVision(actor, input) },
        requestId,
      );
    },
    "Life Vision save request failed",
  );
}
