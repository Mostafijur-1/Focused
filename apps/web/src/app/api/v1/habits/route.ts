import type { NextRequest } from "next/server";

import { getHabitService } from "@/features/habits/infrastructure/habit-container";
import { createHabitSchema } from "@/features/habits/transport/habit-schemas";
import { habitActor } from "@/features/habits/transport/habit-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const actor = await habitActor(request);
      const data = await getHabitService().list(actor);
      const response = apiSuccess({ data }, requestId);
      response.headers.set("cache-control", "private, no-store");
      response.headers.set("vary", "authorization");
      return response;
    },
    "Habit list request failed",
  );
}

export function POST(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const actor = await habitActor(request);
      const input = await parseJson(request, createHabitSchema);
      const data = await getHabitService().create(actor, input);
      return apiSuccess({ data }, requestId, { status: 201 });
    },
    "Habit create request failed",
  );
}
