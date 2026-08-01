import type { NextRequest } from "next/server";

import { getGoalService } from "@/features/goals/infrastructure/goal-container";
import {
  createGoalSchema,
  goalStatusSchema,
} from "@/features/goals/transport/goal-schemas";
import { goalActor, optionalUuid } from "@/features/goals/transport/goal-route";
import { AppError } from "@/lib/errors/app-error";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const actor = await goalActor(request);
      const rawStatus = request.nextUrl.searchParams.get("status");
      const parsedStatus =
        rawStatus === null ? undefined : goalStatusSchema.safeParse(rawStatus);
      if (parsedStatus && !parsedStatus.success)
        throw new AppError({
          code: "VALIDATION_ERROR",
          safeMessage: "The goal status filter is invalid.",
        });
      const cursor = optionalUuid(
        request.nextUrl.searchParams.get("cursor"),
        "/cursor",
      );
      const limit = Number(request.nextUrl.searchParams.get("limit") ?? 30);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100)
        throw new AppError({
          code: "VALIDATION_ERROR",
          safeMessage: "The page size must be between 1 and 100.",
        });
      const data = await getGoalService().list(actor, {
        ...(parsedStatus?.success ? { status: parsedStatus.data } : {}),
        ...(request.nextUrl.searchParams.get("q")
          ? { query: request.nextUrl.searchParams.get("q")!.slice(0, 200) }
          : {}),
        ...(cursor ? { cursor } : {}),
        limit,
      });
      const response = apiSuccess({ data }, requestId);
      response.headers.set("cache-control", "private, no-store");
      response.headers.set("vary", "authorization");
      return response;
    },
    "Goal list request failed",
  );
}

export function POST(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, input] = await Promise.all([
        goalActor(request),
        parseJson(request, createGoalSchema),
      ]);
      return apiSuccess(
        { data: await getGoalService().create(actor, input) },
        requestId,
        { status: 201 },
      );
    },
    "Goal create request failed",
  );
}
