import type { NextRequest } from "next/server";
import { getGoalService } from "@/features/goals/infrastructure/goal-container";
import { saveWeeklyPlanSchema } from "@/features/goals/transport/goal-schemas";
import { goalActor } from "@/features/goals/transport/goal-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";
import { AppError } from "@/lib/errors/app-error";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface Context {
  readonly params: Promise<{ weekStart: string }>;
}
export function GET(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, params] = await Promise.all([
        goalActor(request),
        context.params,
      ]);
      const response = apiSuccess(
        { data: await getGoalService().weeklyPlan(actor, params.weekStart) },
        requestId,
      );
      response.headers.set("cache-control", "private, no-store");
      return response;
    },
    "Weekly plan request failed",
  );
}
export function PUT(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, params, input] = await Promise.all([
        goalActor(request),
        context.params,
        parseJson(request, saveWeeklyPlanSchema),
      ]);
      if (params.weekStart !== input.weekStart)
        throw new AppError({
          code: "VALIDATION_ERROR",
          safeMessage: "The route and payload week must match.",
          details: {
            errors: [
              {
                pointer: "/weekStart",
                code: "week_mismatch",
                message: "The route and payload week must match.",
              },
            ],
          },
        });
      return apiSuccess(
        { data: await getGoalService().saveWeeklyPlan(actor, input) },
        requestId,
      );
    },
    "Weekly plan save request failed",
  );
}
