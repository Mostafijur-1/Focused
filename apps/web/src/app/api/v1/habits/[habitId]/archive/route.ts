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
      const data = await getHabitService().setArchived(
        actor,
        parseHabitId(habitId),
        input.expectedVersion,
        true,
      );
      return apiSuccess({ data }, requestId);
    },
    "Habit archive request failed",
  );
}

export function DELETE(request: NextRequest, context: RouteContext) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, { habitId }, input] = await Promise.all([
        habitActor(request),
        context.params,
        parseJson(request, habitStateSchema),
      ]);
      const data = await getHabitService().setArchived(
        actor,
        parseHabitId(habitId),
        input.expectedVersion,
        false,
      );
      return apiSuccess({ data }, requestId);
    },
    "Habit restore request failed",
  );
}
