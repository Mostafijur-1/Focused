import type { NextRequest } from "next/server";

import { getHabitService } from "@/features/habits/infrastructure/habit-container";
import { habitStateSchema } from "@/features/habits/transport/habit-schemas";
import {
  habitActor,
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
        parseJson(request, habitStateSchema),
      ]);
      const data = await getHabitService().resume(
        actor,
        parseHabitId(habitId),
        input.expectedVersion,
      );
      return apiSuccess({ data }, requestId);
    },
    "Habit resume request failed",
  );
}
