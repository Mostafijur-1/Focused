import type { NextRequest } from "next/server";

import { getHabitService } from "@/features/habits/infrastructure/habit-container";
import { checkInHabitSchema } from "@/features/habits/transport/habit-schemas";
import {
  habitActor,
  habitHistoryCursor,
  habitId as parseHabitId,
} from "@/features/habits/transport/habit-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ habitId: string }>;
}

export function POST(request: NextRequest, context: RouteContext) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, { habitId }, input] = await Promise.all([
        habitActor(request),
        context.params,
        parseJson(request, checkInHabitSchema),
      ]);
      const data = await getHabitService().checkIn(
        actor,
        parseHabitId(habitId),
        input,
      );
      return apiSuccess({ data }, requestId);
    },
    "Habit check-in request failed",
  );
}

export function GET(request: NextRequest, context: RouteContext) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, { habitId }] = await Promise.all([
        habitActor(request),
        context.params,
      ]);
      const cursor = habitHistoryCursor(
        request.nextUrl.searchParams.get("cursor"),
      );
      const data = await getHabitService().history(
        actor,
        parseHabitId(habitId),
        cursor,
      );
      return apiSuccess({ data }, requestId);
    },
    "Habit history request failed",
  );
}
